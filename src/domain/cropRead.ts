// Reading the container ID from a crop (spec #27, ticket #31). Pure.
//
// On box-capable models the ID request also asks where the ID is. With a usable box, the prepared photo
// is cropped around the ID with a margin, scaled up within the model's photo limits and the same
// group-position character questions are asked again. The full-photo and crop readings are then combined
// per character: the more confident one wins, a disagreement is recorded, and the shared certainty rules
// apply. On COYU 266813 0 (16 Oct 2026) Jev read one wrong digit on the full photo and every character at
// about 1.0 from the crop. Luna read worse from a crop, so it never gets one.
import { applyMargin, CERTAINTY_LABELS } from './certainty'
import type { ChoiceReading } from './idQuestions'
import type { CertaintyLabel } from './inspection'
import { largestWithin, type PhotoSize } from './photoFit'
import type { PhotoLimits } from './providers'

/** A box as a fraction (0..1) of the photo it was asked on, with the model's confidence in it. */
export interface IdBox {
  top: number
  bottom: number
  left: number
  right: number
  confidence: number
}

/** Below this the model is not sure it found the ID: no crop is made. */
export const USABLE_BOX_CONFIDENCE = 0.5
/** A box narrower or lower than this fraction of the photo is too small to crop from. */
const MIN_BOX_FRACTION = 0.01
/**
 * Space kept around the box on every side, as a fraction of the box's long side. Boxes are drawn
 * tight and sometimes short: Jev's COYU box (16 Oct 2026) stopped before the "CO" and the boxed check
 * digit, which 0.35 brings back in.
 */
export const CROP_MARGIN = 0.35

/** The box, when a crop can be made from it; otherwise null (no crop request is made). */
export function usableIdBox(box: IdBox | null | undefined): IdBox | null {
  if (!box) return null
  if (box.confidence < USABLE_BOX_CONFIDENCE) return null
  if (box.right - box.left < MIN_BOX_FRACTION || box.bottom - box.top < MIN_BOX_FRACTION) {
    return null
  }
  return box
}

/** Where to cut, in the prepared photo's pixels, and the size the crop is sent at. */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
  outWidth: number
  outHeight: number
}

/** Widens [lo, hi] to `want` about its centre, inside [0, max], shifting off an edge it meets. */
function widen(lo: number, hi: number, want: number, max: number): [number, number] {
  if (hi - lo >= want) return [lo, hi]
  const centre = (lo + hi) / 2
  let a = centre - want / 2
  let b = centre + want / 2
  if (a < 0) [a, b] = [0, b - a]
  if (b > max) [a, b] = [a - (b - max), max]
  return [Math.max(0, a), Math.min(max, b)]
}

/**
 * The crop for a box on a photo of this size: the box with a margin, kept inside the photo, widened
 * where needed so it can be scaled to the model's minimum short side, then scaled up (or down) to the
 * largest size within the model's side and pixel limits, aspect ratio kept. Null when no such size exists.
 */
export function cropRegion(photo: PhotoSize, box: IdBox, limits: PhotoLimits): CropRegion | null {
  const boxWidth = (box.right - box.left) * photo.width
  const boxHeight = (box.bottom - box.top) * photo.height
  if (!(boxWidth > 0 && boxHeight > 0)) return null

  const pad = CROP_MARGIN * Math.max(boxWidth, boxHeight)
  let x0 = Math.max(0, box.left * photo.width - pad)
  let x1 = Math.min(photo.width, box.right * photo.width + pad)
  let y0 = Math.max(0, box.top * photo.height - pad)
  let y1 = Math.min(photo.height, box.bottom * photo.height + pad)

  // Scaled to the maximum side, the short side must still reach the minimum side.
  if (limits.minSide > 0) {
    const long = Math.max(x1 - x0, y1 - y0)
    const shortNeeded = Math.ceil((long * limits.minSide) / limits.maxSide) + 1
    if (x1 - x0 >= y1 - y0) [y0, y1] = widen(y0, y1, shortNeeded, photo.height)
    else [x0, x1] = widen(x0, x1, shortNeeded, photo.width)
  }

  const x = Math.floor(x0)
  const y = Math.floor(y0)
  const width = Math.min(photo.width, Math.ceil(x1)) - x
  const height = Math.min(photo.height, Math.ceil(y1)) - y

  const out = largestWithin({ width, height }, limits)
  if (!out) return null
  return { x, y, width, height, outWidth: out.width, outHeight: out.height }
}

