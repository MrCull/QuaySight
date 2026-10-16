import type { PhotoLimits } from './providers'

/** A photo's pixel size, upright. */
export interface PhotoSize {
  width: number
  height: number
}

export type PhotoFit =
  /** The size to send: within every limit, with the source's aspect ratio. `resized` is false when it is the source size. */
  | { fits: true; width: number; height: number; resized: boolean }
  /**
   * `too-small`: the photo is below the model's minimum side or pixel count. `out-of-proportion`: it is so long
   * and narrow that shrinking it to the maximum takes its short side below the minimum.
   */
  | { fits: false; reason: 'too-small' | 'out-of-proportion' }

const belowMinimum = (width: number, height: number, limits: PhotoLimits) =>
  Math.min(width, height) < limits.minSide || width * height < limits.minPixels

/**
 * The size a photo is sent at for a model's photo limits (spec #16, "Photo preparation"). Pure.
 * Never enlarges, keeps the aspect ratio, and rounds down so no side or total goes past a limit.
 */
export function fitPhoto(source: PhotoSize, limits: PhotoLimits): PhotoFit {
  const { width, height } = source
  if (belowMinimum(width, height, limits)) return { fits: false, reason: 'too-small' }

  let w = width
  let h = height
  const long = Math.max(w, h)
  if (long > limits.maxSide) {
    // Integer arithmetic for the short side, so a side never rounds to just under its exact value.
    if (w >= h) {
      h = Math.floor((h * limits.maxSide) / w)
      w = limits.maxSide
    } else {
      w = Math.floor((w * limits.maxSide) / h)
      h = limits.maxSide
    }
  }
  if (limits.maxPixels !== null && w * h > limits.maxPixels) {
    const scale = Math.sqrt(limits.maxPixels / (w * h))
    w = Math.floor(w * scale)
    h = Math.floor(h * scale)
  }

  if (belowMinimum(w, h, limits)) return { fits: false, reason: 'out-of-proportion' }
  return { fits: true, width: w, height: h, resized: w !== width || h !== height }
}

/**
 * The largest size within a model's photo limits with this aspect ratio: the long side at the limit,
 * or less where the pixel total is reached first. Unlike fitPhoto it enlarges, so it is used only for
 * Jev's crop around the ID (ticket #31). A whole photo is never enlarged: on COYU 266813 0 (16 Oct 2026)
 * an enlarged photo turned Luna's one unread character into misreads (docs/research).
 * Pure; rounds down so no side or total goes past a limit. Null when the shape cannot meet the minimum.
 */
export function largestWithin(source: PhotoSize, limits: PhotoLimits): PhotoSize | null {
  const { width, height } = source
  if (!(width > 0 && height > 0)) return null
  // Integer arithmetic for the short side, so a side never rounds to just under its exact value.
  let w = width >= height ? limits.maxSide : Math.floor((width * limits.maxSide) / height)
  let h = width >= height ? Math.floor((height * limits.maxSide) / width) : limits.maxSide
  if (limits.maxPixels !== null && w * h > limits.maxPixels) {
    const scale = Math.sqrt(limits.maxPixels / (width * height))
    w = Math.floor(width * scale)
    h = Math.floor(height * scale)
  }
  if (belowMinimum(w, h, limits)) return null
  return { width: w, height: h }
}

/** Why a photo cannot be sent to a model, naming its size and the limit it misses. Fit to show. */
export function unfitPhotoMessage(
  source: PhotoSize,
  limits: PhotoLimits,
  reason: 'too-small' | 'out-of-proportion',
  modelName: string,
): string {
  const size = `${source.width} × ${source.height} px`
  if (reason === 'out-of-proportion') {
    return `This photo is ${size}, too long and narrow for ${modelName}: shrunk to ${limits.maxSide} px on its long side, its short side would be under ${limits.minSide} px. Crop it closer to the container, then try again.`
  }
  const need =
    Math.min(source.width, source.height) < limits.minSide
      ? `at least ${limits.minSide} px on each side`
      : `at least ${limits.minPixels.toLocaleString('en-GB')} pixels in total`
  return `This photo is ${size}. ${modelName} needs ${need}. Choose a larger photo.`
}
