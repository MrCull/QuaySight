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

/** Every stage, in order, with its state from the requests that count towards it. */
export function stageProgress(requests: readonly PlannedRequestState[]): StageProgress[] {
  return RUN_STAGES.map(({ id, title }) => {
    const mine = requests.filter((r) => r.stages.includes(id))
    const state = stateOf(mine)
    return { id, title, state, elapsedMs: elapsedOf(mine, state) }
  })
}

/** Whether a stage has nothing left to wait for in this run. */
export function stageSettled(state: StageState): boolean {
  return state === 'done' || state === 'failed' || state === 'cancelled'
}
