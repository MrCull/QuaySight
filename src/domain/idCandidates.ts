// Ranks candidate container IDs built from per-character readings (spec 4.1, 4.2). Pure.
// A candidate is the best reading with some characters swapped for their runner-ups. Candidates that
// pass the check digit rank above those that fail; the app calculates the check digit, never the model.
import { MAX_ALTERNATIVES, UNREAD } from './certainty'
import { checkDigitMatches } from './iso6346'
import type { CertaintyLabel } from './inspection'
import type { ChoiceReading } from './idQuestions'

/** The equipment-category letter (4th character) is always U for this product. */
const CATEGORY_POSITION = 4
const CATEGORY_LETTER = 'U'

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
 * and no other candidate passes, there are no alternatives to show.
 */
export function rankIdCandidates(readings: ChoiceReading[], certainty: CertaintyLabel): RankedIds {
  const chars = readings.map((r) => r.value ?? UNREAD)
  const swappable = readings
    .flatMap((r, i) => (r.runnerUp === null ? [] : [i]))
    .slice(0, SWAP_LIMIT)

  const candidates = Array.from({ length: 1 << swappable.length }, (_, mask) => {
    const swapped = swappable.filter((_, bit) => (mask >> bit) & 1)
    const candidate = [...chars]
    for (const index of swapped) candidate[index] = readings[index]!.runnerUp!
    return { chars: candidate, swapped, passes: passes(candidate) }
  }).sort((a, b) => {
    if (a.passes !== b.passes) return a.passes ? -1 : 1
    if (a.swapped.length !== b.swapped.length) return a.swapped.length - b.swapped.length
    return compareSwaps(a.swapped, b.swapped)
  })

  const [best, ...rest] = candidates
  const settled = best!.passes && (certainty === 'Confident' || certainty === 'Likely')
  const alone = settled && !rest.some((c) => c.passes)
  return {
    chars: best!.chars,
    alternatives: alone ? [] : rest.slice(0, MAX_ALTERNATIVES).map((c) => c.chars.join('')),
  }
}
