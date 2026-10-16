/**
 * The browser's image decoder and canvas, behind the one boundary photo preparation needs. Tests fake this
 * module (jsdom has no decoder or canvas); the real behaviour is covered end to end.
 */

/** A rectangle of a photo, in its upright pixels. */
export interface PhotoRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface DecodedPhoto {
  /** Upright size: the EXIF orientation is already applied. */
  width: number
  height: number
  /** Draws the upright photo at this size and encodes it as a JPEG. */
  toJpeg(width: number, height: number): Promise<Blob>
  /** Draws one region of the upright photo (in its own pixels) at this size and encodes it as a JPEG. */
  toJpegRegion(region: PhotoRegion, width: number, height: number): Promise<Blob>
  /** Releases the decoded photo. */
  close(): void
}

const JPEG_QUALITY = 0.9

/** Draws a region of the image onto a canvas of this size and encodes it as a JPEG. */
function draw(
  img: HTMLImageElement,
  region: PhotoRegion,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('No 2D canvas'))
  // JPEG has no transparency: a transparent PNG goes onto white rather than black.
  context.fillStyle = 'white'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/**
 * Decodes a photo upright. Browsers apply a JPEG's EXIF orientation when decoding an image element
 * (CSS `image-orientation: from-image`, the default), both to its natural size and to what a canvas draws
 * from it, so the canvas holds the photo the way it was taken and the JPEG it writes carries no EXIF.
 */
export async function decodePhoto(blob: Blob): Promise<DecodedPhoto> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    toJpeg(width, height) {
      const whole = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
      return draw(img, whole, width, height)
    },
    toJpegRegion(region, width, height) {
      return draw(img, region, width, height)
    },
    close() {
      URL.revokeObjectURL(url)
    },
  }
}
