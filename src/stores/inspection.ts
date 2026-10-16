import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { defaultModelFor, findModel, labelsFor, questionSetOf } from '../domain/providers'
import { canStart as keyGateOpen, hasKey } from '../domain/keyGate'
import {
  findSample,
  runDemoManifestRetry,
  runDemoSample,
  type DemoSampleId,
} from '../domain/demoSamples'
import { buildManifestQuestions, MANIFEST_PURPOSE, needsManifest } from '../domain/manifest'
import {
  assembleLunaReading,
  LUNA_ENDPOINT_ID,
  LUNA_MODEL,
  LunaError,
  type ChoiceReading,
} from '../domain/luna'
import { callLuna, callLunaManifest } from '../services/luna'
import {
  callOpenRouterJev,
  callOpenRouterLuna,
  callOpenRouterManifest,
} from '../services/openrouter'
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
  /** The last check finished and no manifest entry matched the photo; the first result is kept. */
  noMatch: boolean
}

/** Pause before a recorded result lands, so the staged progress can read. Within the 1.6s arrival budget. */
export const RECORDED_STAGE_DELAY_MS = 1600
/** Pause before a recorded manifest check lands. */
export const RECORDED_RETRY_DELAY_MS = 1600

let liveCounter = 0
let manifestCounter = 0

/** The cap's message for a call it stopped. */
function capMessage(reason: 'requests' | 'spend'): string {
  return reason === 'requests'
    ? 'This inspection has reached its request limit. Start a new photo to run again.'
    : 'This inspection has reached its spend limit. Start a new photo to run again.'
}

/** The live manifest call for a catalogue model's wire format, and its ledger endpoint. */
interface ManifestRoute {
  endpoint: string
  call: (options: {
    apiKey: string
    photo: Blob
    questions: ReturnType<typeof buildManifestQuestions>
  }) => Promise<LiveManifestReading>
}

interface LiveManifestReading {
  reading: ContainerIdReading | null
  resolvedModel: string
  usage: Usage | null
  latencyMs: number
  raw: unknown
  reportedCostUsd: number | null
}

/** The route the first reading took, or null where it has no live manifest call (the offer is then hidden). */
function liveManifestRoute(provider: ProviderId, model: string): ManifestRoute | null {
  const entry = findModel(provider, model)
  if (entry?.wireFormat === 'openrouter-decisions') {
    const describe = {
      name: labelsFor(provider, model).model,
      maxSide: entry.photoLimits.maxSide,
    }
    return {
      endpoint: OPENROUTER_ENDPOINT_ID,
      call: (options) => callOpenRouterManifest({ ...options, model, describe }),
    }
  }
  if (entry?.wireFormat === 'openai-decisions') {
    return {
      endpoint: LUNA_ENDPOINT_ID,
      call: async (options) => ({ ...(await callLunaManifest(options)), reportedCostUsd: null }),
    }
  }
  return null
}

