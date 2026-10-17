// Combining the readings of several photos of one container (spec #51, ticket #70). Pure.
//
// The agreement rule, for every reading that more than one photo gives:
// - the same reading in two photos rises one certainty step (Likely to Confident);
// - a disagreement is Uncertain, with the other reading kept as the alternative;
// - nothing goes past what the check digit allows (a container ID whose check digit fails is never Confident).
// A reading that only one photo gives is kept as it is.
import { MAX_ALTERNATIVES, UNREAD } from './certainty'
import { idCertainty, ownerIsListed } from './idConfidence'
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
  /** The other reading, when the photos disagreed and it was not dropped as a weaker lone outlier. */
  alternative: T | null
  /** Votes for the chosen value (each whole-photo read and each zoomed read is one vote). */
  votes: number
  /** A lone weaker reading that disagreed with two or more agreeing votes: dropped, certainty not lowered. */
  dropped: T | null
}

/**
 * The agreement rule for one reading across photos. `same` says when two values are the same reading.
 * Candidates are in photo order; a reading with no certainty (Not seen) is skipped when any photo saw it.
 * Two or more agreeing votes raise certainty one step; a lone weaker disagreeing vote is dropped without
 * lowering it; only a conflict between strong readings (or a tie of votes) lowers it to Uncertain at best.
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
      votes: winner.length,
      dropped: null,
    }
  }
  // Readings weaker than the winner's that are not strong themselves (below Likely), or a lone one against two
  // or more agreeing votes, are outliers: dropped, the certainty not lowered. Only a conflict between strong
  // readings, or between equal ones, lowers it.
  const rest = ordered.slice(1)
  const droppable = (g: Candidate<T>[]) =>
    rank(best(g).certainty) > rank(top.certainty) &&
    (rank(best(g).certainty) > rank('Likely') || (winner.length > 1 && g.length === 1))
  if (rest.every(droppable)) {
    return {
      value: top.value,
      certainty: winner.length > 1 ? oneStepUp(top.certainty) : top.certainty,
      from: winner.map((c) => c.photo),
      alternative: null,
      votes: winner.length,
      dropped: rest[0]![0]!.value,
    }
  }
  return {
    value: top.value,
    certainty: weakerOf(top.certainty, 'Uncertain'),
    from: winner.map((c) => c.photo),
    alternative: ordered[1]![0]!.value,
    votes: winner.length,
    dropped: null,
  }
}

// ---------------------------------------------------------------------------------------------------
// The container ID

export interface IdSource {
  /** 1-based photo number. */
  photo: number
  /** The photo's own reading of the ID. */
  reading: ContainerIdReading
  /**
   * The independent reads behind it, each one vote per position: the whole-photo read and the zoomed
   * read (ticket #86). Absent: the reading itself is the one vote.
   */
  reads?: readonly IdRead[]
}

/** One independent read, with the character each position was next likely to be (what the check digit may pick instead). */
export type IdRead = ContainerIdReading & {
  runnerUps?: readonly ({ value: string; certainty: CertaintyLabel } | null)[]
}

declare module './inspection' {
  interface ContainerIdReading {
    /** Several photos (ticket #86): the 1-based photo whose read won, so a close-up is cut from that photo. */
    photo?: number
  }
}

export type IdCombination =
  | {
      kind: 'combined'
      reading: ContainerIdReading
      /** For each photo, the 1-based positions of the ID that were taken from it. */
      taken: Record<number, number[]>
      /** The photo whose reads won the most positions, the most certain first, then the earlier photo. */
      winner: number
    }
  /** Two photos each read a different complete ID that passes the check digit: not one container. */
  | { kind: 'different'; ids: string[] }

const passesCheck = (id: string) => /^[A-Z]{4}\d{7}$/.test(id) && checkDigitMatches(id)
const normalised = (r: ContainerIdReading) =>
  r.value.replace(/\s+/g, '').toUpperCase().padEnd(11, UNREAD).slice(0, 11)

