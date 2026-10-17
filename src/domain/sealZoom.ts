// The zoomed seal read (ticket #84). Pure.
//
// Once the numbered regions name where the seal is, that area is cut from the full-resolution photo and
// the seal questions are asked again. The zoomed reading and the whole-photo one are two independent
// reads of one number: a character both give is more certain, a character only one gives is taken, and a
// disagreement takes the more certain character at no better than Uncertain. A zoom that finds no seal,
// or reads none of it, changes nothing.
import { CERTAINTY_LABELS } from './certainty'
import { oneStepUp } from './combineReadings'
import type { IdBox } from './cropRead'
import type { CertaintyLabel } from './inspection'
import type { SealCharacter, SealReading } from './sealFamily'

const rank = (l: CertaintyLabel) => CERTAINTY_LABELS.indexOf(l)
const weaker = (a: CertaintyLabel, b: CertaintyLabel) => (rank(a) >= rank(b) ? a : b)
const better = (a: CertaintyLabel, b: CertaintyLabel) => (rank(a) <= rank(b) ? a : b)

const UNREAD: SealCharacter = { value: null, certainty: "Can't tell" }

const hasNumber = (s: SealReading | null | undefined): boolean =>
  Boolean(s?.visible && s.characters.some((c) => c.value !== null))

function unreadCount(s: SealReading): number {
  return s.characters.filter((c) => c.value === null).length
}

function mergeCharacter(a: SealCharacter, b: SealCharacter): SealCharacter {
  if (a.value === null) return b
  if (b.value === null) return a
  if (a.value === b.value) {
    return { value: a.value, certainty: oneStepUp(better(a.certainty, b.certainty)) }
  }
  const best = rank(a.certainty) <= rank(b.certainty) ? a : b
  return { value: best.value, certainty: weaker(best.certainty, 'Uncertain') }
}

function sealOf(characters: SealCharacter[], from: SealReading): SealReading {
  const read = characters.filter((c) => c.value !== null)
  const certainty: CertaintyLabel =
    read.length === 0
      ? "Can't tell"
      : [
          ...read.map((c) => c.certainty),
          ...(read.length < characters.length ? (['Uncertain'] as const) : []),
        ].reduce(weaker)
  return {
    ...from,
    visible: true,
    characters,
    value: characters.map((c) => c.value ?? '?').join(''),
    certainty,
  }
}

/**
 * The seal after the zoomed read joins the whole-photo one. `full` is the survey's reading (absent when
 * it gave none); `zoom` is the zoomed read of the area the regions named.
 */
export function combineSealReads(
  full: SealReading | null | undefined,
  zoom: SealReading | null,
): SealReading | null {
  if (!zoom || !hasNumber(zoom)) return full ?? null
  if (!full || !hasNumber(full)) {
    // The survey saw no seal number: the zoomed read is the only one. Its box stays the survey's, if any.
    return { ...zoom, ...(full?.box ? { box: full.box } : {}) }
  }
  if (full.characters.length === zoom.characters.length) {
    return sealOf(
      full.characters.map((c, i) => mergeCharacter(c, zoom.characters[i] ?? UNREAD)),
      full,
    )
  }
  // Counted differently: the reading with fewer unread places stands, the closer look on a tie.
  const zoomWins = unreadCount(zoom) <= unreadCount(full)
  return zoomWins ? sealOf(zoom.characters, full) : full
}

/** What the zoomed seal read did, for the export. Never shown. */
export interface SealZoomRecord {
  outcome: 'combined' | 'failed' | 'cancelled' | 'skipped-cap'
  /** The area the crop was cut around, as fractions of the photo, and the marks the model named for it. */
  box: IdBox
  marks: number[]
  crop: { x: number; y: number; width: number; height: number; sentWidth: number; sentHeight: number } | null
  resolvedVersion: string | null
  reason: 'requests' | 'spend' | null
}

declare module './inspection' {
  interface InspectionRecord {
    /** The zoomed read of the seal (ticket #84), when one was started. Absent on other runs. */
    sealZoomRead?: SealZoomRecord
  }
}
