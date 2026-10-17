import { cropRegion, type CropRegion, type IdBox } from '../domain/cropRead'
import type { PhotoLimits } from '../domain/providers'
import { markLabels, gridLines } from '../domain/regionMarks'
import { decodePhoto } from './imageCodec'

// A cropped version of the prepared photo, for Jev's crop read of the ID (ticket #31). The prepared photo
// itself is untouched and is what every other request is sent.

export interface CroppedPhoto {
  photo: Blob
  region: CropRegion
}

/**
 * The prepared photo cropped around a box with a margin and scaled up within the model's photo limits,
 * as a JPEG. The box is a fraction of this photo. Throws when no crop can be made.
 */
export async function cropPhoto(
  photo: Blob,
  box: IdBox,
  limits: PhotoLimits,
  margin?: number,
): Promise<CroppedPhoto> {
  const decoded = await decodePhoto(photo)
  try {
    const region = cropRegion({ width: decoded.width, height: decoded.height }, box, limits, margin)
    if (!region) throw new Error('No crop of the ID fits the model photo limits.')
    const cropped = await decoded.toJpegRegion(region, region.outWidth, region.outHeight)
    return { photo: cropped, region }
  } finally {
    decoded.close()
  }
}

/**
 * A crop for a zoomed read (ticket #84): cut from the photo as it was chosen (full resolution) when that
 * can be decoded, else from the prepared photo the run sent.
 */
export async function cropForRead(
  prepared: Blob,
  original: Blob | undefined,
  box: IdBox,
  limits: PhotoLimits,
  margin?: number,
): Promise<CroppedPhoto> {
  if (original) {
    try {
      return await cropPhoto(original, box, limits, margin)
    } catch {
      // The chosen photo cannot be decoded here, or no crop of it fits: the prepared photo is still a fair source.
    }
  }
  return cropPhoto(prepared, box, limits, margin)
}

/** The prepared photo with the numbered regions drawn on it, at the size it was sent, as a JPEG. */
export async function markPhoto(photo: Blob): Promise<Blob> {
  const decoded = await decodePhoto(photo)
  try {
    return await decoded.toJpegMarked(decoded.width, decoded.height, {
      lines: gridLines(),
      labels: markLabels().map((l) => ({ text: l.text, x: l.x, y: l.y, alt: l.crossing })),
    })
  } finally {
    decoded.close()
  }
}
