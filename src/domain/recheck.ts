// Automatic re-check of unresolved container-ID positions (spec 5.1, 8.5, 11.3). Pure functions.
// Provider-neutral merge rules: a re-check may only fill positions the first pass left unread.
// It never changes a character already read, and it never shows its own wording in the UI.
import type { CertaintyLabel, ProviderId, RecheckRecord } from './inspection'
import type { ChoiceReading } from './luna'

/** Ledger purpose for the re-check line. Shown in the cost detail, never as pass or retry wording. */
export const RECHECK_PURPOSE = 'Closer look at the ID'

/** Re-check unit: one re-check per container-ID field per photo, covering that field's unread positions. */
export const RECHECK_FIELD = 'containerId'

/** 1-based positions the first pass could not read. */
export function unresolvedPositions(readings: ChoiceReading[]): number[] {
  return readings.flatMap((r, i) => (r.value === null ? [i + 1] : []))
}

export interface MergedReadings {
  readings: ChoiceReading[]
  /** Positions the re-check filled in. */
  resolved: number[]
}

/**
 * Fills the unread positions in `first` from `again`, for the positions asked. A position already read
 * keeps its first-pass character and certainty whatever the re-check says.
 */
export function mergeRecheck(
  first: ChoiceReading[],
  again: ChoiceReading[],
  asked: number[],
): MergedReadings {
  const resolved: number[] = []
  const readings = first.map((reading, i) => {
    const position = i + 1
    if (reading.value !== null || !asked.includes(position)) return reading
    const answer = again[i]
    if (!answer || answer.value === null) return reading
    resolved.push(position)
    return answer
  })
  return { readings, resolved }
}

export type RecheckOutcomeKind = RecheckRecord['outcome']

/** Outcome of a re-check that ran: resolved, partly resolved or unchanged, against the positions asked. */
export function recheckOutcome(asked: number[], resolved: number[]): RecheckOutcomeKind {
  if (resolved.length === 0) return 'unchanged'
  if (asked.every((p) => resolved.includes(p))) return 'resolved'
  return 'partly-resolved'
}

/** What the re-check observed at each asked position, for the export. */
export function observationsOf(
  again: ChoiceReading[],
  asked: number[],
): { position: number; value: string | null; certainty: CertaintyLabel }[] {
  return asked.map((position) => {
    const answer = again[position - 1]
    return {
      position,
      value: answer?.value ?? null,
      certainty: answer?.certainty ?? "Can't tell",
    }
  })
}

export function recheckRecord(input: {
  id: string
  provider: ProviderId
  model: string
  asked: number[]
  resolvedVersion: string | null
  outcome: RecheckOutcomeKind
  resolved: number[]
  observations: RecheckRecord['observations']
  reason?: RecheckRecord['reason']
}): RecheckRecord {
  return {
    id: input.id,
    field: RECHECK_FIELD,
    positions: input.asked,
    provider: input.provider,
    model: input.model,
    resolvedVersion: input.resolvedVersion,
    outcome: input.outcome,
    resolvedPositions: input.resolved,
    observations: input.observations,
    reason: input.reason ?? null,
  }
}
