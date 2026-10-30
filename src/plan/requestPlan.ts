import type { CropRegion } from '../domain/cropRead'
import type { InspectionRecord, ProviderId } from '../domain/inspection'
import type { CapReason, ChargeableRequest, ChargeableResult, Usage } from '../domain/ledger'
import { failureOf, unreadableBody } from '../domain/requestFailure'
import type { FailureModel } from '../domain/openrouter'
import type { ModelOption } from '../domain/providers'
import type { PlannedRequestState, RequestState, StageId } from '../domain/runStages'

// A live run is a request plan: a set of requests against the selected provider and model. Each request
// has its own abort signal, ledger line and progress stage(s); independent requests start together and a
// dependent one starts when its prerequisites have answered. A request is defined once, in its own
// module (a question builder, an answer mapper and the record fields it fills), and listed in
// ./registry.ts. Neither the store's run logic nor the record type changes to add one: see
// notes/request-plan.md for the steps.

/** The provider route a run is made on. Everything here comes from the catalogue entry. */
export interface RunRoute {
  provider: ProviderId
  /** The model as requested. */
  model: string
  entry: ModelOption
  /** The ledger's endpoint family. */
  endpoint: string
  /** What error messages say about the model. */
  describe: FailureModel
}

/** What a request may read about its run: the route and its prerequisites' answers. */
export interface PlanView {
  route: RunRoute
  /** The answer of a request in this run, once it has answered; otherwise undefined. */
  answer<B>(request: PlanRequest<B>): B | undefined
}

/** What a request is sent with. The key goes only to the route's own endpoint. */
export interface RequestContext extends PlanView {
  apiKey: string
  /** The photo as sent: upright and fitted to the model. */
  photo: Blob
  /** The photo as it was chosen (full resolution), when the run has it: zoomed reads are cut from it. */
  original?: Blob
  /** This request's own abort signal. Cancel, New inspection and a provider or model change abort it. */
  signal: AbortSignal
}

/** One answered request, normalised for the ledger and the export. */
export interface RequestReply<A> {
  answer: A
  /** The exact model/version the provider reported. */
  resolvedModel: string
  usage: Usage | null
  latencyMs: number
  /** Cost the response itself reports, or null. Never zero when absent. */
  reportedCostUsd: number | null
  /** The response payload, kept for the export. No headers, no key. */
  raw: unknown
}

/** How a request that was started ended. */
export type RequestOutcome<A> =
  | { status: 'answered'; answer: A; resolvedModel: string }
  | { status: 'failed'; error: unknown }
  | { status: 'blocked'; reason: CapReason }
  | { status: 'cancelled' }

/** What a recording keeps of a request beside its raw response (./recording.ts), for a replay that needs it. */
export interface ReplayExtras {
  /** The crop read's region. */
  crop?: CropRegion
  /** The recorded request asked only the container ID (made before the survey existed). */
  asked?: 'id-only'
}

export interface PlanRequest<A = unknown> {
  /** Unique within the registry. The ledger line and raw response are `<inspection id>-<id>`. */
  id: string
  /** The ledger line's purpose, in plain words. */
  purpose: string
  /** The progress stages this request counts towards. */
  stages: readonly StageId[]
  /** Requests whose answers this one needs: it starts when they have all answered, never before. */
  after?: readonly PlanRequest[]
  /**
   * Requests this one also waits for, whatever their outcome: it starts once they have settled, and reads
   * their answers when they gave one. One not in the run is not waited for.
   */
  settledAfter?: readonly PlanRequest[]
  /** Whether a run on this route includes the request at all (catalogue-driven). Default: yes. */
  appliesTo?(route: RunRoute): boolean
  /** Once its prerequisites have answered: whether this run still needs it. Default: yes. */
  needed?(plan: PlanView): boolean
  /** A refinement of an answer that is already usable: its failure leaves the stage done and the result complete. */
  optional?: boolean
  /** Wait for the inspection-wide essential/read barrier before charging this request. */
  deferred?: boolean
  /** Builds the questions, sends them on the route with ctx.signal and maps the answer. Throws a ProviderError on failure. */
  send(ctx: RequestContext): Promise<RequestReply<A>>
  /**
   * Reads a recorded raw response as the answer its live reply would have given, through the same mapper
   * `send` uses, for demo mode's replay (./replay.ts). Absent: the request cannot be replayed.
   */
  replay?(raw: unknown, plan: PlanView, extras: ReplayExtras): A
  /**
   * Folds the outcome into the record: the answer mapper's result into this request's own fields, or a
   * note of what did not happen. Called once for every request that was started, in the order they
   * settle; return the record unchanged when there is nothing to add.
   */
  apply(record: InspectionRecord, outcome: RequestOutcome<A>, plan: PlanView): InspectionRecord
}

