import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { defaultModelFor, findModel, labelsFor, type ModelOption } from '../domain/providers'
import { canStart as keyGateOpen, hasKey } from '../domain/keyGate'
import {
  findSample,
  runDemoManifestRetry,
  runDemoSample,
  type DemoSampleId,
} from '../domain/demoSamples'
import { buildManifestQuestions, MANIFEST_PURPOSE, needsManifest } from '../domain/manifest'
import { LUNA_ENDPOINT_ID, LUNA_MODEL } from '../domain/luna'
import { ProviderError } from '../domain/providerErrors'
import { callLunaManifest } from '../services/luna'
import { callOpenRouterManifest } from '../services/openrouter'
import { preparePhoto, PhotoPreparationError } from '../services/preparePhoto'
import { OPENROUTER_ENDPOINT_ID } from '../domain/openrouter'
import type { ContainerIdReading } from '../domain/inspection'
import type { Usage } from '../domain/ledger'
import { useLedgerStore } from './ledger'
import {
  INSPECTION_SCHEMA_VERSION,
  type InspectionRecord,
  type ProviderId,
} from '../domain/inspection'
import {
  RUN_STAGES,
  stageProgress,
  stageSettled,
  type PlannedRequestState,
  type StageId,
  type StageProgress,
} from '../domain/runStages'
import {
  foldSettled,
  planFor,
  runPlan,
  type PlanRun,
  type RunRoute,
  type SettledRequest,
} from '../plan/requestPlan'
import { planRequests } from '../plan/registry'

export interface SelectedPhoto {
  name: string
  /** Object URL for display. The view revokes it when the photo is replaced; New inspection revokes it when dropped. */
  url: string
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
  /** The photo as chosen, sent to a live provider. Absent for a photo that was not read from a file. */
  file?: Blob
}

/** cancelled: the presenter cancelled the run before any part of it answered. */
export type RunStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled'

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

/**
 * The live run's plan in flight, with the run token it belongs to. Outside reactive state: it holds
 * abort controllers. Cancel, New inspection, a new photo and a provider or model change abort it.
 */
let activePlan: { token: number; run: PlanRun } | null = null

function abortActivePlan() {
  activePlan?.run.cancel()
  activePlan = null
}

/** The cap's message for a call it stopped. */
function capMessage(reason: 'requests' | 'spend'): string {
  return reason === 'requests'
    ? 'This inspection has reached its request limit. Start a new photo to run again.'
    : 'This inspection has reached its spend limit. Start a new photo to run again.'
}

/**
 * What a failed live call says: a provider's own message (`advice` alone where the panel adds what is
 * kept in its own words), or the fallback for anything else.
 */
function failureMessage(error: unknown, fallback: string, part: 'message' | 'advice'): string {
  return error instanceof ProviderError ? error[part] : fallback
}

/** Whether the catalogue reaches this model through OpenRouter's Decisions endpoint. */
function viaOpenRouter(
  entry: ModelOption | undefined,
): entry is ModelOption & { wireFormat: 'openrouter-decisions' } {
  return entry?.wireFormat === 'openrouter-decisions'
}

/** The ledger's endpoint family for a model's route. */
function endpointOf(entry: ModelOption | undefined): string {
  return viaOpenRouter(entry) ? OPENROUTER_ENDPOINT_ID : LUNA_ENDPOINT_ID
}

