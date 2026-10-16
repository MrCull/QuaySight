// The weights in the JSON and summary exports (ticket #34). Pure. Exports always carry both units,
// whatever the display units are: the kg figure under the field name and the lb figure beside it
// (`maxGross` and `maxGross.lb`; the capacity as `capacity` in m3 and `capacity.cuFt`). A figure that
// was not printed in a unit carries the converted value, marked as calculated.
import type { ExportUnresolved, ExportValue } from './exports'
import {
  payloadConflictText,
  toImperial,
  type CapacityRow,
  type WeightChecks,
  type WeightRow,
} from './weights'

export interface WeightsExport {
  values: ExportValue[]
  unresolved: ExportUnresolved[]
  conflicts: string[]
  /** Lines for the plain-text summary. */
  summary: string[]
}

const fmt = (n: number) => n.toLocaleString('en-GB')

function unitNote(units: 'agree' | 'conflict' | undefined, a: string, b: string, first: string) {
  if (units === 'agree') return `${a} and ${b} agree.`
  if (units === 'conflict') return `${a} and ${b} disagree: ${first}.`
  return null
}

const join = (...notes: (string | null | undefined)[]) => notes.filter(Boolean).join(' ') || null

interface Spec {
  field: string
  row: WeightRow | null
  derived: boolean
  note: string | null
}

function weightValues(spec: Spec): ExportValue[] {
  const { field, row, derived, note } = spec
  if (!row) return []
  const kgPrinted = row.printed ? row.printed.kg !== null : true
  const lbPrinted = row.printed ? row.printed.lb !== null : false
  const lb = row.valueLb ?? Math.round(toImperial('weight', row.valueKg))
  const of = (unit: 'kg' | 'lb', value: number, printed: boolean, suffix: string): ExportValue => ({
    field: `${field}${suffix}`,
    category: derived || !printed ? 'derived' : 'printed',
    value,
    unit,
    provenance: derived || !printed ? 'calculated' : row.provenance,
    certainty: row.certainty,
    uncertainty: join(
      note,
      printed || derived ? null : `Converted from the ${unit === 'kg' ? 'lb' : 'kg'} reading.`,
      unitNote(
        row.units,
        'kg',
        'lb',
        `${row.printed?.kg === null ? '' : `${fmt(row.printed?.kg ?? row.valueKg)} kg`} and ${fmt(lb)} lb`.trim(),
      ),
    ),
  })
  return [of('kg', row.valueKg, kgPrinted, ''), of('lb', lb, lbPrinted, '.lb')]
}

function capacityValues(row: CapacityRow | null): ExportValue[] {
  if (!row) return []
  const of = (
    unit: 'm3' | 'cu ft',
    value: number,
    printed: boolean,
    suffix: string,
  ): ExportValue => ({
    field: `capacity${suffix}`,
    category: printed ? 'printed' : 'derived',
    value,
    unit,
    provenance: printed ? row.provenance : 'calculated',
    certainty: row.certainty,
    uncertainty: join(
      printed ? null : `Converted from the ${unit === 'm3' ? 'cu ft' : 'm3'} reading.`,
      unitNote(row.units, 'm3', 'cu ft', `${fmt(row.valueM3)} m3 and ${fmt(row.valueCuFt)} cu ft`),
    ),
  })
  return [
    of('m3', row.valueM3, row.printed.m3 !== null, ''),
    of('cu ft', row.valueCuFt, row.printed.cuFt !== null, '.cuFt'),
  ]
}

/** Both units on one line; the one that was not printed is said to be converted. */
function AMOUNT(row: WeightRow): string {
  const lb = row.valueLb ?? Math.round(toImperial('weight', row.valueKg))
  const converted = row.printed
    ? row.printed.kg === null
      ? ' (kg converted)'
      : row.printed.lb === null
        ? ' (lb converted)'
        : ''
    : row.provenance === 'calculated'
      ? ''
      : ' (lb converted)'
  return `${fmt(row.valueKg)} kg / ${fmt(lb)} lb${converted}`
}

/** Values, unresolved fields, conflicts and summary lines for the weights on a record. */
export function weightsExport(weights: WeightChecks | null): WeightsExport {
  const values: ExportValue[] = []
  const unresolved: ExportUnresolved[] = []
  const conflicts: string[] = []
  const summary: string[] = []

  const gross = weights?.maxGross ?? null
  const tare = weights?.tare ?? null
  const payload = weights?.payload ?? null
  const printed = weights?.printedPayload ?? null
  values.push(
    ...weightValues({
      field: 'maxGross',
      row: gross,
      derived: false,
      note: 'Maximum gross is a rating, not a measured load.',
    }),
    ...weightValues({ field: 'tare', row: tare, derived: false, note: null }),
    ...weightValues({
      field: 'payload.printed',
      row: printed,
      derived: false,
      note: 'The most the container may carry, not a cargo weight.',
    }),
    ...weightValues({
      field: 'payload',
      row: payload,
      derived: true,
      note: 'Maximum gross minus tare. Not a cargo weight.',
    }),
    ...capacityValues(weights?.capacity ?? null),
  )
  if (!gross) unresolved.push({ field: 'maxGross', category: 'unresolved', reason: 'Not read.' })
  if (!tare) unresolved.push({ field: 'tare', category: 'unresolved', reason: 'Not read.' })
  if (!payload) {
    unresolved.push({
      field: 'payload',
      category: 'unresolved',
      reason: 'Needs both maximum gross and tare.',
    })
  }
  if (weights?.capacity === null) {
    unresolved.push({ field: 'capacity', category: 'unresolved', reason: 'Not read.' })
  }

  if (weights?.payloadConflict) conflicts.push(payloadConflictText(weights.payloadConflict))
  else if (weights?.conflict) conflicts.push(weights.conflict)
  for (const [name, row] of [
    ['Maximum gross', gross],
    ['Tare', tare],
    ['Payload', printed],
  ] as const) {
    if (row?.units === 'conflict') {
      conflicts.push(
        `${name} read as ${fmt(row.printed?.kg ?? row.valueKg)} kg and ${fmt(row.printed?.lb ?? row.valueLb ?? 0)} lb, which do not match after conversion.`,
      )
    }
  }
  const capacity = weights?.capacity
  if (capacity?.units === 'conflict') {
    conflicts.push(
      `Cubic capacity read as ${fmt(capacity.valueM3)} m3 and ${fmt(capacity.valueCuFt)} cu ft, which do not match after conversion.`,
    )
  }

  const tag = (row: { certainty: string; units?: 'agree' | 'conflict' }) =>
    `${row.units === 'agree' ? ' - kg and lb agree' : row.units === 'conflict' ? ' - kg and lb disagree' : ''} - ${row.certainty}`
  if (gross) {
    summary.push(
      `Max gross (printed): ${AMOUNT(gross)}${tag(gross)} - a rating, not a measured load`,
    )
  }
  if (tare) summary.push(`Tare (printed): ${AMOUNT(tare)}${tag(tare)}`)
  if (printed) summary.push(`Payload (printed): ${AMOUNT(printed)}${tag(printed)}`)
  if (payload) summary.push(`Payload (calculated): ${AMOUNT(payload)} - ${payload.certainty}`)
  if (capacity) {
    summary.push(
      `Cubic capacity (printed): ${fmt(capacity.valueM3)} m3 / ${fmt(capacity.valueCuFt)} cu ft${capacity.units === 'agree' ? ' - m3 and cu ft agree' : capacity.units === 'conflict' ? ' - m3 and cu ft disagree' : ''} - ${capacity.certainty}`,
    )
  }
  return { values, unresolved, conflicts, summary }
}
