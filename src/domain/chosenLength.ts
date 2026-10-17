// Which length the schematic is drawn to (spec 4.3, ticket #46). Pure.
//
// In order: the ISO size/type code when it was read and decoded at Confident; the model's answer to the
// survey's length question; 40 ft.
import type { CertaintyLabel, InspectionRecord } from './inspection'

export type ContainerLengthFt = 20 | 40 | 45

/** Where the length used came from. */
export type LengthSource = 'iso-code' | 'model' | 'default'

export interface ChosenLength {
  feet: ContainerLengthFt
  source: LengthSource
}

export const DEFAULT_LENGTH: ChosenLength = { feet: 40, source: 'default' }

/** The model's answer to the length question. */
export interface LengthReading {
  feet: ContainerLengthFt
  probability: number
  certainty: CertaintyLabel
}

/** The length to draw and where it came from. */
export function chosenLength(record: InspectionRecord): ChosenLength {
  const decoded = record.sizeCode
  if (decoded && decoded.certainty === 'Confident') {
    const feet = decoded.length.feet
    if (feet === 20 || feet === 40 || feet === 45) return { feet, source: 'iso-code' }
  }
  if (record.modelLength) return { feet: record.modelLength.feet, source: 'model' }
  return DEFAULT_LENGTH
}
