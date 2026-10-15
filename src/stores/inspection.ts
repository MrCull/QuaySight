import { defineStore } from 'pinia'
import { defaultModelFor } from '../domain/providers'
import { runRecordedInspection, type SampleScenario } from '../domain/recordedRun'
import { runRecordedManifestRetry } from '../domain/manifest'
import { assembleLunaReading, LUNA_MODEL, LunaError } from '../domain/luna'
import { callLuna, type LunaCallResult } from '../services/luna'
import {
  mergeRecheck,
  observationsOf,
  RECHECK_PURPOSE,
  recheckOutcome,
  recheckRecord,
  unresolvedPositions,
} from '../domain/recheck'
import { useLedgerStore } from './ledger'
import {
  INSPECTION_SCHEMA_VERSION,
  type InspectionRecord,
  type ProviderId,
  type RawProviderResponse,
  type RecheckRecord,
} from '../domain/inspection'

export interface SelectedPhoto {
  name: string
  /** Object URL for display. The view owns its lifecycle (revoke when replaced). */
  url: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
  /** The photo as chosen, sent to a live provider. Absent for a photo that was not read from a file. */
  file?: Blob
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'failed'

export interface ManifestRetryState {
  status: 'idle' | 'checking' | 'error'
  /** Provider message for the last failed check. */
  message: string | null
  /** Entries from the last check, so Try again sends the same list. */
  ids: string[]
  /** The presenter chose Keep first result for this run. */
  dismissed: boolean
}

/** Pause before a recorded result lands, so the staged progress can read. Within the 1.6s arrival budget. */
export const RECORDED_STAGE_DELAY_MS = 1600
/** Pause before a recorded manifest check lands. */
export const RECORDED_RETRY_DELAY_MS = 1600

let liveCounter = 0

const freshRetry = (): ManifestRetryState => ({
  status: 'idle',
  message: null,
  ids: [],
  dismissed: false,
})

export const useInspectionStore = defineStore('inspection', {
  state: () => ({
    provider: 'luna' as ProviderId,
    model: defaultModelFor('luna'),
    photo: null as SelectedPhoto | null,
    status: 'idle' as RunStatus,
    record: null as InspectionRecord | null,
    /** Bumped on every photo change; a run whose token is stale must not write its result. */
    runToken: 0,
    inFlight: null as Promise<void> | null,
    /** Recorded sample to replay on the next run (sample-only control). */
    scenario: 'identified' as SampleScenario,
    /** Sample-only control: the recorded manifest check fails. */
    retryFails: false,
    retry: freshRetry() as ManifestRetryState,
    /**
     * The presenter's OpenAI key. Memory only: no persistence plugin, no storage write, cleared on request.
     * It is sent only by callLuna, only to the Luna endpoint.
     */
    apiKey: '' as string,
    /** Actionable message for the last failed run. The provider's text is never the key. */
    errorMessage: null as string | null,
  }),
  getters: {
    /** Live only for Luna with a key entered. Jev has no live path yet, so it always replays its sample. */
    mode(): 'live' | 'recorded' {
      return this.provider === 'luna' && this.apiKey.trim() !== '' ? 'live' : 'recorded'
    },
  },
  actions: {
    setApiKey(key: string) {
      this.apiKey = key
    },
    clearApiKey() {
      this.apiKey = ''
    },
    setProvider(provider: ProviderId) {
      this.provider = provider
      this.model = defaultModelFor(provider)
    },
    setModel(model: string) {
      this.model = model
    },
    setPhoto(photo: SelectedPhoto) {
      this.runToken += 1
      this.inFlight = null
      this.photo = photo
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
    },
    start(): Promise<void> {
      // Single-flight: repeated clicks while a run is in progress share it.
      if (this.inFlight) return this.inFlight
      if (!this.photo) return Promise.resolve()
      if (this.mode === 'live') return this.startLive()

      this.runToken += 1
      const token = this.runToken
      const photo = this.photo
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null

      const run: Promise<void> = runRecordedInspection(this.provider, {
        delayMs: RECORDED_STAGE_DELAY_MS,
        scenario: this.scenario,
      })
        .then((record) => {
          if (token !== this.runToken) return
          this.record = {
            ...record,
            photo: { name: photo.name, orientation: photo.orientation },
          }
          this.status = 'complete'
        })
        .catch(() => {
          if (token === this.runToken) this.status = 'failed'
        })
        .finally(() => {
          if (this.inFlight === run) this.inFlight = null
        })

      this.inFlight = run
      return run
    },
    /**
     * One live Luna call for the chosen photo, through the cost ledger and its per-inspection cap (spec 8.5, 11.5).
     * A failure keeps the photo and the ledger line; a partial reading from a successful call is kept.
     */
    startLive(): Promise<void> {
      const photo = this.photo
      if (!photo) return Promise.resolve()
      if (!photo.file) {
        this.status = 'failed'
        this.record = null
        this.errorMessage = 'Choose the photo again to run a live inspection.'
        return Promise.resolve()
      }

      this.runToken += 1
      const token = this.runToken
      const apiKey = this.apiKey
      const file = photo.file
      const inspectionId = `live-luna-${(liveCounter += 1)}`
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null

      const ledger = useLedgerStore()
      const run: Promise<void> = (async () => {
        let reading = null as Awaited<ReturnType<typeof callLuna>> | null
        const result = await ledger.run({
          id: `${inspectionId}-read`,
          inspectionId,
          purpose: 'Reading markings',
          provider: 'luna',
          endpoint: 'decisions',
          model: LUNA_MODEL,
          call: async () => {
            reading = await callLuna({ apiKey, photo: file })
            return {
              resolvedModel: reading.resolvedModel,
              usage: reading.usage,
              latencyMs: reading.latencyMs,
            }
          },
        })
        if (token !== this.runToken) return

        if (result.status === 'ran' && reading) {
          const first: LunaCallResult = reading
          const asked = unresolvedPositions(first.readings)
          let containerId = first.containerId
          const rawResponses: RawProviderResponse[] = [
            {
              passId: inspectionId,
              provider: 'luna',
              model: LUNA_MODEL,
              capturedFrom: 'provider',
              body: first.raw,
            },
          ]
          let rechecks: RecheckRecord[] = []

          if (asked.length > 0) {
            // One re-check for the unread positions, on the same provider and model, through the same cap (spec 5.1, 8.5).
            const recheckId = `${inspectionId}-recheck`
            let again = null as LunaCallResult | null
            const checked = await ledger.run({
              id: recheckId,
              inspectionId,
              purpose: RECHECK_PURPOSE,
              provider: 'luna',
              endpoint: 'decisions',
              model: LUNA_MODEL,
              call: async () => {
                again = await callLuna({ apiKey, photo: file, positions: asked })
                return {
                  resolvedModel: again.resolvedModel,
                  usage: again.usage,
                  latencyMs: again.latencyMs,
                }
              },
            })
            if (token !== this.runToken) return

            if (checked.status === 'ran' && again) {
              const second: LunaCallResult = again
              const merged = mergeRecheck(first.readings, second.readings, asked)
              containerId = assembleLunaReading(merged.readings)
              rawResponses.push({
                passId: recheckId,
                provider: 'luna',
                model: LUNA_MODEL,
                capturedFrom: 'provider',
                body: second.raw,
              })
              rechecks = [
                recheckRecord({
                  id: recheckId,
                  provider: 'luna',
                  model: LUNA_MODEL,
                  asked,
                  resolvedVersion: second.resolvedModel,
                  outcome: recheckOutcome(asked, merged.resolved),
                  resolved: merged.resolved,
                  observations: observationsOf(second.readings, asked),
                }),
              ]
            } else if (checked.status === 'blocked') {
              rechecks = [
                recheckRecord({
                  id: recheckId,
                  provider: 'luna',
                  model: LUNA_MODEL,
                  asked,
                  resolvedVersion: null,
                  outcome: 'skipped-cap',
                  resolved: [],
                  observations: [],
                  reason: checked.reason,
                }),
              ]
            } else {
              // A failed re-check keeps the first result, which is already usable.
              rechecks = [
                recheckRecord({
                  id: recheckId,
                  provider: 'luna',
                  model: LUNA_MODEL,
                  asked,
                  resolvedVersion: null,
                  outcome: 'failed',
                  resolved: [],
                  observations: [],
                }),
              ]
            }
          }

          const live: InspectionRecord = {
            schemaVersion: INSPECTION_SCHEMA_VERSION,
            id: inspectionId,
            provider: 'luna',
            model: LUNA_MODEL,
            resolvedVersion: first.resolvedModel,
            rawResponses,
            source: 'live',
            status: 'complete',
            photo: { name: photo.name, orientation: photo.orientation },
            containerId,
            damage: null,
            sizeCode: null,
            weights: null,
            rechecks,
          }
          this.record = live
          this.status = 'complete'
        } else if (result.status === 'blocked') {
          this.status = 'failed'
          this.errorMessage =
            result.reason === 'requests'
              ? 'This inspection has reached its request limit. Start a new photo to run again.'
              : 'This inspection has reached its spend limit. Start a new photo to run again.'
        } else {
          this.status = 'failed'
          this.errorMessage =
            result.status === 'failed' && result.error instanceof LunaError
              ? result.error.message
              : 'The live inspection could not be completed. Try again.'
        }
      })().finally(() => {
        if (this.inFlight === run) this.inFlight = null
      })

      this.inFlight = run
      return run
    },
    /**
     * Manifest retry (spec 3.2), recorded only. Replaces the container ID in place on success and
     * leaves the first result unchanged on failure. Recorded replays never reach the cost ledger
     * or the per-inspection cap: only live chargeable calls go through runChargeable (spec 8.5).
     */
    async retryManifest(ids: string[]): Promise<void> {
      const record = this.record
      if (!record || record.containerId !== null) return
      if (this.retry.status === 'checking' || ids.length === 0) return

      const token = this.runToken
      this.retry = { ...this.retry, status: 'checking', message: null, ids: [...ids] }
      try {
        const reading = await runRecordedManifestRetry(record.provider, ids, {
          delayMs: RECORDED_RETRY_DELAY_MS,
          fail: this.retryFails,
        })
        if (token !== this.runToken || this.record !== record) return
        this.record = { ...record, containerId: reading }
        this.retry = { ...this.retry, status: 'idle' }
      } catch (error) {
        if (token !== this.runToken) return
        this.retry = {
          ...this.retry,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
    dismissRetry() {
      this.retry = { ...this.retry, dismissed: true }
    },
  },
})