const freshRetry = (): ManifestRetryState => ({
  status: 'idle',
  message: null,
  ids: [],
  dismissed: false,
  noMatch: false,
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
    /** Demo mode: the bundled sample on screen, or null while the sample picker shows. */
    sample: null as DemoSampleId | null,
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
    /** Demo mode (spec #16): the bundled samples replay recorded results; no key, no upload, no network. Never persisted. */
    demo: false,
    /** Actionable message for the last failed run. The provider's text is never the key. */
    errorMessage: null as string | null,
    /** The photo exactly as sent for the live result on screen, so the manifest check sends the same. Dropped with the result. */
    sentPhoto: null as Blob | null,
  }),
  getters: {
    /** The key for the selected provider only. */
    apiKey(): string {
      return this.apiKeys[this.provider]
    },
    /** Recorded in demo mode only; every other run is live (and needs the key). */
    mode(): 'live' | 'recorded' {
      return this.demo ? 'recorded' : 'live'
    },
    /**
     * Demo: a bundled sample is on screen (no key). Live, the key gate: a photo, a key for the selected
     * provider and a model that provider offers.
     */
    canStart(): boolean {
      if (this.demo) return this.sample !== null && this.photo !== null
      return keyGateOpen({
        hasPhoto: this.photo !== null,
        provider: this.provider,
        model: this.model,
        apiKey: this.apiKey,
      })
    },
    /**
     * Whether a manifest check can run for the result on screen: demo, the sample's own recorded check;
     * live, one call on the same route and model with the photo as sent. A live route with no manifest
     * call has no check at all: a recorded result is never shown against a photo it did not come from.
     */
    canCheckManifest(): boolean {
      const record = this.record
      if (!record) return false
      if (this.demo) return record.source === 'recorded' && this.sample !== null
      if (record.source !== 'live' || this.sentPhoto === null) return false
      return liveManifestRoute(record.provider, record.model) !== null
    },
    /** The manifest offer: a check can run and the container ID is not (fully) identified (spec 3.2). */
    manifestRetryOffered(): boolean {
      return this.canCheckManifest && needsManifest(this.record?.containerId ?? null)
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
    /** A chosen photo, for a live run. Demo mode has no upload: its results belong to the bundled samples only. */
    setPhoto(photo: SelectedPhoto) {
      if (this.demo) return
      this.showPhoto(photo)
      this.sample = null
    },
    /** Demo mode: puts a bundled sample on screen, ready to start. */
    chooseSample(id: DemoSampleId) {
      if (!this.demo) return
      const { photo } = findSample(id)
      this.showPhoto({ name: photo.name, url: photo.url, orientation: photo.orientation })
      this.sample = id
    },
    /** Shared by setPhoto and chooseSample: a new photo on screen drops any run, result and selection. */
    showPhoto(photo: SelectedPhoto) {
      this.runToken += 1
      this.inFlight = null
      this.photo = photo
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
      this.sentPhoto = null
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
      this.sample = null
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
      this.sentPhoto = null
    },
    /** Enters demo mode on a blank screen, ready to choose a sample. */
    enterDemo() {
      this.newInspection()
      this.demo = true
    },
    /** Leaves demo mode (Connect a provider) on a blank screen: the next run is live and needs a key. */
    leaveDemo() {
      this.newInspection()
      this.demo = false
    },
    start(): Promise<void> {
      // Single-flight: repeated clicks while a run is in progress share it.
      if (this.inFlight) return this.inFlight
      // Live needs the key gate; demo needs a bundled sample on screen.
      if (!this.photo || !this.canStart) return Promise.resolve()
      if (!this.demo) return this.startLive()
      const sample = this.sample
      if (!sample) return Promise.resolve()

      // Demo: the sample's own recorded result. No network call, nothing on the cost ledger.
      this.runToken += 1
      const token = this.runToken
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null

      const run: Promise<void> = runDemoSample(sample, { delayMs: RECORDED_STAGE_DELAY_MS })
        .then((record) => {
          if (token !== this.runToken) return
          this.record = record
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
      this.sentPhoto = null

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
        this.sentPhoto = markRaw(sent)

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
          this.errorMessage = capMessage(result.reason)
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
     * Manifest retry (spec 3.2). Demo mode replays the sample's own recorded check. Live, it is one
     * call on the same provider and model with the photo as sent, through the cost ledger and the
     * per-inspection cap (spec 8.5): the model chooses among the pasted entries or "not listed". A
     * match replaces the container ID in place; "not listed" and any failure keep the first result.
     * New inspection cancels it like any run: its token goes stale and the answer is dropped.
     */
    async retryManifest(ids: string[]): Promise<void> {
      const record = this.record
      if (!record || !needsManifest(record.containerId)) return
      if (this.retry.status === 'checking' || ids.length === 0) return
      if (this.demo) return this.retryDemoManifest(ids)

      // Live only: never a recorded replay against this photo.
      const photo = this.sentPhoto
      const route =
        record.source === 'live' ? liveManifestRoute(record.provider, record.model) : null
      const apiKey = this.apiKeys[record.provider]
      if (!route || !photo || !hasKey(apiKey)) return

      const token = this.runToken
      this.retry = {
        ...this.retry,
        status: 'checking',
        message: null,
        ids: [...ids],
        noMatch: false,
      }
      const questions = buildManifestQuestions(ids)
      // Each check is its own request: a failed one and its Try again are two ledger lines.
      const passId = `${record.id}-manifest-${(manifestCounter += 1)}`
      let answered = null as LiveManifestReading | null
      const ledger = useLedgerStore()
      const result = await ledger.run({
        id: passId,
        inspectionId: record.id,
        purpose: MANIFEST_PURPOSE,
        provider: record.provider,
        endpoint: route.endpoint,
        model: record.model,
        call: async () => {
          answered = await route.call({ apiKey, photo, questions })
          return {
            resolvedModel: answered.resolvedModel,
            usage: answered.usage,
            latencyMs: answered.latencyMs,
            reportedCostUsd: answered.reportedCostUsd,
          }
        },
      })
      if (token !== this.runToken || this.record !== record) return

      if (result.status === 'ran' && answered) {
        const done: LiveManifestReading = answered
        this.record = {
          ...record,
          containerId: done.reading ?? record.containerId,
          rawResponses: [
            ...record.rawResponses,
            {
              passId,
              provider: record.provider,
              model: record.model,
              capturedFrom: 'provider',
              body: done.raw,
            },
          ],
        }
        this.retry = { ...this.retry, status: 'idle', noMatch: done.reading === null }
      } else {
        this.retry = {
          ...this.retry,
          status: 'error',
          message:
            result.status === 'blocked'
              ? capMessage(result.reason)
              : result.status === 'failed' &&
                  (result.error instanceof LunaError || result.error instanceof OpenRouterError)
                ? result.error.message
                : 'The manifest check could not be completed. Try again.',
        }
      }
    },
    /** Demo mode: the sample's own recorded manifest check. No key, no network, no ledger entry. */
    async retryDemoManifest(ids: string[]): Promise<void> {
      const record = this.record
      const sample = this.sample
      if (!record || !sample) return
      const token = this.runToken
      this.retry = {
        ...this.retry,
        status: 'checking',
        message: null,
        ids: [...ids],
        noMatch: false,
      }
      try {
        const reading = await runDemoManifestRetry(sample, ids, {
          delayMs: RECORDED_RETRY_DELAY_MS,
          fail: this.retryFails,
        })
        if (token !== this.runToken || this.record !== record) return
        if (reading) this.record = { ...record, containerId: reading }
        this.retry = { ...this.retry, status: 'idle', noMatch: reading === null }
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
