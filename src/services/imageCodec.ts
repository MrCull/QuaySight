/**
 * The browser's image decoder and canvas, behind the one boundary photo preparation needs. Tests fake this
 * module (jsdom has no decoder or canvas); the real behaviour is covered end to end.
 */

export interface DecodedPhoto {
  /** Upright size: the EXIF orientation is already applied. */
  width: number
  height: number
  /** Draws the upright photo at this size and encodes it as a JPEG. */
  toJpeg(width: number, height: number): Promise<Blob>
  /** Releases the decoded photo. */
  close(): void
}

const JPEG_QUALITY = 0.9

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
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return Promise.reject(new Error('No 2D canvas'))
      // JPEG has no transparency: a transparent PNG goes onto white rather than black.
      context.fillStyle = 'white'
      context.fillRect(0, 0, width, height)
      context.imageSmoothingQuality = 'high'
      context.drawImage(img, 0, 0, width, height)
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('JPEG encoding failed'))),
          'image/jpeg',
          JPEG_QUALITY,
        )
      })
    },
    close() {
      URL.revokeObjectURL(url)
    },
  }
}
