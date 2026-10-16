import { defineStore } from 'pinia'
import { defaultModelFor, findModel, labelsFor, questionSetOf } from '../domain/providers'
import { canStart as keyGateOpen, hasKey } from '../domain/keyGate'
import { runRecordedInspection, type SampleScenario } from '../domain/recordedRun'
import { runRecordedManifestRetry } from '../domain/manifest'
import { assembleLunaReading, LUNA_MODEL, LunaError, type ChoiceReading } from '../domain/luna'
import { callLuna } from '../services/luna'
import { callOpenRouterJev, callOpenRouterLuna } from '../services/openrouter'
import { preparePhoto, PhotoPreparationError } from '../services/preparePhoto'
import { OPENROUTER_ENDPOINT_ID, OpenRouterError } from '../domain/openrouter'
import {
  mergeRecheck,
  observationsOf,
  RECHECK_PURPOSE,
  recheckOutcome,
  recheckRecord,
  unresolvedPositions,
} from '../domain/recheck'
import type { ContainerIdReading } from '../domain/inspection'
import type { Usage } from '../domain/ledger'
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
  /** Object URL for display. The view revokes it when the photo is replaced; New inspection revokes it when dropped. */
  url: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
  /** The photo as chosen, sent to a live provider. Absent for a photo that was not read from a file. */
  file?: Blob
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'failed'

/** One live provider call, normalised for the record and the ledger. */
interface LiveReading {
  containerId: ContainerIdReading
  resolvedModel: string
  usage: Usage | null
  latencyMs: number
  raw: unknown
  /** Cost the response itself reports, or null. Never zero when absent. */
  reportedCostUsd: number | null
}