/**
 * The requests a run on this route makes: those that apply to it and whose prerequisites are also in
 * the plan. Registry order is kept.
 */
export function planFor(requests: readonly PlanRequest[], route: RunRoute): PlanRequest[] {
  let plan = requests.filter((r) => r.appliesTo?.(route) ?? true)
  for (;;) {
    const next = plan.filter((r) => (r.after ?? []).every((p) => plan.includes(p)))
    if (next.length === plan.length) return plan
    plan = next
  }
}

export interface PlanRunOptions {
  requests: readonly PlanRequest[]
  route: RunRoute
  apiKey: string
  photo: Blob
  /** The photo as chosen, for crops at full resolution. */
  original?: Blob
  inspectionId: string
  /** The cost ledger: runs one chargeable call under the per-inspection cap. */
  charge(request: ChargeableRequest): Promise<ChargeableResult>
  /** A request's state changed. */
  onState(states: PlannedRequestState[]): void
  /** A started request settled. Called once per started request, in settle order. */
  onSettled(settled: SettledRequest): void
  /** Several photos share one inspection: `idPrefix` goes ahead of each request's pass id (`p2-`), `purposeSuffix` after its purpose. */
  photoLabel?: { idPrefix: string; purposeSuffix: string }
  beforeDeferred?: Promise<void>
  now?: () => number
}

export interface SettledRequest {
  request: PlanRequest
  outcome: RequestOutcome<unknown>
  /** The reply, for an answered request; otherwise null. */
  reply: RequestReply<unknown> | null
  /** The ledger line and raw response id. */
  passId: string
  plan: PlanView
}

export interface PlanRun {
  /** Settles once every request has settled, been skipped or was never needed. Never rejects. */
  done: Promise<void>
  /** Aborts every request in flight; requests not yet sent never are. */
  cancel(): void
}

const SETTLED: ReadonlySet<RequestState> = new Set([
  'answered',
  'failed',
  'blocked',
  'cancelled',
  'not-needed',
  'skipped',
])

