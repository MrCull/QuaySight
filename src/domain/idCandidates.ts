// Ranks candidate container IDs built from per-character readings (spec 4.1, 4.2). Pure.
// A candidate is the best reading with some characters swapped for their runner-ups. Candidates that
// pass the check digit rank above those that fail; the app calculates the check digit, never the model.
import { CERTAINTY_LABELS, MAX_ALTERNATIVES, UNREAD } from './certainty'
import { checkDigitMatches } from './iso6346'
import type { CertaintyLabel } from './inspection'
import type { ChoiceReading } from './idQuestions'

/** The equipment-category letter (4th character) is always U for this product. */
const CATEGORY_POSITION = 4
const CATEGORY_LETTER = 'U'
/** The first three characters are the owner letters. */
const OWNER_LETTERS = 3

/** Sets position 4 to U whatever came back. A position that was not read at all stays unread. */
export function withCategoryLetter(readings: ChoiceReading[]): ChoiceReading[] {
  return readings.map((reading, index) =>
    index === CATEGORY_POSITION - 1 && reading.value !== null
      ? { ...reading, value: CATEGORY_LETTER, runnerUp: null }
      : reading,
  )
}

export interface RankedIds {
  /** The top-ranked candidate, as one character per position. */
  chars: string[]
  /** Other candidates in rank order, at most MAX_ALTERNATIVES. Empty when the best reading stands alone. */
  alternatives: string[]
}

const SWAP_LIMIT = 12

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  return CERTAINTY_LABELS[Math.max(...labels.map((l) => CERTAINTY_LABELS.indexOf(l)))]!
}

function passes(chars: string[]): boolean {
  return !chars.includes(UNREAD) && checkDigitMatches(chars.join(''))
}

/** Earlier swapped positions first, so single swaps keep their position order. */
function compareSwaps(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!
  }
  return a.length - b.length
}

/**
 * Builds every candidate from the readings and their runner-ups, ranks the passing ones first (then
 * fewer swaps, then earlier positions), and picks the best. When the best is Likely or Confident, passes,
 * and no other candidate passes, there are no alternatives to show. "Likely or Confident" is judged on the
 * winning candidate's own certainty: the worst across its positions, taking a swapped position's runner-up
 * certainty, and no better than `ceiling` (the caveats on the whole photo). `ownerAlternatives` are other
 * three-letter owner prefixes (the losing owner reading, near matches in the owner-code list) that
 * compete as candidates on the same terms; the first counts as one swap, the rest one swap per letter changed, plus one.
 */
export function rankIdCandidates(
  readings: ChoiceReading[],
  ceiling: CertaintyLabel,
  ownerAlternatives: string[] = [],
): RankedIds {
  const chars = readings.map((r) => r.value ?? UNREAD)
  const swappable = readings
    .flatMap((r, i) => (r.runnerUp === null ? [] : [i]))
    .slice(0, SWAP_LIMIT)

  const variants = [
    { start: chars, changed: [] as number[], swappable },
    ...ownerAlternatives.map((prefix, n) => {
      const start = chars.map((ch, i) => (i < OWNER_LETTERS ? (prefix[i] ?? ch) : ch))
      const letters = start.flatMap((ch, i) => (ch === chars[i] ? [] : [i]))
      // The first alternative is the losing reading: one swap, ahead of near matches, which cost a swap
      // per letter they change on top of that.
      const changed = n === 0 ? [0] : [0, ...letters]
      return { start, changed, swappable: swappable.filter((i) => i >= OWNER_LETTERS) }
    }),
  ]

  const seen = new Set<string>()
  const candidates = variants
    .flatMap(({ start, changed, swappable: free }) =>
      Array.from({ length: 1 << free.length }, (_, mask) => {
        const swapped = free.filter((_, bit) => (mask >> bit) & 1)
        const candidate = [...start]
        for (const index of swapped) candidate[index] = readings[index]!.runnerUp!
        const all = [...changed, ...swapped].sort((a, b) => a - b)
        return { chars: candidate, swapped: all, passes: passes(candidate), runnerSwaps: swapped }
      }),
    )
    .sort((a, b) => {
      if (a.passes !== b.passes) return a.passes ? -1 : 1
      if (a.swapped.length !== b.swapped.length) return a.swapped.length - b.swapped.length
      return compareSwaps(a.swapped, b.swapped)
    })
    .filter((c) => {
      const key = c.chars.join('')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const [best, ...rest] = candidates
  const certainty = worstOf([
    ceiling,
    ...readings.map((r, i) =>
      best!.runnerSwaps.includes(i) ? (r.runnerUpCertainty ?? r.certainty) : r.certainty,
    ),
  ])
  const settled = best!.passes && (certainty === 'Confident' || certainty === 'Likely')
  const alone = settled && !rest.some((c) => c.passes)
  return {
    chars: best!.chars,
    alternatives: alone ? [] : rest.slice(0, MAX_ALTERNATIVES).map((c) => c.chars.join('')),
  }
}
