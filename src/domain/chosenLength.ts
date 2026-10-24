// Which length the schematic is drawn to (spec 4.3, ticket #46). Pure.
//
// In order: the ISO size/type code when it was read and decoded at Confident; the shape estimate from a
// side photo (ticket #66); the model's answer to the survey's length question; 40 ft. When a Confident
// code and the shape disagree, the code decides at its own certainty; the shape's length is kept as a note.
// A Likely code against the shape leaves the length Uncertain.
import type { CertaintyLabel, InspectionRecord } from './inspection'

export type ContainerLengthFt = 20 | 40 | 45

/** Where the length used came from. */
export type LengthSource = 'iso-code' | 'shape' | 'model' | 'default'

export interface ChosenLength {
  feet: ContainerLengthFt
  source: LengthSource
  /** Only when a Likely ISO code and the shape estimate disagree: Uncertain. */
  certainty?: CertaintyLabel
  /** When the code and the shape disagree: the other length (the shape's, or a Likely code's). */
  alternative?: ContainerLengthFt
}

export const DEFAULT_LENGTH: ChosenLength = { feet: 40, source: 'default' }

/** The model's answer to the length question. */
export interface LengthReading {
  feet: ContainerLengthFt
  probability: number
  certainty: CertaintyLabel
}

/** The 20, 40 or 45 ft the decoded size code names, when it names one. */
export function codeFeetOf(record: InspectionRecord): ContainerLengthFt | null {
  const feet = record.sizeCode?.length.feet
  return feet === 20 || feet === 40 || feet === 45 ? feet : null
}

/** The length to draw and where it came from. */
export function chosenLength(record: InspectionRecord): ChosenLength {
  const code = codeFeetOf(record)
  const shape = record.shapeLength
  const codeCertainty = record.sizeCode?.certainty
  if (code !== null && codeCertainty === 'Confident') {
    if (shape && shape.feet !== code) {
      return { feet: code, source: 'iso-code', alternative: shape.feet }
    }
    return { feet: code, source: 'iso-code' }
  }
  if (shape) {
    // A Likely code is still a reading: against the shape it makes the length Uncertain (the shape
    // stands, the code's length is the alternative).
    if (code !== null && codeCertainty === 'Likely' && shape.feet !== code) {
      return { feet: shape.feet, source: 'shape', certainty: 'Uncertain', alternative: code }
    }
    return { feet: shape.feet, source: 'shape' }
  }
  if (record.modelLength) return { feet: record.modelLength.feet, source: 'model' }
  return DEFAULT_LENGTH
}