/** Runs a plan: independent requests at once, each dependent one when its prerequisites answer. */
export function runPlan(options: PlanRunOptions): PlanRun {
  const now = options.now ?? (() => Date.now())
  const plan = options.requests
  const states = new Map<PlanRequest, PlannedRequestState>(
    plan.map((r) => [
      r,
      {
        id: r.id,
        stages: [...r.stages],
        state: 'waiting',
        optional: r.optional ?? false,
        startedAt: null,
        settledAt: null,
      },
    ]),
  )
  // By id: several photos' plans run copies of the registry's requests (photoPlan.ts), and a request
  // names the registry's own in `settledAfter` and reads its answer through `answer`.
  const answers = new Map<string, unknown>()
  const controllers = new Map<PlanRequest, AbortController>()
  let cancelled = false
  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => (finish = resolve))

  const view: PlanView = {
    route: options.route,
    answer: <B>(request: PlanRequest<B>) => answers.get(request.id) as B | undefined,
  }
  const stateOf = (r: PlanRequest) => states.get(r)!.state

  function set(r: PlanRequest, state: RequestState) {
    const current = states.get(r)!
    const at = now()
    states.set(r, {
      ...current,
      state,
      startedAt: state === 'sent' ? at : current.startedAt,
      settledAt: SETTLED.has(state) ? at : current.settledAt,
    })
  }

  function publish() {
    options.onState(plan.map((r) => states.get(r)!))
  }

  async function send(r: PlanRequest) {
    const controller = new AbortController()
    controllers.set(r, controller)
    const label = options.photoLabel
    const passId = `${options.inspectionId}-${label?.idPrefix ?? ''}${r.id}`
    if (r.deferred && options.beforeDeferred) {
      const released = await new Promise<boolean>((resolve) => {
        const onAbort = () => resolve(false)
        controller.signal.addEventListener('abort', onAbort, { once: true })
        void options.beforeDeferred!.then(() => {
          controller.signal.removeEventListener('abort', onAbort)
          resolve(!controller.signal.aborted)
        })
        if (controller.signal.aborted) onAbort()
      })
      if (!released) {
        controllers.delete(r)
        const outcome: RequestOutcome<unknown> = { status: 'cancelled' }
        set(r, 'cancelled')
        options.onSettled({ request: r, outcome, reply: null, passId, plan: view })
        advance()
        return
      }
    }
    let reply: RequestReply<unknown> | null = null
    const result = await options.charge({
      id: passId,
      inspectionId: options.inspectionId,
      purpose: r.purpose + (label?.purposeSuffix ?? ''),
      provider: options.route.provider,
      endpoint: options.route.endpoint,
      model: options.route.model,
      signal: controller.signal,
      call: async () => {
        reply = await r.send({
          ...view,
          apiKey: options.apiKey,
          photo: options.photo,
          original: options.original,
          signal: controller.signal,
        })
        return {
          resolvedModel: reply.resolvedModel,
          usage: reply.usage,
          latencyMs: reply.latencyMs,
          reportedCostUsd: reply.reportedCostUsd,
        }
      },
    })
    controllers.delete(r)

    let outcome: RequestOutcome<unknown>
    const answered = result.status === 'ran' ? (reply as RequestReply<unknown> | null) : null
    if (answered) {
      answers.set(r.id, answered.answer)
      outcome = {
        status: 'answered',
        answer: answered.answer,
        resolvedModel: answered.resolvedModel,
      }
    } else if (result.status === 'blocked') {
      outcome = { status: 'blocked', reason: result.reason }
    } else if (result.status === 'cancelled') {
      outcome = { status: 'cancelled' }
    } else {
      outcome = { status: 'failed', error: result.status === 'failed' ? result.error : null }
    }
    set(r, outcome.status)
    options.onSettled({ request: r, outcome, reply: answered, passId, plan: view })
    advance()
  }

  /** Starts, skips or rules out every waiting request whose prerequisites have settled. */
  function advance() {
    let changed = true
    while (changed) {
      changed = false
      for (const r of plan) {
        if (stateOf(r) !== 'waiting') continue
        const prerequisites = r.after ?? []
        let next: RequestState | null = null
        const waitsOn = plan.filter((p) => (r.settledAfter ?? []).some((w) => w.id === p.id))
        if (cancelled) next = 'cancelled'
        else if (!waitsOn.every((p) => SETTLED.has(stateOf(p)))) continue
        else if (prerequisites.some((p) => SETTLED.has(stateOf(p)) && stateOf(p) !== 'answered'))
          next = 'skipped'
        else if (prerequisites.every((p) => stateOf(p) === 'answered'))
          next = (r.needed?.(view) ?? true) ? 'sent' : 'not-needed'
        if (next === null) continue
        set(r, next)
        changed = true
        if (next === 'sent') void send(r)
      }
    }
    publish()
    if (plan.every((r) => SETTLED.has(stateOf(r)))) finish()
  }

  publish()
  // Start on the next tick so the caller holds the run (and can cancel it) before any request is sent.
  queueMicrotask(advance)

  return {
    done,
    cancel() {
      // Nothing left to stop: a run whose requests have all settled is not cancelled.
      if (cancelled || plan.every((r) => SETTLED.has(stateOf(r)))) return
      cancelled = true
      for (const controller of controllers.values()) controller.abort()
      advance()
    },
  }
}

/**
 * Folds one settled request into the record: the request's own fields through its apply, and for an
 * answer, its raw response and (from the first answer) the version that answered.
 */
export function foldSettled(record: InspectionRecord, settled: SettledRequest): InspectionRecord {
  const { request, outcome, reply, passId, plan } = settled
  let next = request.apply(record, outcome, plan)
  if (outcome.status === 'failed') {
    next = {
      ...next,
      failures: [
        ...(next.failures ?? []),
        { ...failureOf(outcome.error), requestId: request.id, stages: request.stages },
      ],
    }
    const unreadable = unreadableBody(outcome.error)
    if (unreadable) {
      next = {
        ...next,
        rawResponses: [
          ...next.rawResponses,
          {
            passId,
            provider: plan.route.provider,
            model: plan.route.model,
            capturedFrom: 'provider',
            body: unreadable.body,
          },
        ],
      }
    }
  }
  if (reply) {
    next = {
      ...next,
      resolvedVersion: next.resolvedVersion || reply.resolvedModel,
      rawResponses: [
        ...next.rawResponses,
        {
          passId,
          provider: plan.route.provider,
          model: plan.route.model,
          capturedFrom: 'provider',
          body: reply.raw,
        },
      ],
    }
  }
  return next
}