/**
 * What the crop read did, for the export. The UI shows only the combined reading, never the crop read
 * itself. combined: it answered and its reading was combined with the full photo's. failed, cancelled:
 * no reply; skipped-cap: the per-inspection cap stopped it. In each of those the full-photo reading stands.
 */
export interface IdCropReadRecord {
  outcome: 'combined' | 'failed' | 'cancelled' | 'skipped-cap'
  /** The box the crop was cut around, as the full-photo read gave it. */
  box: IdBox
  /** The region cut from the prepared photo and the size it was sent at; null when no reply came back. */
  crop: {
    x: number
    y: number
    width: number
    height: number
    sentWidth: number
    sentHeight: number
  } | null
  /** Version the provider reports for the model that answered, or null when no reply was received. */
  resolvedVersion: string | null
  disagreements: IdDisagreement[]
  /** Set when the cap stopped it. */
  reason: 'requests' | 'spend' | null
}

declare module './inspection' {
  interface InspectionRecord {
    /** The crop read of the container ID (ticket #31), when one was started. Absent on other runs. */
    idCropRead?: IdCropReadRecord
  }
}

/** A character the two readings disagree on, kept for the export. Never shown in the UI. */
export interface IdDisagreement {
  /** 1-based. */
  position: number
  full: { value: string; certainty: CertaintyLabel }
  crop: { value: string; certainty: CertaintyLabel }
  /** Which reading's character was kept. */
  kept: 'full' | 'crop'
}

export interface CombinedReadings {
  readings: ChoiceReading[]
  disagreements: IdDisagreement[]
}

const UNREAD_CHARACTER: ChoiceReading = { value: null, certainty: "Can't tell", runnerUp: null }

function rank(label: CertaintyLabel): number {
  return CERTAINTY_LABELS.indexOf(label)
}

/** Whether `a` is more confident than `b`: by probability when both carry one, else by certainty word. */
function moreConfident(a: ChoiceReading, b: ChoiceReading): boolean {
  if (a.probability !== undefined && b.probability !== undefined) {
    return a.probability > b.probability
  }
  return rank(a.certainty) < rank(b.certainty)
}

/** One level less sure, never below Can't tell. */
function lowered(label: CertaintyLabel): CertaintyLabel {
  return CERTAINTY_LABELS[Math.min(rank(label) + 1, rank("Can't tell"))] ?? label
}

function disagreement(
  position: number,
  full: ChoiceReading,
  crop: ChoiceReading,
  kept: 'full' | 'crop',
): IdDisagreement {
  return {
    position,
    full: { value: full.value!, certainty: full.certainty },
    crop: { value: crop.value!, certainty: crop.certainty },
    kept,
  }
}

/**
 * One best reading per character from the full-photo and crop readings. A character only one of them
 * read takes that reading. Where both read the same character, the more confident reading is kept.
 * Where they disagree, the more confident one wins (the crop on a tie, as the closer look), the other
 * becomes its plausible alternative, and the shared margin rule applies between the two: two close
 * readings lower the certainty a level, and a reading that falls to Can't tell is left unread.
 */
export function combineIdReadings(full: ChoiceReading[], crop: ChoiceReading[]): CombinedReadings {
  const disagreements: IdDisagreement[] = []
  const readings = full.map((f, i): ChoiceReading => {
    const c = crop[i] ?? UNREAD_CHARACTER
    if (f.value === null) return c.value === null ? UNREAD_CHARACTER : c
    if (c.value === null) return f
    const fullWins = moreConfident(f, c)
    const [winner, loser] = fullWins ? [f, c] : [c, f]
    if (f.value === c.value) return winner

    disagreements.push(disagreement(i + 1, f, c, fullWins ? 'full' : 'crop'))
    const certainty =
      winner.probability !== undefined && loser.probability !== undefined
        ? applyMargin(winner.certainty, winner.probability, loser.probability)
        : rank(winner.certainty) === rank(loser.certainty)
          ? lowered(winner.certainty)
          : winner.certainty
    if (certainty === "Can't tell") return UNREAD_CHARACTER
    return { ...winner, certainty, runnerUp: loser.value }
  })
  return { readings, disagreements }
}
