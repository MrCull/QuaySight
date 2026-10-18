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
import { askDecisions } from '../services/askDecisions'
import { manifestAsk } from '../domain/manifestAsk'
import type { ManifestMapping } from '../domain/luna'
import { preparePhoto, PhotoPreparationError } from '../services/preparePhoto'
import { OPENROUTER_ENDPOINT_ID } from '../domain/openrouter'
import { useLedgerStore } from './ledger'
import { useSetupStore } from './setup'
import type { InspectionRecord, ProviderId } from '../domain/inspection'
import {
  RUN_STAGES,
  stageProgress,
  stageSettled,
  type PlannedRequestState,
  type StageId,
  type StageProgress,
  type StageState,
} from '../domain/runStages'
import {
  foldSettled,
  runPlan,
  type PlanRun,
  type RequestReply,
  type RunRoute,
  type SettledRequest,
} from '../plan/requestPlan'
import { draftRecord } from '../plan/draftRecord'
import { planRequests } from '../plan/registry'
import { planForPhoto } from '../plan/photoPlan'
import { combinePhotoRuns, droppedPhotoMessage } from '../domain/combinePhotos'

export interface SelectedPhoto {
  name: string
  /** Object URL for display. The view revokes it when the photo is replaced; New inspection revokes it when dropped. */
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
  /** The last check finished and no manifest entry matched the photo; the first result is kept. */
  noMatch: boolean
}

/** A container inspection takes at most this many photos (spec #51). */
export const MAX_PHOTOS = 5
export const TOO_MANY_PHOTOS = `Choose up to ${MAX_PHOTOS} photos of one container.`

/** Pause before a recorded result lands, so the staged progress can read. Within the 1.6s arrival budget. */
export const RECORDED_STAGE_DELAY_MS = 1600
/** Pause before a recorded manifest check lands. */
export const RECORDED_RETRY_DELAY_MS = 1600

let liveCounter = 0
let manifestCounter = 0

