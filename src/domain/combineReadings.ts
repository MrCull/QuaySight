// Combining the readings of several photos of one container (spec #51, ticket #70). Pure.
//
// The agreement rule, for every reading that more than one photo gives:
// - the same reading in two photos rises one certainty step (Likely to Confident);
// - a disagreement is Uncertain, with the other reading kept as the alternative;
// - nothing goes past what the check digit allows (a container ID whose check digit fails is never Confident).
// A reading that only one photo gives is kept as it is.
import { UNREAD } from './certainty'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import { buildContainerIdReading } from './containerId'
import { checkDigitMatches } from './iso6346'

const ORDER: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]
const rank = (c: CertaintyLabel) => ORDER.indexOf(c)

/** The weaker of two certainty words. */
export function weakerOf(a: CertaintyLabel, b: CertaintyLabel): CertaintyLabel {
  return rank(a) >= rank(b) ? a : b
}

/** One step more certain; Confident stays, and a reading that was not seen or cannot be told is not raised. */
export function oneStepUp(c: CertaintyLabel): CertaintyLabel {
  if (c === 'Likely') return 'Confident'
  if (c === 'Uncertain') return 'Likely'
  return c
}

/** A reading as one photo gave it, for the agreement rule. */
export interface Candidate<T> {
  value: T
  certainty: CertaintyLabel
  /** 1-based photo number. */
  photo: number
}

export interface Agreed<T> {
  value: T
  certainty: CertaintyLabel
  /** The photos whose reading was taken (every photo that gave the chosen value). */
  from: number[]
  /** The other reading, when the photos disagreed. */
  alternative: T | null
}

/**
 * The agreement rule for one reading across photos. `same` says when two values are the same reading.
 * Candidates are in photo order; a reading with no certainty (Not seen) is skipped when any photo saw it.
 */
export function agree<T>(
  candidates: readonly Candidate<T>[],
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): Agreed<T> | null {
  if (candidates.length === 0) return null
  const groups: Candidate<T>[][] = []
  for (const c of candidates) {
    const group = groups.find((g) => same(g[0]!.value, c.value))
    if (group) group.push(c)
    else groups.push([c])
  }
  const best = (g: Candidate<T>[]) =>
    g.reduce((a, c) => (rank(c.certainty) < rank(a.certainty) ? c : a))
  // The group with the most certain reading wins; more photos, then the earlier photo, settle a tie.
  const ordered = [...groups].sort(
    (a, b) =>
      rank(best(a).certainty) - rank(best(b).certainty) ||
      b.length - a.length ||
      a[0]!.photo - b[0]!.photo,
  )
  const winner = ordered[0]!
  const top = best(winner)
  if (groups.length === 1) {
    return {
      value: top.value,
      certainty: winner.length > 1 ? oneStepUp(top.certainty) : top.certainty,
      from: winner.map((c) => c.photo),
      alternative: null,
    }
  }
  return {
    value: top.value,
    certainty: weakerOf(top.certainty, 'Uncertain'),
    from: winner.map((c) => c.photo),
    alternative: ordered[1]![0]!.value,
  }
}

// ---------------------------------------------------------------------------------------------------
// The container ID

export interface IdSource {
  /** 1-based photo number. */
  photo: number
  reading: ContainerIdReading
}

export type IdCombination =
  | {
      kind: 'combined'
      reading: ContainerIdReading
      /** For each photo, the 1-based positions of the ID that were taken from it. */
      taken: Record<number, number[]>
    }
  /** Two photos each read a different complete ID that passes the check digit: not one container. */
  | { kind: 'different'; ids: string[] }

const passesCheck = (id: string) => /^[A-Z]{4}\d{7}$/.test(id) && checkDigitMatches(id)
const normalised = (r: ContainerIdReading) =>
  r.value.replace(/\s+/g, '').toUpperCase().padEnd(11, UNREAD).slice(0, 11)

/** The ID's weakest known position, the way a single photo's reading takes its overall certainty. */
function weakest(certainties: CertaintyLabel[]): CertaintyLabel {
  return certainties.reduce<CertaintyLabel>((a, c) => weakerOf(a, c), 'Confident')
}

