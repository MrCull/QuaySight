import type { PhotoSize } from './photoFit'
import type { CropFrame } from './enlargedCrop'

export interface FractionalBox {
  left: number
  right: number
  top: number
  bottom: number
}

/** Map a box on an aspect-preserving crop to the upright original. Output scaling cancels. */
export function mapCropBox(
  photo: PhotoSize,
  crop: CropFrame,
  box: FractionalBox,
): FractionalBox | null {
  if (
    ![photo.width, photo.height].every(Number.isFinite) ||
    photo.width <= 0 ||
    photo.height <= 0 ||
    ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > photo.width ||
    crop.y + crop.height > photo.height ||
    ![box.left, box.right, box.top, box.bottom].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    ) ||
    box.left >= box.right ||
    box.top >= box.bottom
  )
    return null
  return {
    left: (crop.x + box.left * crop.width) / photo.width,
    right: (crop.x + box.right * crop.width) / photo.width,
    top: (crop.y + box.top * crop.height) / photo.height,
    bottom: (crop.y + box.bottom * crop.height) / photo.height,
  }
}