/** A manifest check under way for these entries: no message, no earlier no-match. */
function checkingRetry(retry: ManifestRetryState, ids: string[]): ManifestRetryState {
  return { ...retry, status: 'checking', message: null, ids: [...ids], noMatch: false }
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
  if (viaOpenRouter(entry)) {
    const describe = {
      name: labelsFor(provider, model).model,
      maxSide: entry.photoLimits.maxSide,
    }
    return {
      endpoint: endpointOf(entry),
      call: (options) => callOpenRouterManifest({ ...options, model, describe }),
    }
  }
  if (entry?.wireFormat === 'openai-decisions') {
    return {
      endpoint: endpointOf(entry),
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
    /** The inspection id of the latest live run, from its start: its ledger lines are this container's. */
    runId: null as string | null,
    /** Where each request of the latest live run is, for the progress stages. */
    planned: [] as PlannedRequestState[],
    /** Cancel was pressed during the current run. */
    cancelRequested: false,
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
     * Progress stages of the run on screen. Live, from its requests; a recorded replay has no requests,
     * so its stages are all at work until the sample lands.
     */
    stages(): StageProgress[] {
      if (this.demo) {
        const state = this.status === 'complete' ? 'done' : 'active'
        return RUN_STAGES.map(({ id, title }) => ({ id, title, state, elapsedMs: null }))
      }
      return stageProgress(this.planned)
    },
    /**
     * Whether a part of the result may show: once the run is over, or once its own stage has settled.
     * A stage not in this run lands with the run.
     */
    landed(): (stage: StageId) => boolean {
      const stages = this.stages
      return (stage) =>
        this.status !== 'running' ||
        stageSettled(stages.find((s) => s.id === stage)?.state ?? 'not-in-run')
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
      if (!record || this.status === 'running') return false
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
      abortActivePlan()
      this.runToken += 1
      this.inFlight = null
      this.photo = photo
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
      this.sentPhoto = null
      this.runId = null
      this.planned = []
      this.cancelRequested = false
    },
    selectFinding(id: number | null) {
      this.selectedFinding = id
    },
    /**
     * New inspection: a blank screen for the next container, with no confirmation (spec #16).
     * Clears the photo, the result, the run status and its error, the manifest retry, the
     * selected damage marker and the sample option (Make the manifest check fail). A run or manifest check in flight is cancelled: its token goes stale,
     * so whatever it returns is dropped. Keeps the provider, model, every key and the session ledger.
     * Later flows reuse this one action (a provider or model change, leaving demo mode).
     */
    newInspection() {
      const dropped = this.photo?.url
      if (dropped?.startsWith('blob:')) URL.revokeObjectURL(dropped)
      // Every request in flight is aborted: its ledger line says cancelled and its answer never lands.
      abortActivePlan()
      this.runToken += 1
      this.inFlight = null
      this.photo = null
      this.sample = null
      this.retryFails = false
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
      this.sentPhoto = null
      this.runId = null
      this.planned = []
      this.cancelRequested = false
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
      this.cancelRequested = false
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
     * A live run for the chosen photo, as a request plan (src/plan): every registered request that
     * applies to this route, through the cost ledger and its per-inspection cap (spec 8.5, 11.5), each
     * with its own abort signal, ledger line and stage. Independent requests start together; a dependent
     * one starts when its prerequisites answer. Each provider's key goes only to its own route.
     * Every answer is folded into the record as it lands. When nothing answers the run fails with the
     * first failure's message; when some parts answer and others fail or are cancelled, what answered is
     * kept and the record is marked partial.
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
      const modelName = labelsFor(provider, requestedModel).model
      const inspectionId = `live-${provider}-${(liveCounter += 1)}`
      const route: RunRoute | null = entry
        ? {
            provider,
            model: requestedModel,
            entry,
            endpoint: endpointOf(entry),
            describe: { name: modelName, maxSide: entry.photoLimits.maxSide },
          }
        : null
      const plan = route ? planFor(planRequests(), route) : []
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.sentPhoto = null
      this.runId = inspectionId
      this.planned = plan.map((r) => ({
        id: r.id,
        stages: [...r.stages],
        state: 'waiting',
        optional: r.optional ?? false,
        startedAt: null,
        settledAt: null,
      }))

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
        // A cancel while the photo was being prepared: nothing was sent.
        if (this.cancelRequested) return this.finishCancelled()
        this.sentPhoto = markRaw(sent)
        if (!route || plan.length === 0) {
          this.status = 'failed'
          this.errorMessage = 'The live inspection could not be completed. Try again.'
          return
        }

        let draft: InspectionRecord = {
          schemaVersion: INSPECTION_SCHEMA_VERSION,
          id: inspectionId,
          provider,
          model: requestedModel,
          resolvedVersion: '',
          rawResponses: [],
          source: 'live',
          status: 'running',
          photo: { name: photo.name, orientation: photo.orientation },
          containerId: null,
          damage: null,
          sizeCode: null,
          weights: null,
          rechecks: [],
        }
        const settled: SettledRequest[] = []
        const live = runPlan({
          requests: plan,
          route,
          apiKey,
          photo: sent,
          inspectionId,
          charge: (request) => ledger.run(request),
          onState: (states) => {
            if (token === this.runToken) this.planned = states
          },
          onSettled: (done) => {
            if (token !== this.runToken) return
            settled.push(done)
            draft = foldSettled(draft, done)
            // The record on screen follows each answer; parts show as their stage lands.
            if (settled.some((s) => s.outcome.status === 'answered')) this.record = draft
          },
        })
        activePlan = { token, run: live }
        await live.done
        if (activePlan?.run === live) activePlan = null
        if (token !== this.runToken) return

        const answered = settled.filter((s) => s.outcome.status === 'answered')
        if (answered.length === 0) {
          if (live.cancelled) return this.finishCancelled()
          // Nothing answered: the first failure explains the run.
          const first = settled.find((s) => s.outcome.status !== 'cancelled')?.outcome
          this.record = null
          this.status = 'failed'
          this.errorMessage =
            first?.status === 'blocked'
              ? capMessage(first.reason)
              : failureMessage(
                  first?.status === 'failed' ? first.error : null,
                  'The live inspection could not be completed. Try again.',
                  'message',
                )
          return
        }
        const incomplete =
          live.cancelled || stageProgress(this.planned).some((s) => s.state === 'failed')
        this.record = { ...draft, status: incomplete ? 'partial' : 'complete' }
        this.status = 'complete'
      })().finally(() => {
        if (this.inFlight === run) this.inFlight = null
      })

      this.inFlight = run
      return run
    },
    /**
     * Cancel during a run: aborts the requests still in flight and never sends the rest. What already
     * answered is kept and marked partial; when nothing had answered, the run ends cancelled. Their
     * ledger lines say cancelled, with unknown cost.
     */
    cancel() {
      if (this.status !== 'running') return
      this.cancelRequested = true
      if (this.demo) {
        // A recorded replay has no request to abort: its answer is simply dropped.
        this.runToken += 1
        this.inFlight = null
        this.finishCancelled()
        return
      }
      if (activePlan?.token === this.runToken) activePlan.run.cancel()
    },
    /** A run cancelled before anything answered: no result, the photo stays, and Start can run again. */
    finishCancelled() {
      this.status = 'cancelled'
      this.record = null
      this.errorMessage = null
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
      this.retry = checkingRetry(this.retry, ids)
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
          // The panel adds "Your first result is unchanged." itself.
          message:
            result.status === 'blocked'
              ? capMessage(result.reason)
              : failureMessage(
                  result.status === 'failed' ? result.error : null,
                  'The manifest check could not be completed. Try again.',
                  'advice',
                ),
        }
      }
    },
    /** Demo mode: the sample's own recorded manifest check. No key, no network, no ledger entry. */
    async retryDemoManifest(ids: string[]): Promise<void> {
      const record = this.record
      const sample = this.sample
      if (!record || !sample) return
      const token = this.runToken
      this.retry = checkingRetry(this.retry, ids)
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
