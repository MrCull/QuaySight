import type { SelectedPhoto } from '../stores/inspection'

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
const ACCEPTED_TYPES = PHOTO_ACCEPT.split(',')

/** Maps pixel dimensions to the orientation shown on the photo. */
export function orientationOf(width: number, height: number): SelectedPhoto['orientation'] {
  if (!width || !height) return 'unknown'
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

/** Reads a chosen file into a displayable photo. Rejects anything that is not JPEG, PNG or WebP. */
export async function readPhotoFile(file: File): Promise<SelectedPhoto> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP photo.')
  }
  const url = URL.createObjectURL(file)
  try {
    const { width, height } = await measure(url)
    return { name: file.name, url, orientation: orientationOf(width, height), file }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function measure(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('That photo could not be read.'))
    img.src = url
  })
}