/**
 * Combines the container IDs of several photos character by character. Each position takes the most
 * certain reading by the agreement rule; where photos disagree, a combination that passes the check
 * digit wins. Two different complete IDs that both pass the check digit are not combined.
 * With one source, its reading is returned unchanged.
 */
export function combineContainerIds(sources: readonly IdSource[]): IdCombination | null {
  if (sources.length === 0) return null
  if (sources.length === 1 && (sources[0]!.reads?.length ?? 0) < 2) {
    const only = sources[0]!
    const taken = [...normalised(only.reading)].flatMap((c, i) => (c === UNREAD ? [] : [i + 1]))
    return {
      kind: 'combined',
      reading: only.reading,
      taken: { [only.photo]: taken },
      winner: only.photo,
    }
  }

  // Only a complete, check-digit-passing ID that is at least Likely votes for "different containers".
  const strong = (r: ContainerIdReading) => r.certainty === 'Confident' || r.certainty === 'Likely'
  const validOwn = [
    ...new Set(
      sources
        .filter((s) => strong(s.reading))
        .map((s) => normalised(s.reading))
        .filter(passesCheck),
    ),
  ]
  if (validOwn.length > 1) return { kind: 'different', ids: validOwn }

  const positions = Array.from({ length: 11 }, (_, i) => {
    const candidates: Candidate<string>[] = sources.flatMap((s) =>
      (s.reads ?? [s.reading]).flatMap((read) => {
        const ch = normalised(read)[i]!
        if (ch === UNREAD) return []
        return [
          { value: ch, certainty: read.positionCertainty?.[i] ?? read.certainty, photo: s.photo },
        ]
      }),
    )
    // What a read's character was next likely to be: never a vote, only what the check digit may pick instead.
    const runnerUps: Candidate<string>[] = sources.flatMap((s) =>
      (s.reads ?? []).flatMap((read) => {
        const next = read.runnerUps?.[i]
        return next ? [{ value: next.value, certainty: next.certainty, photo: s.photo }] : []
      }),
    )
    return { candidates, runnerUps, agreed: agree(candidates) }
  })

  // Every character any photo read at each position: the combinations the check digit can choose among.
  const options = positions.map((p) => [
    ...new Set([...p.candidates, ...p.runnerUps].map((c) => c.value)),
  ])
  const chosen = positions.map((p) => p.agreed?.value ?? UNREAD)
  let id = chosen.join('')
  if (!passesCheck(id) && positions.every((p) => p.candidates.length > 0)) {
    const found = firstPassing(options, chosen, positions)
    if (found) id = found
  }

  const certainty: CertaintyLabel[] = []
  const alternatives: string[] = []
  // Two independent reads (two photos) agree on every one of the 11 characters.
  let corroborated = true
  const taken: Record<number, number[]> = {}
  positions.forEach((p, i) => {
    const ch = id[i]!
    if (ch === UNREAD || !p.agreed) {
      certainty.push("Can't tell")
      corroborated = false
      return
    }
    const mine = p.candidates.filter((c) => c.value === ch)
    if (mine.length === 0) {
      // Picked by the check digit from what the reads called their next choice: Uncertain, or Likely when
      // two independent reads named it.
      const named = p.runnerUps.filter((c) => c.value === ch)
      certainty.push(named.length > 1 ? 'Likely' : 'Uncertain')
      corroborated = false
      for (const photo of new Set(named.map((c) => c.photo))) (taken[photo] ??= []).push(i + 1)
      return
    }
    // The check digit may have picked a reading other than the rule's: that reading is judged by the rule too.
    // A weaker or lone reading against agreeing votes is dropped (agree); so are readings whose character
    // would fail the check digit where the chosen ID passes it.
    const others = p.candidates.filter((c) => c.value !== ch)
    const failsCheck = (other: string) =>
      passesCheck(id) && !passesCheck(id.slice(0, i) + other + id.slice(i + 1))
    const outlier = mine.length > 1 && others.every((c) => failsCheck(c.value))
    const decided = ch === p.agreed.value && !outlier ? p.agreed : agree(mine)!
    const disagreed = others.length > 0 && !outlier && decided.dropped === null
    if (disagreed || mine.length < 2) corroborated = false
    certainty.push(disagreed ? weakerOf(decided.certainty, 'Uncertain') : decided.certainty)
    for (const photo of new Set(mine.map((c) => c.photo))) (taken[photo] ??= []).push(i + 1)
    if (disagreed) {
      const other = p.candidates.find((c) => c.value !== ch)!.value
      alternatives.push(id.slice(0, i) + other + id.slice(i + 1))
    }
  })

  const printed = id
  const overall = idCertainty({ id: printed, positionCertainty: certainty, corroborated })
  const reading: ContainerIdReading = printed.includes(UNREAD)
    ? partialReading(printed, overall, certainty)
    : { ...buildContainerIdReading({ printed, certainty: overall }), positionCertainty: certainty }
  // Only readings that pass the check digit are offered, none beside a Confident one that passes, listed owners first.
  const shown = [...new Set(alternatives)]
    .filter(passesCheck)
    .sort((a, b) => Number(ownerIsListed(b)) - Number(ownerIsListed(a)))
    .slice(0, MAX_ALTERNATIVES)
  if (shown.length > 0 && !(overall === 'Confident' && passesCheck(printed))) {
    reading.alternatives = shown
  }
  return { kind: 'combined', reading, taken, winner: winningPhoto(positions, id) }
}

