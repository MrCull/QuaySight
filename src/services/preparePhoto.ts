import { fitPhoto, unfitPhotoMessage } from '../domain/photoFit'
import type { PhotoLimits } from '../domain/providers'
import { decodePhoto, type DecodedPhoto } from './imageCodec'

/** A photo that cannot be sent to the chosen model. The message is fit to show; nothing was sent or charged. */
export class PhotoPreparationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoPreparationError'
  }
}

/**
 * The photo as a live call sends it (spec #16, "Photo preparation"): upright from its EXIF orientation,
 * shrunk to fit the model's photo limits with its aspect ratio kept, and re-encoded as a JPEG. The chosen
 * photo itself is untouched; it stays the one shown on screen. Throws PhotoPreparationError for a photo
 * the model would refuse, before any request is made.
 */
export async function preparePhoto(
  photo: Blob,
  limits: PhotoLimits,
  modelName: string,
): Promise<Blob> {
  let decoded: DecodedPhoto
  try {
    decoded = await decodePhoto(photo)
  } catch {
    throw new PhotoPreparationError('That photo could not be read. Choose another photo.')
  }
  try {
    const size = { width: decoded.width, height: decoded.height }
    const fit = fitPhoto(size, limits)
    if (!fit.fits) {
      throw new PhotoPreparationError(unfitPhotoMessage(size, limits, fit.reason, modelName))
    }
    return await decoded.toJpeg(fit.width, fit.height)
  } finally {
    decoded.close()
  }
}
