// Weight rows and gross minus tare arithmetic (spec 4.3, 4.4). Maximum gross is a rating, never a measured load.
import type { CertaintyLabel, Provenance } from './inspection'

export interface WeightRow {
  valueKg: number
  provenance: Provenance
  certainty: CertaintyLabel
}

export interface WeightInputs {
  maxGrossKg: number | null
  tareKg: number | null
  /** NET / PAYLOAD as printed on the door, when visible. Used only to check the arithmetic. */
  printedNetKg: number | null
  /** Certainty of the printed readings from the photo. */
  certainty: CertaintyLabel
}

export interface WeightChecks {
  maxGross: WeightRow | null
  tare: WeightRow | null
  payload: WeightRow | null
  /** Plain-English conflict between printed NET and the arithmetic, or null. */
  conflict: string | null
}

const ORDER: CertaintyLabel[] = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']

function weaker(a: CertaintyLabel, b: CertaintyLabel): CertaintyLabel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b
}

function kg(value: number): string {
  return `${value.toLocaleString('en-GB')} kg`
}

export function checkWeights(input: WeightInputs): WeightChecks {
  const maxGross: WeightRow | null =
    input.maxGrossKg === null
      ? null
      : { valueKg: input.maxGrossKg, provenance: 'printed', certainty: input.certainty }
  const tare: WeightRow | null =
    input.tareKg === null
      ? null
      : { valueKg: input.tareKg, provenance: 'printed', certainty: input.certainty }

  if (input.maxGrossKg === null || input.tareKg === null) {
    return { maxGross, tare, payload: null, conflict: null }
  }

  const calculatedKg = input.maxGrossKg - input.tareKg
  // A calculated payload is only as certain as the printed inputs it came from.
  const payload: WeightRow = {
    valueKg: calculatedKg,
    provenance: 'calculated',
    certainty: input.certainty,
  }

  if (input.printedNetKg !== null && input.printedNetKg !== calculatedKg) {
    return {
      maxGross,
      tare,
      payload: { ...payload, certainty: weaker(payload.certainty, 'Uncertain') },
      conflict: `Printed NET ${kg(input.printedNetKg)} does not match maximum gross minus tare, ${kg(calculatedKg)}.`,
    }
  }

  return { maxGross, tare, payload, conflict: null }
}
