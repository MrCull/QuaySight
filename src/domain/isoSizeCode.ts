// ISO 6346 size/type code decoding (spec 4.3). Decoded from the code, never estimated from perspective.
// Only codes this app recognises are decoded; anything else returns null so the screen says "not decoded".
//
// The code is four characters: length, height and width, then a two-character type code whose letter is
// the equipment group. 45G1 is a 40 ft (4), 9 ft 6 in High Cube (5), general-purpose (G1) container: the
// first two characters are not a length in feet.
import type { CertaintyLabel } from './inspection'

/** The equipment a type code's group stands for. */
export type EquipmentType =
  | 'general'
  | 'ventilated'
  | 'bulk'
  | 'named-cargo'
  | 'reefer'
  | 'insulated'
  | 'open-top'
  | 'flat-rack'
  | 'platform'
  | 'tank'
  | 'air-surface'

export interface DecodedSizeCode {
  code: string
  /** Certainty of the printed code it was decoded from. */
  certainty: CertaintyLabel
  length: { feet: number; label: string }
  height: { highCube: boolean; label: string }
  width: { label: string }
  type: { label: string; equipment: EquipmentType }
  /** Short plain-English reading, e.g. "40 ft High Cube, general purpose". */
  summary: string
}

// First character: length.
const LENGTHS: Record<string, { feet: number; label: string }> = {
  '1': { feet: 10, label: '10 ft' },
  '2': { feet: 20, label: '20 ft' },
  '3': { feet: 30, label: '30 ft' },
  '4': { feet: 40, label: '40 ft' },
  B: { feet: 24, label: '24 ft' },
  C: { feet: 24.5, label: '24 ft 6 in' },
  G: { feet: 41, label: '41 ft' },
  H: { feet: 43, label: '43 ft' },
  L: { feet: 45, label: '45 ft' },
  M: { feet: 48, label: '48 ft' },
  N: { feet: 49, label: '49 ft' },
}

const STANDARD_WIDTH = '8 ft standard width'
const PALLET_WIDE = 'Pallet-wide, over 8 ft'
const EXTRA_WIDE = 'Over 2.5 m wide'

// Second character: height and width. Digits are the standard 8 ft width; letters are wider boxes.
const HEIGHTS: Record<string, { highCube: boolean; label: string; width: string }> = {
  '0': { highCube: false, label: '8 ft', width: STANDARD_WIDTH },
  '2': { highCube: false, label: '8 ft 6 in standard', width: STANDARD_WIDTH },
  '4': { highCube: false, label: '9 ft', width: STANDARD_WIDTH },
  '5': { highCube: true, label: '9 ft 6 in High Cube', width: STANDARD_WIDTH },
  '6': { highCube: true, label: 'Over 9 ft 6 in', width: STANDARD_WIDTH },
  '8': { highCube: false, label: '4 ft 3 in', width: STANDARD_WIDTH },
  '9': { highCube: false, label: '4 ft 3 in or less', width: STANDARD_WIDTH },
  C: { highCube: false, label: '8 ft 6 in standard', width: PALLET_WIDE },
  D: { highCube: false, label: '9 ft', width: PALLET_WIDE },
  E: { highCube: true, label: '9 ft 6 in High Cube', width: PALLET_WIDE },
  F: { highCube: true, label: 'Over 9 ft 6 in', width: PALLET_WIDE },
  L: { highCube: false, label: '8 ft 6 in standard', width: EXTRA_WIDE },
  M: { highCube: false, label: '9 ft', width: EXTRA_WIDE },
  N: { highCube: true, label: '9 ft 6 in High Cube', width: EXTRA_WIDE },
  P: { highCube: true, label: 'Over 9 ft 6 in', width: EXTRA_WIDE },
}

// Third character: the equipment group.
const TYPES: Record<string, { label: string; equipment: EquipmentType }> = {
  G: { label: 'General purpose', equipment: 'general' },
  V: { label: 'Ventilated', equipment: 'ventilated' },
  B: { label: 'Dry bulk', equipment: 'bulk' },
  S: { label: 'Named cargo', equipment: 'named-cargo' },
  R: { label: 'Reefer', equipment: 'reefer' },
  H: { label: 'Insulated', equipment: 'insulated' },
  U: { label: 'Open top', equipment: 'open-top' },
  P: { label: 'Flat rack', equipment: 'flat-rack' },
  T: { label: 'Tank', equipment: 'tank' },
  A: { label: 'Air/surface', equipment: 'air-surface' },
}

/** P0 is a plain platform; P1 to P9 have end walls or posts (flat racks). */
const PLATFORM = { label: 'Platform', equipment: 'platform' } as const

function heightPhrase(height: { highCube: boolean; label: string }, char: string): string {
  if (height.highCube && height.label.includes('High Cube')) return 'High Cube'
  if (char === '2' || char === 'C' || char === 'L') return 'standard height'
  return `(${height.label.toLowerCase()} high)`
}

export function decodeSizeCode(
  code: string | null,
  certainty: CertaintyLabel,
): DecodedSizeCode | null {
  if (code === null) return null
  const normalised = code.replace(/\s+/g, '').toUpperCase()
  if (!/^[0-9A-Z]{2}[A-Z][0-9]$/.test(normalised)) return null

  const [lengthChar = '', heightChar = '', group = '', detail = ''] = normalised
  const length = LENGTHS[lengthChar]
  const height = HEIGHTS[heightChar]
  const type = group === 'P' && detail === '0' ? PLATFORM : TYPES[group]
  if (!length || !height || !type) return null

  return {
    code: normalised,
    certainty,
    length,
    height: { highCube: height.highCube, label: height.label },
    width: { label: height.width },
    type: { label: type.label, equipment: type.equipment },
    summary: `${length.label} ${heightPhrase(height, heightChar)}, ${type.label.toLowerCase()}`,
  }
}
