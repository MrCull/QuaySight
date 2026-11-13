// Plain borders around a photo (ticket: seal close-ups). Pure.
//
// A seal close-up is often a phone screenshot with black bars above and below, or a photo with a plain
// background round the seal. Shown whole, the bars waste the close-up. This finds the rows and columns at
// each edge that are one plain colour and returns the area inside them. It never trims into the photo's
// content: a row counts as plain only when every pixel in it is close to that edge's colour.
import type { RegionBox } from './regionMarks'

/** How far a pixel's brightness may stray from the edge colour and still count as plain (0..255). */
export const PLAIN_TOLERANCE = 24
/** Never trim more than this share of the photo from one side: a mostly plain photo is left whole. */
const MAX_SIDE_SHARE = 0.4

const lum = (px: Uint8ClampedArray, i: number) =>
  0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!

/**
 * The area inside plain borders, as fractions of the photo, from its RGBA pixels (any size: the app
 * passes a small copy). Null when no side has a plain border.
 */
export function trimBorders(
  px: Uint8ClampedArray,
  width: number,
  height: number,
): RegionBox | null {
  if (width < 4 || height < 4 || px.length < width * height * 4) return null
  const at = (x: number, y: number) => lum(px, (y * width + x) * 4)
  const rowPlain = (y: number, ref: number) => {
    for (let x = 0; x < width; x++) if (Math.abs(at(x, y) - ref) > PLAIN_TOLERANCE) return false
    return true
  }
  const colPlain = (x: number, top: number, bottom: number, ref: number) => {
    for (let y = top; y < bottom; y++) if (Math.abs(at(x, y) - ref) > PLAIN_TOLERANCE) return false
    return true
  }
  const maxRows = Math.floor(height * MAX_SIDE_SHARE)
  const maxCols = Math.floor(width * MAX_SIDE_SHARE)

  let top = 0
  const topRef = at(0, 0)
  while (top < maxRows && rowPlain(top, topRef)) top++
  let bottom = height
  const bottomRef = at(0, height - 1)
  while (height - bottom < maxRows && rowPlain(bottom - 1, bottomRef)) bottom--
  let left = 0
  const leftRef = at(0, top)
  while (left < maxCols && colPlain(left, top, bottom, leftRef)) left++
  let right = width
  const rightRef = at(width - 1, top)
  while (width - right < maxCols && colPlain(right - 1, top, bottom, rightRef)) right--

  // A side wholly plain up to the cap is no border, just a plain photo: leave that side alone.
  if (top >= maxRows) top = 0
  if (height - bottom >= maxRows) bottom = height
  if (left >= maxCols) left = 0
  if (width - right >= maxCols) right = width
  if (top === 0 && bottom === height && left === 0 && right === width) return null
  return { top: top / height, bottom: bottom / height, left: left / width, right: right / width }
}
