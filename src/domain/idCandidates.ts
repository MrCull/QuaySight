// Ranks candidate container IDs built from per-character readings (spec 4.1, 4.2). Pure.
// A candidate is the best reading with some characters swapped for their runner-ups. Candidates that
// pass the check digit rank above those that fail; the app calculates the check digit, never the model.
import { CERTAINTY_LABELS, MAX_ALTERNATIVES, UNREAD } from './certainty'
import { idCertainty, ownerIsListed, passesCheckDigit } from './idConfidence'
import { ownerCodeRank } from './ownerCodes'
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
  /** Other candidates that pass the check digit, listed owners first, at most MAX_ALTERNATIVES. Empty when the best reading is Confident and passes. */
  alternatives: string[]
  /** Certainty of each position of the top candidate: a swapped position takes its runner-up's certainty. */
  positionCertainty: CertaintyLabel[]
  /** The top candidate's certainty as a whole (see idConfidence). */
  certainty: CertaintyLabel
}

const SWAP_LIMIT = 12

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  return CERTAINTY_LABELS[Math.max(...labels.map((l) => CERTAINTY_LABELS.indexOf(l)))]!
}

/** A character taken from its runner-up counts at the runner-up's certainty, no worse than Uncertain (the check digit chose it). */
function swappedCertainty(reading: ChoiceReading): CertaintyLabel {
  const label = reading.runnerUpCertainty ?? reading.certainty
  const floor = CERTAINTY_LABELS.indexOf('Uncertain')
  return CERTAINTY_LABELS.indexOf(label) > floor ? 'Uncertain' : label
}

function passes(chars: string[]): boolean {
  return passesCheckDigit(chars.join(''))
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
 * by the candidate's own certainty, then fewer swaps, then earlier positions), and picks the best. When the best is Likely or Confident, passes,
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
  corroborated = false,
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
        const own = worstOf(
          readings.map((r, i) =>
            swapped.includes(i) ? (r.runnerUpCertainty ?? r.certainty) : r.certainty,
          ),
        )
        return {
          chars: candidate,
          swapped: all,
          passes: passes(candidate),
          runnerSwaps: swapped,
          own: CERTAINTY_LABELS.indexOf(own),
        }
      }),
    )
    .sort((a, b) => {
      if (a.passes !== b.passes) return a.passes ? -1 : 1
      if (a.own !== b.own) return a.own - b.own
      if (a.swapped.length !== b.swapped.length) return a.swapped.length - b.swapped.length
      return (
        compareSwaps(a.swapped, b.swapped) ||
        (ownerCodeRank(a.chars.slice(0, 4).join('')) ?? Infinity) -
          (ownerCodeRank(b.chars.slice(0, 4).join('')) ?? Infinity)
      )
    })
    .filter((c) => {
      const key = c.chars.join('')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const [best, ...rest] = candidates
  // A character taken from a runner-up counts at the runner-up's certainty, but no worse than Uncertain:
  // the check digit passing is what chose it.
  const positionCertainty = readings.map((r, i) =>
    best!.runnerSwaps.includes(i) ? swappedCertainty(r) : r.certainty,
  )
  const certainty = idCertainty({
    id: best!.chars.join(''),
    positionCertainty,
    corroborated,
    ceiling,
  })
  const alternatives =
    best!.passes && certainty === 'Confident'
      ? []
      : rest
          .filter((c) => c.passes)
          .map((c) => c.chars.join(''))
          // Stable: listed owners first, the rank order above kept within each group.
          .sort((a, b) => Number(ownerIsListed(b)) - Number(ownerIsListed(a)))
          .slice(0, MAX_ALTERNATIVES)
  return { chars: best!.chars, alternatives, positionCertainty, certainty }
}