/** The photo whose votes matched the most characters of the ID; the more certain, then the earlier photo, settles a tie. */
function winningPhoto(
  positions: readonly { candidates: Candidate<string>[] }[],
  id: string,
): number {
  const score = new Map<number, { matched: number; weakest: number }>()
  positions.forEach((p, i) => {
    for (const c of p.candidates) {
      if (c.value !== id[i]) continue
      const own = score.get(c.photo) ?? { matched: 0, weakest: 0 }
      own.matched += 1
      own.weakest += rank(c.certainty)
      score.set(c.photo, own)
    }
  })
  const best = [...score.entries()].sort(
    ([pa, a], [pb, b]) => b.matched - a.matched || a.weakest - b.weakest || pa - pb,
  )[0]
  return best?.[0] ?? 1
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

/** Most positions the check digit may change from the chosen reading. */
const MAX_SWAPS = 3

/**
 * The combination of the read characters that passes the check digit with the fewest positions changed
 * from the chosen reading; among those, the one whose changed characters were read most certainly.
 */
function firstPassing(
  options: string[][],
  chosen: string[],
  positions: readonly { candidates: Candidate<string>[]; runnerUps: Candidate<string>[] }[],
): string | null {
  const open = options.map((o, i) => (o.length > 1 ? i : -1)).filter((i) => i >= 0)
  // How well a character at a position is supported: by how many reads name it (as their reading or their
  // next choice), then by how certainly the best of them did (a next choice counts a step lower).
  const weight = (position: number, ch: string) => {
    const p = positions[position]!
    const own = p.candidates.filter((c) => c.value === ch).map((c) => rank(c.certainty))
    const next = p.runnerUps.filter((c) => c.value === ch).map((c) => rank(c.certainty) + 1)
    const support = Math.min(own.length + next.length, ORDER.length)
    return (ORDER.length + 1 - support) * 10 + Math.min(...own, ...next, ORDER.length)
  }
  let best: { id: string; cost: number } | null = null
  const walk = (from: number, left: number, id: string[], cost: number) => {
    if (id.join('') !== chosen.join('') && passesCheck(id.join(''))) {
      if (!best || cost < best.cost) best = { id: id.join(''), cost }
    }
    if (left === 0) return
    for (let k = from; k < open.length; k++) {
      const position = open[k]!
      for (const ch of options[position]!) {
        if (ch === chosen[position]) continue
        id[position] = ch
        walk(k + 1, left - 1, id, cost + weight(position, ch))
      }
      id[position] = chosen[position]!
    }
  }
  for (let swaps = 1; swaps <= MAX_SWAPS && !best; swaps++) walk(0, swaps, [...chosen], 0)
  return (best as { id: string } | null)?.id ?? null
}