/**
 * Combines the container IDs of several photos character by character. Each position takes the most
 * certain reading by the agreement rule; where photos disagree, a combination that passes the check
 * digit wins. Two different complete IDs that both pass the check digit are not combined.
 * With one source, its reading is returned unchanged.
 */
export function combineContainerIds(sources: readonly IdSource[]): IdCombination | null {
  if (sources.length === 0) return null
  if (sources.length === 1) {
    const only = sources[0]!
    const taken = [...normalised(only.reading)].flatMap((c, i) => (c === UNREAD ? [] : [i + 1]))
    return { kind: 'combined', reading: only.reading, taken: { [only.photo]: taken } }
  }

  const validOwn = [...new Set(sources.map((s) => normalised(s.reading)).filter(passesCheck))]
  if (validOwn.length > 1) return { kind: 'different', ids: validOwn }

  const positions = Array.from({ length: 11 }, (_, i) => {
    const candidates: Candidate<string>[] = sources.flatMap((s) => {
      const ch = normalised(s.reading)[i]!
      if (ch === UNREAD) return []
      return [
        {
          value: ch,
          certainty: s.reading.positionCertainty?.[i] ?? s.reading.certainty,
          photo: s.photo,
        },
      ]
    })
    return { candidates, agreed: agree(candidates) }
  })

  // Every character any photo read at each position: the combinations the check digit can choose among.
  const options = positions.map((p) => [...new Set(p.candidates.map((c) => c.value))])
  const chosen = positions.map((p) => p.agreed?.value ?? UNREAD)
  let id = chosen.join('')
  if (!passesCheck(id) && options.every((o) => o.length > 0)) {
    const found = firstPassing(options, chosen)
    if (found) id = found
  }

  const certainty: CertaintyLabel[] = []
  const alternatives: string[] = []
  const taken: Record<number, number[]> = {}
  positions.forEach((p, i) => {
    const ch = id[i]!
    if (ch === UNREAD || !p.agreed) {
      certainty.push("Can't tell")
      return
    }
    const mine = p.candidates.filter((c) => c.value === ch)
    // The check digit may have picked a reading other than the rule's: that reading is judged by the rule too.
    const decided = ch === p.agreed.value ? p.agreed : agree(mine)!
    const disagreed = new Set(p.candidates.map((c) => c.value)).size > 1
    certainty.push(disagreed ? weakerOf(decided.certainty, 'Uncertain') : decided.certainty)
    for (const photo of mine.map((c) => c.photo)) (taken[photo] ??= []).push(i + 1)
    if (disagreed) {
      const other = p.candidates.find((c) => c.value !== ch)!.value
      alternatives.push(id.slice(0, i) + other + id.slice(i + 1))
    }
  })

  const printed = id
  const overall = weakest(certainty)
  const reading: ContainerIdReading = printed.includes(UNREAD)
    ? partialReading(printed, overall, certainty)
    : { ...buildContainerIdReading({ printed, certainty: overall }), positionCertainty: certainty }
  if (alternatives.length > 0) reading.alternatives = alternatives
  return { kind: 'combined', reading, taken }
}

function partialReading(
  printed: string,
  certainty: CertaintyLabel,
  positionCertainty: CertaintyLabel[],
): ContainerIdReading {
  return {
    value: printed,
    observedCheckDigit: printed[10] === UNREAD ? null : Number(printed[10]),
    calculatedCheckDigit: null,
    checkDigitValid: false,
    certainty,
    provenance: 'printed',
    positionCertainty,
  }
}

/** The first combination of the read characters (the chosen ones first) that passes the check digit. */
function firstPassing(options: string[][], chosen: string[]): string | null {
  const open = options.map((o, i) => (o.length > 1 ? i : -1)).filter((i) => i >= 0)
  if (open.length === 0 || open.length > 8) return null
  let found: string | null = null
  let fewestSwaps = Infinity
  const walk = (at: number, id: string[], swaps: number) => {
    if (at === open.length) {
      const text = id.join('')
      if (swaps < fewestSwaps && passesCheck(text)) {
        found = text
        fewestSwaps = swaps
      }
      return
    }
    const position = open[at]!
    for (const ch of options[position]!) {
      id[position] = ch
      walk(at + 1, id, swaps + (ch === chosen[position] ? 0 : 1))
    }
    id[position] = chosen[position]!
  }
  walk(0, [...chosen], 0)
  return found
}
