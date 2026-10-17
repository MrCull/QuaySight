// Certainty rules for container-ID readings (spec 8.4, 5.4). Pure functions, no UI wording.
import type { CertaintyLabel, ContainerIdReading } from './inspection'

/** The five fixed certainty words, most confident first. Nothing else may be shown. */
export const CERTAINTY_LABELS: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]

/** At most this many plausible alternatives are shown ("Also possible: ..."). */
export const MAX_ALTERNATIVES = 2

/**
 * Margin rule (parent spec, Certainty and testing: certainty rests on the margin between alternatives
 * as well as the probability). When the best other character is within this many probability points
 * of the chosen one, the reading is capped one level below what its probability alone gives:
 * 0.90 against 0.88 reads Likely, not Confident. 0.10 is a judgement, not a measured constant: it is
 * wide enough that two near-equal characters never read as settled, and narrow enough that a clear
 * winner (for example 0.90 against 0.40) keeps its level.
 */
export const RUNNER_UP_MARGIN = 0.1

/**
 * Applies the margin rule to a level derived from the chosen probability. `runnerUp` is the best other
 * allowed value's probability, or null when there is none. The cap never goes below "Can't tell".
 */
export function applyMargin(
  label: CertaintyLabel,
  chosen: number,
  runnerUp: number | null,
): CertaintyLabel {
  if (runnerUp === null || chosen - runnerUp >= RUNNER_UP_MARGIN) return label
  const floor = CERTAINTY_LABELS.indexOf("Can't tell")
  const index = CERTAINTY_LABELS.indexOf(label)
  return CERTAINTY_LABELS[Math.min(index + 1, floor)] ?? label
}

/**
 * The level one chosen probability gives before the margin rule: 0.9 Confident, 0.6 Likely,
 * 0.3 Uncertain, below that Can't tell. The thresholds the per-position readings use.
 */
export function certaintyOfProbability(probability: number): CertaintyLabel {
  if (probability >= 0.9) return 'Confident'
  if (probability >= 0.6) return 'Likely'
  if (probability >= 0.3) return 'Uncertain'
  return "Can't tell"
}

/** Marks a character position that was not read. Never filled in as fact. */
export const UNREAD = '?'

/** Fewer characters read than this and the ID is not shown at all. */
export const MIN_READ_CHARACTERS = 6

export type IdResultState = 'settled' | 'uncertain' | 'partial' | 'insufficient'

/** Alternatives to show: at most MAX_ALTERNATIVES, without repeating the best reading. */
export function visibleAlternatives(reading: ContainerIdReading): string[] {
  const best = normalise(reading.value)
  const seen = new Set<string>([best])
  const shown: string[] = []
  for (const alt of reading.alternatives ?? []) {
    const key = normalise(alt)
    if (seen.has(key)) continue
    seen.add(key)
    shown.push(alt)
    if (shown.length === MAX_ALTERNATIVES) break
  }
  return shown
}

/** Which explanation the result needs. Missing positions and weak certainty are never filled in. */
export function idResultState(reading: ContainerIdReading): IdResultState {
  const value = normalise(reading.value)
  const knownChars = [...value].filter((ch) => ch !== UNREAD).length
  if (knownChars < MIN_READ_CHARACTERS) return 'insufficient'
  if (value.includes(UNREAD)) return 'partial'
  if (reading.certainty === 'Confident' || reading.certainty === 'Likely') return 'settled'
  return 'uncertain'
}

function normalise(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}
