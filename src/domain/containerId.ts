// Builds the container ID reading with its deterministic ISO 6346 check (spec 4.2).
// The printed characters are never altered. A matching check digit is supporting evidence only.
import { weakestOf } from './idConfidence'
import { calculateCheckDigit } from './iso6346'
import type { CertaintyLabel, ContainerIdReading } from './inspection'

export interface ContainerIdInput {
  /** Characters as read from the photo: 10 (owner, category, serial) or 11 (with the check digit). */
  printed: string
  /** Visible certainty from the photo. A failing check digit lowers it to Uncertain; raising it is idConfidence's job. */
  certainty: CertaintyLabel
}

export function buildContainerIdReading(input: ContainerIdInput): ContainerIdReading {
  const value = input.printed.replace(/\s+/g, '').toUpperCase()
  const calculatedCheckDigit = calculateCheckDigit(value.slice(0, 10))
  const observed = value.length === 11 ? Number(value[10]) : null
  const checkDigitValid = observed !== null && observed === calculatedCheckDigit

  // A reading whose check digit fails is Uncertain at best (spec #75).
  const certainty: CertaintyLabel =
    observed !== null && !checkDigitValid
      ? weakestOf([input.certainty, 'Uncertain'])
      : input.certainty

  return {
    value,
    observedCheckDigit: observed,
    calculatedCheckDigit,
    checkDigitValid,
    certainty,
    provenance: 'printed',
  }
}