/** One Luna question-set call on either route: per-position readings, for the re-check. */
interface LunaReading extends LiveReading {
  readings: ChoiceReading[]
}

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
    // OpenRouter with Jev latest is pre-selected on a first visit (spec #16).
    provider: 'openrouter' as ProviderId,
    model: defaultModelFor('openrouter'),
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
    /** The damage finding whose marker, area and card are selected together, or null. */
    selectedFinding: null as number | null,
    /**
     * The presenter's keys, one per provider. Memory only: no persistence plugin, no storage write, cleared on request.
     * Each key is read only for its own provider's call (callLuna or callOpenRouterJev); switching provider never moves a key.
     */
    apiKeys: { luna: '', openrouter: '' } as Record<ProviderId, string>,
    /**
     * Presenter choice, made only once a key is entered: replay the recorded sample (no network call)
     * instead of a live run. A key is required to start either way.
     */
    replaySample: false,
    /** Actionable message for the last failed run. The provider's text is never the key. */
    errorMessage: null as string | null,
  }),
  getters: {
    /** The key for the selected provider only. */
    apiKey(): string {
      return this.apiKeys[this.provider]
    },
    /** Recorded only when the presenter chose replay; otherwise live (which needs the key). */
    mode(): 'live' | 'recorded' {
      return this.replaySample ? 'recorded' : 'live'
    },
    /** The key gate: a photo, a key for the selected provider and a model that provider offers. */
    canStart(): boolean {
      return keyGateOpen({
        hasPhoto: this.photo !== null,
        provider: this.provider,
        model: this.model,
        apiKey: this.apiKey,
      })
    },
  },
  actions: {
    setApiKey(key: string) {
      this.apiKeys[this.provider] = key
    },
    clearApiKey() {
      this.apiKeys[this.provider] = ''
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
      this.selectedFinding = null
    },
    selectFinding(id: number | null) {
      this.selectedFinding = id
    },
    /**
     * New inspection: a blank screen for the next container, with no confirmation (spec #16).
     * Clears the photo, the result, the run status and its error, the manifest retry and the
     * selected damage marker. A run or manifest check in flight is cancelled: its token goes stale,
     * so whatever it returns is dropped. Keeps the provider, model, every key and the session ledger.
     * Later flows reuse this one action (a provider or model change, leaving demo mode).
     */
    newInspection() {
      const dropped = this.photo?.url
      if (dropped?.startsWith('blob:')) URL.revokeObjectURL(dropped)
      this.runToken += 1
      this.inFlight = null
      this.photo = null
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
    },
    start(): Promise<void> {
      // Single-flight: repeated clicks while a run is in progress share it.
      if (this.inFlight) return this.inFlight
      // Key gate: nothing starts, recorded or live, without a key for the selected provider.
      if (!this.photo || !this.canStart) return Promise.resolve()
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
     * One live call for the chosen photo, through the cost ledger and its per-inspection cap (spec 8.5, 11.5).
     * Luna (OpenAI direct or OpenRouter) and Jev (OpenRouter) share this path; each provider's key goes
     * only to its own call. Only the Luna question set runs the position re-check (ticket #14), on the
     * same route and model as the first pass; Jev makes one call.
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
      const provider = this.provider
      const apiKey = this.apiKey
      const file = photo.file
      const requestedModel = provider === 'luna' ? LUNA_MODEL : this.model
      // The catalogue entry decides the wire format, box support and photo limits; nothing else does.
      const entry = findModel(provider, requestedModel)
      const endpoint =
        entry?.wireFormat === 'openrouter-decisions' ? OPENROUTER_ENDPOINT_ID : 'decisions'
      const modelName = labelsFor(provider, requestedModel).model
      const describe = { name: modelName, maxSide: entry?.photoLimits.maxSide ?? 0 }
      const inspectionId = `live-${provider}-${(liveCounter += 1)}`
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null

      const ledger = useLedgerStore()
      const run: Promise<void> = (async () => {
        // The photo as sent: upright and fitted to the model. A photo the model would refuse stops here,
        // before any request or charge. The chosen photo stays the one on screen.
        let sent: Blob
        try {
          const limits = entry?.photoLimits
          if (!limits) throw new PhotoPreparationError('Choose a model to run a live inspection.')
          sent = await preparePhoto(file, limits, modelName)
        } catch (error) {
          if (token !== this.runToken) return
          this.status = 'failed'
          this.errorMessage =
            error instanceof PhotoPreparationError
              ? error.message
              : 'That photo could not be prepared for sending. Choose another photo.'
          return
        }
        if (token !== this.runToken) return

        // The Luna question set on this run's route: OpenAI direct, or OpenRouter (ticket #23).
        const readLuna = async (positions?: number[]): Promise<LunaReading> => {
          if (entry?.wireFormat === 'openrouter-decisions') {
            return callOpenRouterLuna({
              apiKey,
              photo: sent,
              model: requestedModel,
              positions,
              describe,
            })
          }
          return { ...(await callLuna({ apiKey, photo: sent, positions })), reportedCostUsd: null }
        }

        let reading = null as LiveReading | null
        let lunaFirst = null as LunaReading | null
        const result = await ledger.run({
          id: `${inspectionId}-read`,
          inspectionId,
          purpose: 'Reading markings',
          provider,
          endpoint,
          model: requestedModel,
          call: async () => {
            if (entry && questionSetOf(entry) === 'luna') {
              const call = await readLuna()
              lunaFirst = call
              reading = call
            } else if (entry?.wireFormat === 'openrouter-decisions') {
              reading = await callOpenRouterJev({
                apiKey,
                photo: sent,
                model: requestedModel,
                box: entry.box,
                describe,
              })
            } else {
              throw new Error(`No live adapter for ${requestedModel}`)
            }
            const done = reading as LiveReading
            return {
              resolvedModel: done.resolvedModel,
              usage: done.usage,
              latencyMs: done.latencyMs,
              reportedCostUsd: done.reportedCostUsd,
            }
          },
        })
        if (token !== this.runToken) return

        if (result.status === 'ran' && reading) {
          const first = reading as LiveReading
          let containerId = first.containerId
          const resolvedVersion = first.resolvedModel
          const rawResponses: RawProviderResponse[] = [
            {
              passId: inspectionId,
              provider,
              model: requestedModel,
              capturedFrom: 'provider',
              body: first.raw,
            },
          ]
          let rechecks: RecheckRecord[] = []

          if (lunaFirst) {
            const lunaFirstCall = lunaFirst as LunaReading
            const asked = unresolvedPositions(lunaFirstCall.readings)
            if (asked.length > 0) {
              // One re-check for the unread positions, on the same provider and model, through the same cap (spec 5.1, 8.5).
              const recheckId = `${inspectionId}-recheck`
              let again = null as LunaReading | null
              const checked = await ledger.run({
                id: recheckId,
                inspectionId,
                purpose: RECHECK_PURPOSE,
                provider,
                endpoint,
                model: requestedModel,
                call: async () => {
                  again = await readLuna(asked)
                  return {
                    resolvedModel: again.resolvedModel,
                    usage: again.usage,
                    latencyMs: again.latencyMs,
                    reportedCostUsd: again.reportedCostUsd,
                  }
                },
              })
              if (token !== this.runToken) return

              if (checked.status === 'ran' && again) {
                const second: LunaReading = again
                const merged = mergeRecheck(lunaFirstCall.readings, second.readings, asked)
                containerId = assembleLunaReading(merged.readings)
                rawResponses.push({
                  passId: recheckId,
                  provider,
                  model: requestedModel,
                  capturedFrom: 'provider',
                  body: second.raw,
                })
                rechecks = [
                  recheckRecord({
                    id: recheckId,
                    provider,
                    model: requestedModel,
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
                    provider,
                    model: requestedModel,
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
                    provider,
                    model: requestedModel,
                    asked,
                    resolvedVersion: null,
                    outcome: 'failed',
                    resolved: [],
                    observations: [],
                  }),
                ]
              }
            }
          }

          const live: InspectionRecord = {
            schemaVersion: INSPECTION_SCHEMA_VERSION,
            id: inspectionId,
            provider,
            model: requestedModel,
            resolvedVersion,
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
            result.status === 'failed' &&
            (result.error instanceof LunaError || result.error instanceof OpenRouterError)
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
      if (!hasKey(this.apiKey)) return

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
