import { cropRegion, type CropRegion, type IdBox } from '../domain/cropRead'
import type { PhotoLimits } from '../domain/providers'
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
): Promise<CroppedPhoto> {
  const decoded = await decodePhoto(photo)
  try {
    const region = cropRegion({ width: decoded.width, height: decoded.height }, box, limits)
    if (!region) throw new Error('No crop of the ID fits the model photo limits.')
    const cropped = await decoded.toJpegRegion(region, region.outWidth, region.outHeight)
    return { photo: cropped, region }
  } finally {
    decoded.close()
  }
}