/**
 * The live run's plan in flight, with the run token it belongs to. Outside reactive state: it holds
 * abort controllers. New inspection (and its Cancel), a new photo and a provider or model change abort it.
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

/** The route a catalogue model is reached on: its wire format, endpoint family and error wording. Null for a model the catalogue lacks. */
function routeOf(provider: ProviderId, model: string): RunRoute | null {
  const entry = findModel(provider, model)
  if (!entry) return null
  return {
    provider,
    model,
    entry,
    endpoint: endpointOf(entry),
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
}

/** The route the first reading took, or null where it has no live manifest call (the offer is then hidden). */
function liveManifestRoute(provider: ProviderId, model: string): RunRoute | null {
  const route = routeOf(provider, model)
  return route && ['openrouter-decisions', 'openai-decisions'].includes(route.entry.wireFormat)
    ? route
    : null
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
    /** The photos after the first, when several of one container were chosen (up to MAX_PHOTOS in all). */
    extraPhotos: [] as SelectedPhoto[],
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
     * Each key is read only for its own provider's call (askDecisions); switching provider never moves a key.
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
    /** Photos are chosen but the current provider has no key: the inspection starts once one is saved. */
    awaitingKey: false,
  }),
  getters: {
    /** Every photo of the inspection, in order: the first, then the others. */
    photos(): SelectedPhoto[] {
      return this.photo ? [this.photo, ...this.extraPhotos] : []
    },
    /**
     * New inspection shows once there is something to clear: photos chosen or a sample picked, whatever
     * the run is doing (running, waiting for a key, complete, failed). Hidden on the empty picker.
     */
    showNewInspection(): boolean {
      return this.photo !== null || this.sample !== null
    },
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
      const stateOf = this.stageState
      return (stage) => this.status !== 'running' || stageSettled(stateOf(stage))
    },
    /** Where one progress stage of the run on screen is; a stage this run does not have is not-in-run. */
    stageState(): (stage: StageId) => StageState {
      const stages = this.stages
      return (stage) => stages.find((s) => s.id === stage)?.state ?? 'not-in-run'
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
    /**
     * Holds the key for the selected provider. Starts nothing: the key field calls this on every keystroke,
     * so photos waiting for a key start when the settings drawer closes (startIfAwaitingKey).
     */
    setApiKey(key: string) {
      this.apiKeys[this.provider] = key
    },
    /** Photos waiting for a key start once the gate is open; otherwise nothing happens. */
    startIfAwaitingKey() {
      if (this.awaitingKey && this.canStart) void this.start()
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
    /**
     * Several photos of one container, for a live run (ticket #70). More than MAX_PHOTOS are refused with a
     * plain message and nothing changes; a single photo is exactly setPhoto. Returns the refusal, or null.
     */
    setPhotos(photos: SelectedPhoto[]): string | null {
      if (this.demo || photos.length === 0) return null
      if (photos.length > MAX_PHOTOS) return TOO_MANY_PHOTOS
      this.showPhoto(photos[0]!, photos.slice(1))
      this.sample = null
      return null
    },
    /** Demo mode: puts a bundled sample on screen, ready to start. */
    chooseSample(id: DemoSampleId) {
      if (!this.demo) return
      const { photos } = findSample(id)
      const [first, ...others] = photos.map(({ name, url, orientation }) => ({
        name,
        url,
        orientation,
      }))
      this.showPhoto(first!, others)
      this.sample = id
    },
    /** Shared by setPhoto and chooseSample: a new photo on screen drops any run, result and selection. */
    showPhoto(photo: SelectedPhoto, others: SelectedPhoto[] = []) {
      abortActivePlan()
      this.runToken += 1
      this.inFlight = null
      this.photo = photo
      this.extraPhotos = others
      this.status = 'idle'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.selectedFinding = null
      this.sentPhoto = null
      this.runId = null
      this.planned = []
      this.awaitingKey = false
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
      for (const { url } of this.photos) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      // Every request in flight is aborted: its ledger line says cancelled and its answer never lands.
      abortActivePlan()
      this.runToken += 1
      this.inFlight = null
      this.photo = null
      this.extraPhotos = []
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
      this.awaitingKey = false
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
    /**
     * Choosing photos is the go-ahead. Starts now, or, when only the key is missing, waits for it:
     * the settings drawer opens, and closing it with a key (setup store closeDrawer) starts the run.
     */
    startWhenReady(): Promise<void> {
      if (!this.demo && this.photo && !this.canStart) {
        this.awaitingKey = true
        useSetupStore().openDrawer()
        return Promise.resolve()
      }
      return this.start()
    },
    start(): Promise<void> {
      // Single-flight: repeated clicks while a run is in progress share it.
      if (this.inFlight) return this.inFlight
      // Live needs the key gate; demo needs a bundled sample on screen.
      if (!this.photo || !this.canStart) return Promise.resolve()
      this.awaitingKey = false
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
     * first failure's message; when some parts answer and others fail, what answered is kept and the
     * record is marked partial. New inspection aborts the run: its token goes stale and nothing lands.
     */
    startLive(): Promise<void> {
      const photos = this.photos
      if (photos.length === 0) return Promise.resolve()
      if (photos.some((p) => !p.file)) {
        this.status = 'failed'
        this.record = null
        this.errorMessage = 'Choose the photo again to run a live inspection.'
        return Promise.resolve()
      }

      this.runToken += 1
      const token = this.runToken
      const provider = this.provider
      const apiKey = this.apiKey
      const requestedModel = provider === 'luna' ? LUNA_MODEL : this.model
      // The catalogue entry decides the wire format, box support and photo limits; nothing else does.
      const entry = findModel(provider, requestedModel)
      const modelName = labelsFor(provider, requestedModel).model
      const inspectionId = `live-${provider}-${(liveCounter += 1)}`
      const route = routeOf(provider, requestedModel)
      // Several photos of one container: each is surveyed, and what else is sent follows from its face (plan/photoPlan.ts).
      const several = photos.length > 1
      const plans = photos.map(() => (route ? planForPhoto(planRequests(), route, several) : []))
      this.status = 'running'
      this.record = null
      this.retry = freshRetry()
      this.errorMessage = null
      this.sentPhoto = null
      this.runId = inspectionId
      const idPrefix = (n: number) => (several ? `p${n + 1}-` : '')
      /** Where each photo's requests are; the progress stages count them all as the one container's. */
      const plannedBy: PlannedRequestState[][] = plans.map((plan, n) =>
        plan.map((r) => ({
          id: `${idPrefix(n)}${r.id}`,
          stages: [...r.stages],
          state: 'waiting',
          optional: r.optional ?? false,
          startedAt: null,
          settledAt: null,
        })),
      )
      this.planned = plannedBy.flat()

      const ledger = useLedgerStore()
      const run: Promise<void> = (async () => {
        // The photos as sent: upright and fitted to the model. A photo the model would refuse stops here,
        // before any request or charge. The chosen photos stay the ones on screen.
        let sent: Blob[]
        try {
          const limits = entry?.photoLimits
          if (!limits) throw new PhotoPreparationError('Choose a model to run a live inspection.')
          sent = await Promise.all(
            photos.map(async (p, n) => {
              try {
                return await preparePhoto(p.file as Blob, limits, modelName)
              } catch (error) {
                if (several && error instanceof PhotoPreparationError) {
                  throw new PhotoPreparationError(`Photo ${n + 1}: ${error.message}`)
                }
                throw error
              }
            }),
          )
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
        this.sentPhoto = markRaw(sent[0]!)
        if (!route || plans.some((plan) => plan.length === 0)) {
          this.status = 'failed'
          this.errorMessage = 'The live inspection could not be completed. Try again.'
          return
        }

        const drafts = photos.map((photo, n) =>
          draftRecord({
            id: several ? `${inspectionId}-p${n + 1}` : inspectionId,
            provider,
            model: requestedModel,
            source: 'live',
            photo: { name: photo.name, orientation: photo.orientation },
          }),
        )
        const settled: SettledRequest[] = []
        const combined = () =>
          several
            ? combinePhotoRuns(
                drafts.map((record, n) => ({
                  index: n + 1,
                  name: photos[n]!.name,
                  record,
                })),
                { id: inspectionId },
              )
            : drafts[0]!
        const lives = plans.map((plan, n) =>
          runPlan({
            requests: plan,
            route,
            apiKey,
            photo: sent[n]!,
            original: photos[n]!.file as Blob,
            inspectionId,
            photoLabel: several
              ? { idPrefix: idPrefix(n), purposeSuffix: ` (photo ${n + 1})` }
              : undefined,
            charge: (request) => ledger.run(request),
            onState: (states) => {
              if (token !== this.runToken) return
              plannedBy[n] = states.map((s) => ({ ...s, id: `${idPrefix(n)}${s.id}` }))
              this.planned = plannedBy.flat()
            },
            onSettled: (done) => {
              if (token !== this.runToken) return
              settled.push(done)
              drafts[n] = foldSettled(drafts[n]!, done)
              // The record on screen follows each answer; parts show as their stage lands.
              if (settled.some((s) => s.outcome.status === 'answered')) this.record = combined()
            },
          }),
        )
        const live: PlanRun = {
          done: Promise.all(lives.map((l) => l.done)).then(() => undefined),
          cancel: () => lives.forEach((l) => l.cancel()),
        }
        activePlan = { token, run: live }
        await live.done
        if (activePlan?.run === live) activePlan = null
        if (token !== this.runToken) return

        const answered = settled.filter((s) => s.outcome.status === 'answered')
        if (answered.length === 0) {
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
        const result = combined()
        if (several && result.photos!.every((p) => p.dropped)) {
          // No photo shows a container: there is nothing to show but why.
          this.record = null
          this.status = 'failed'
          this.errorMessage = result.photos!.map((p) => droppedPhotoMessage(p.index)).join('. ')
          return
        }
        const incomplete = stageProgress(this.planned).some((s) => s.state === 'failed')
        this.record = { ...result, status: incomplete ? 'partial' : 'complete' }
        this.status = 'complete'
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
      this.retry = checkingRetry(this.retry, ids)
      const questions = buildManifestQuestions(ids)
      // Each check is its own request: a failed one and its Try again are two ledger lines.
      const passId = `${record.id}-manifest-${(manifestCounter += 1)}`
      let answered = null as RequestReply<ManifestMapping> | null
      const ledger = useLedgerStore()
      const result = await ledger.run({
        id: passId,
        inspectionId: record.id,
        purpose: MANIFEST_PURPOSE,
        provider: record.provider,
        endpoint: route.endpoint,
        model: route.model,
        call: async () => {
          answered = await askDecisions({ route, apiKey, photo }, manifestAsk(questions))
          return answered
        },
      })
      if (token !== this.runToken || this.record !== record) return

      if (result.status === 'ran' && answered) {
        const done = answered
        this.record = {
          ...record,
          containerId: done.answer.reading ?? record.containerId,
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
        this.retry = { ...this.retry, status: 'idle', noMatch: done.answer.reading === null }
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
