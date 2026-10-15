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

/** Marks a character position that was not read. Never filled in as fact. */
export const UNREAD = '?'

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
  if (knownChars === 0) return 'insufficient'
  if (value.includes(UNREAD)) return 'partial'
  if (reading.certainty === 'Confident' || reading.certainty === 'Likely') return 'settled'
  return 'uncertain'
}

function normalise(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}
