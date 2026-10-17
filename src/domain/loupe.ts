/**
 * Geometry for the hover loupe (design-system/components/Loupe, ticket #94). Pure: no DOM, no Vue.
 * The loupe draws the original photo as its background, scaled and shifted so the spot under the pointer
 * sits in its centre.
 */

export interface Point {
  x: number
  y: number
}

/** A box in viewport pixels. */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface PixelSize {
  width: number
  height: number
}

/** How the loupe draws the original: its size at the loupe's zoom, and where its top-left sits in the loupe. */
export interface Lens {
  zoom: number
  imageWidth: number
  imageHeight: number
  offsetX: number
  offsetY: number
}

/** About 3× the displayed size. */
export const LOUPE_ZOOM = 3

/** The photo's drawn box inside a frame that fits it with `object-fit: contain`. Null before its size is known. */
export function containedBox(frame: Box, natural: PixelSize): Box | null {
  if (!(natural.width > 0 && natural.height > 0 && frame.width > 0 && frame.height > 0)) return null
  const scale = Math.min(frame.width / natural.width, frame.height / natural.height)
  const width = natural.width * scale
  const height = natural.height * scale
  return {
    left: frame.left + (frame.width - width) / 2,
    top: frame.top + (frame.height - height) / 2,
    width,
    height,
  }
}

/**
 * What the loupe shows for the pointer over a framed photo: about 3× the displayed size, capped so one
 * original pixel is never stretched over more than one loupe pixel, and never below the displayed size.
 * Null when the pointer is on the letterbox bars, or the original's size is not known yet.
 */
export function loupeLens(
  pointer: Point,
  frame: Box,
  natural: PixelSize,
  loupeSize: number,
): Lens | null {
  const photo = containedBox(frame, natural)
  if (!photo) return null
  const x = pointer.x - photo.left
  const y = pointer.y - photo.top
  if (x < 0 || y < 0 || x > photo.width || y > photo.height) return null
  const zoom = Math.max(1, Math.min(LOUPE_ZOOM, natural.width / photo.width))
  return {
    zoom,
    imageWidth: photo.width * zoom,
    imageHeight: photo.height * zoom,
    offsetX: loupeSize / 2 - x * zoom,
    offsetY: loupeSize / 2 - y * zoom,
  }
}

/**
 * Where the loupe sits: `gap` below and to the right of the pointer, so it never covers the spot being looked
 * at, flipping to the left or above where it would run past the viewport. Viewport pixels, top-left corner.
 */
export function placeLoupe(
  pointer: Point,
  size: number,
  gap: number,
  viewport: PixelSize,
): { left: number; top: number } {
  const right = pointer.x + gap
  const below = pointer.y + gap
  return {
    left: right + size <= viewport.width ? right : Math.max(0, pointer.x - gap - size),
    top: below + size <= viewport.height ? below : Math.max(0, pointer.y - gap - size),
  }
}
