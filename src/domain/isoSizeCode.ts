// ISO 6346 size/type code decoding (spec 4.3). Decoded from the code, never estimated from perspective.
// Only codes this app recognises are decoded; anything else returns null so the screen says "not decoded".
import type { CertaintyLabel } from './inspection'

export interface DecodedSizeCode {
  code: string
  /** Certainty of the printed code it was decoded from. */
  certainty: CertaintyLabel
  length: { feet: number; label: string }
  height: { highCube: boolean; label: string }
  width: { label: string }
  type: { label: string }
  /** Short plain-English reading, e.g. "40 ft High Cube, general purpose". */
  summary: string
}

const LENGTHS: Record<string, { feet: number; label: string }> = {
  '2': { feet: 20, label: '20 ft' },
  '4': { feet: 40, label: '40 ft' },
}

// Second character: height (and width, which is standard 8 ft for these codes).
const HEIGHTS: Record<string, { highCube: boolean; label: string }> = {
  '2': { highCube: false, label: '8 ft 6 in standard' },
  '5': { highCube: true, label: '9 ft 6 in High Cube' },
}

const TYPES: Record<string, string> = {
  G: 'General purpose',
  R: 'Reefer',
}

export function decodeSizeCode(
  code: string | null,
  certainty: CertaintyLabel,
): DecodedSizeCode | null {
  if (code === null) return null
  const normalised = code.replace(/\s+/g, '').toUpperCase()
  if (!/^[0-9][0-9][A-Z][0-9]$/.test(normalised)) return null

  const length = LENGTHS[normalised[0] ?? '']
  const height = HEIGHTS[normalised[1] ?? '']
  const type = TYPES[normalised[2] ?? '']
  if (!length || !height || !type) return null

  const heightPart = height.highCube ? 'High Cube' : 'standard height'
  return {
    code: normalised,
    certainty,
    length,
    height: { highCube: height.highCube, label: height.label },
    width: { label: '8 ft standard width' },
    type: { label: type },
    summary: `${length.feet} ft ${heightPart}, ${type.toLowerCase()}`,
  }
}
