/**
 * Progress stages of a live run (design-system StageProgress). Each request in a run's plan counts
 * towards one or more stages; a stage advances when its requests settle and shows its own failure.
 * Stage titles are plain words: never name passes, retries, questions or candidates.
 */

export type StageId = 'id' | 'details' | 'damage'

export const RUN_STAGES: readonly { id: StageId; title: string }[] = [
  { id: 'id', title: 'Reading the ID' },
  { id: 'details', title: 'Reading container details' },
  { id: 'damage', title: 'Checking for damage' },
]

/**
 * Where one planned request is. waiting: not sent yet (photo being prepared, or its prerequisite has
 * not answered). sent: in flight. answered / failed / cancelled: settled after it was sent; blocked:
 * the cost cap stopped it before sending. not-needed: its prerequisite's answer made it unnecessary.
 * skipped: never sent because a prerequisite did not answer.
 */
export type RequestState =
  | 'waiting'
  | 'sent'
  | 'answered'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | 'not-needed'
  | 'skipped'

export interface PlannedRequestState {
  id: string
  stages: readonly StageId[]
  state: RequestState
  /** An optional request refines a usable answer: its failure leaves its stage done. */
  optional: boolean
  /** The photo it is for (1-based) in a run of several photos; absent in a one-photo run. */
  photo?: number
  /** Clock times in ms, or null before it was sent / settled. */
  startedAt: number | null
  settledAt: number | null
}

/** not-in-run: no request in this run's plan counts towards the stage. */
export type StageState = 'not-in-run' | 'active' | 'done' | 'failed' | 'cancelled'

export interface StageProgress {
  id: StageId
  title: string
  state: StageState
  /** Measured time from the stage's first request sent to its last settled, once settled; otherwise null. */
  elapsedMs: number | null
}

const IN_PROGRESS: ReadonlySet<RequestState> = new Set(['waiting', 'sent'])
const UNANSWERED: ReadonlySet<RequestState> = new Set(['failed', 'blocked', 'skipped'])

function stateOf(requests: PlannedRequestState[]): StageState {
  if (requests.length === 0) return 'not-in-run'
  if (requests.some((r) => IN_PROGRESS.has(r.state))) return 'active'
  if (requests.some((r) => !r.optional && UNANSWERED.has(r.state))) return 'failed'
  if (requests.some((r) => r.state === 'cancelled')) return 'cancelled'
  return 'done'
}

function elapsedOf(requests: PlannedRequestState[], state: StageState): number | null {
  if (state === 'not-in-run' || state === 'active') return null
  const started = requests.flatMap((r) => (r.startedAt === null ? [] : [r.startedAt]))
  const settled = requests.flatMap((r) => (r.settledAt === null ? [] : [r.settledAt]))
  if (started.length === 0 || settled.length === 0) return null
  return Math.max(...settled) - Math.min(...started)
}

/** The requests grouped by photo, in photo order; one group for a one-photo run. */
function byPhoto(requests: readonly PlannedRequestState[]): PlannedRequestState[][] {
  const groups = new Map<number | undefined, PlannedRequestState[]>()
  for (const r of requests) groups.set(r.photo, [...(groups.get(r.photo) ?? []), r])
  return [...groups.entries()].sort(([a], [b]) => (a ?? 0) - (b ?? 0)).map(([, group]) => group)
}

/**
 * A part's state across the photos: it is done once any photo gave it, and failed only when no photo
 * did. A photo that lost its request is named on its own (failedStagesByPhoto).
 */
function combinedState(perPhoto: StageState[]): StageState {
  const states = perPhoto.filter((s) => s !== 'not-in-run')
  if (states.length === 0) return 'not-in-run'
  if (states.includes('active')) return 'active'
  if (states.includes('done')) return 'done'
  if (states.includes('failed')) return 'failed'
  return 'cancelled'
}

/** Every stage, in order, with its state from the requests that count towards it. */
export function stageProgress(requests: readonly PlannedRequestState[]): StageProgress[] {
  const photos = byPhoto(requests)
  return RUN_STAGES.map(({ id, title }) => {
    const mine = requests.filter((r) => r.stages.includes(id))
    const state = combinedState(photos.map((p) => stateOf(p.filter((r) => r.stages.includes(id)))))
    return { id, title, state, elapsedMs: elapsedOf(mine, state) }
  })
}

/** The parts each photo lost: its own stages that failed, whether or not another photo gave them. */
export interface PhotoStageFailure {
  /** 1-based, or null in a one-photo run. */
  photo: number | null
  stages: StageId[]
}

/** Each photo with a failed stage of its own, in photo order. Empty when nothing was lost. */
export function failedStagesByPhoto(requests: readonly PlannedRequestState[]): PhotoStageFailure[] {
  return byPhoto(requests).flatMap((group) => {
    const stages = RUN_STAGES.map((s) => s.id).filter(
      (id) => stateOf(group.filter((r) => r.stages.includes(id))) === 'failed',
    )
    return stages.length > 0 ? [{ photo: group[0]!.photo ?? null, stages }] : []
  })
}

/** Whether a stage has nothing left to wait for in this run. */
export function stageSettled(state: StageState): boolean {
  return state === 'done' || state === 'failed' || state === 'cancelled'
}
