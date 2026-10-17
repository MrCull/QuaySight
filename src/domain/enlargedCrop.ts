// Enlarged crops (spec #51, ticket #67). One mechanism for showing "where we read it": a reading can
// carry a box, and the crop is that box padded well beyond its edges, cut from the reading's own photo.
// The ID uses it first; the seal and the placards pass their own box and photo to PhotoCrop.vue. Pure.
// This is for showing the presenter; cropRead.ts crops for the model.
import { usableIdBox, type IdBox } from './cropRead'
import type { PhotoSize } from './photoFit'

/** A box as a fraction (0..1) of the photo it was asked on, with the model's confidence in it. */
export type ReadingBox = IdBox

/**
 * Space kept around the box on every side, as a fraction of the box's long side. Model boxes are
 * approximate and often short, and a presenter checking a reading wants the surroundings too.
 */
export const ENLARGED_MARGIN = 0.5

/** A region of the photo in its own pixels. */
export interface CropFrame {
  x: number
  y: number
  width: number
  height: number
}

/** [lo, hi] kept at its size where it fits in [0, max], shifted off an edge it passes; else all of [0, max]. */
function within(lo: number, hi: number, max: number): [number, number] {
  if (hi - lo >= max) return [0, max]
  if (lo < 0) return [0, hi - lo]
  if (hi > max) return [lo - (hi - max), max]
  return [lo, hi]
}

/**
 * The region to show for a reading's box on a photo of this size, or null when there is no usable box
 * (none, unsure, or a sliver): nothing is then shown.
 */
export function enlargedCrop(
  photo: PhotoSize,
  box: ReadingBox | null | undefined,
): CropFrame | null {
  if (!(photo.width > 0 && photo.height > 0)) return null
  const usable = usableIdBox(box)
  if (!usable) return null
  const left = usable.left * photo.width
  const right = usable.right * photo.width
  const top = usable.top * photo.height
  const bottom = usable.bottom * photo.height
  const pad = ENLARGED_MARGIN * Math.max(right - left, bottom - top)
  const [x0, x1] = within(left - pad, right + pad, photo.width)
  const [y0, y1] = within(top - pad, bottom + pad, photo.height)
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
