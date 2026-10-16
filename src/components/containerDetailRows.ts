// What the Container details panel and the Markings card show, row by row, from the record. Pure.
//
// The panel is a list of groups (size and type, weights, equipment). A group that was asked shows one
// row per field; a group the run never asked shows one sentence, "not assessed in this inspection",
// never a column of Not seen chips (Not seen means "in no photo"). Each group has its own builder, so a
// ticket that adds rows (weights in kg and lb) changes only its group.
import type { CheckReading, EquipmentCheck, MarkingCheck } from '../domain/containerDetails'
import { dgClassName, EQUIPMENT_CHECKS } from '../domain/containerDetails'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'

export interface DetailRow {
  label: string
  value: string | null
  /** Shown when value is null, in place of the value. */
  absentText: string
  provenance: string
  provenanceClass: string
  certainty: CertaintyLabel
  note: string | null
}

export interface DetailGroup {
  id: 'size' | 'weights' | 'equipment'
  rows: DetailRow[]
  /** One sentence when the run never asked this group; then rows is empty. */
  notAssessed: string | null
}

const NOT_VISIBLE = 'Not visible in this photo'
const NOT_CLEAR = 'Not clear from this photo'
const PRINTED = { provenance: 'Printed', provenanceClass: '' }
const DECODED = { provenance: 'Decoded from ISO', provenanceClass: '' }
const MODEL_SELECTED = { provenance: 'Model-selected', provenanceClass: 'qs-prov--model' }
const CALCULATED = { provenance: 'Calculated', provenanceClass: 'qs-prov--calculated' }

function absent(label: string, absentText: string, certainty: CertaintyLabel): DetailRow {
  return {
    label,
    value: null,
    absentText,
    provenance: '',
    provenanceClass: '',
    certainty,
    note: null,
  }
}

const DECODED_LABELS = ['LENGTH', 'HEIGHT', 'WIDTH', 'TYPE'] as const

/** The size/type code as printed, then what it decodes to. */
export function sizeGroup(record: InspectionRecord): DetailGroup {
  const reading = record.details?.sizeCode
  const size = record.sizeCode
  if (size) {
    const notes = [size.summary]
    if (reading?.alternative) notes.push(`Also possible: ${reading.alternative}.`)
    const decoded = (label: string, value: string): DetailRow => ({
      label,
      value,
      absentText: NOT_VISIBLE,
      ...DECODED,
      certainty: size.certainty,
      note: null,
    })
    return {
      id: 'size',
      notAssessed: null,
      rows: [
        {
          label: 'ISO CODE',
          value: size.code,
          absentText: NOT_VISIBLE,
          ...PRINTED,
          certainty: size.certainty,
          note: notes.join(' '),
        },
        decoded('LENGTH', size.length.label),
        decoded('HEIGHT', size.height.label),
        decoded('WIDTH', size.width.label),
        decoded('TYPE', size.type.label),
      ],
    }
  }

  // Nothing decoded: say why on the code's row, and that nothing follows from it.
  if (!reading) {
    return {
      id: 'size',
      notAssessed: null,
      rows: ['ISO CODE', ...DECODED_LABELS].map((label) => absent(label, NOT_VISIBLE, 'Not seen')),
    }
  }
  let code: DetailRow
  switch (reading.state) {
    case 'read':
      code = {
        label: 'ISO CODE',
        value: reading.code,
        absentText: NOT_VISIBLE,
        ...PRINTED,
        certainty: reading.certainty,
        note: 'Not a code this app decodes.',
      }
      break
    case 'not-visible':
      code = absent('ISO CODE', NOT_VISIBLE, 'Not seen')
      break
    case 'other':
      code = absent('ISO CODE', 'Printed, but not one of the common codes', reading.certainty)
      break
    case 'unreadable':
      code = absent('ISO CODE', 'Printed, but not clear enough to read', reading.certainty)
      break
    default:
      code = absent('ISO CODE', NOT_CLEAR, reading.certainty)
  }
  const follows = reading.state === 'not-visible' ? 'Not seen' : "Can't tell"
  return {
    id: 'size',
    notAssessed: null,
    rows: [
      code,
      ...DECODED_LABELS.map((label) =>
        absent(label, 'Not decoded: no size/type code read', follows),
      ),
    ],
  }
}

const kg = (value: number) => `${value.toLocaleString('en-GB')} kg`

/** Printed maximum gross and tare, and payload calculated from them (spec 4.3, 4.4). */
export function weightGroup(record: InspectionRecord): DetailGroup {
  const weights = record.weights
  // A live survey that did not ask the weights: not assessed, never Not seen.
  if (!weights && record.details) {
    return { id: 'weights', rows: [], notAssessed: 'Weights: not assessed in this inspection.' }
  }
  const payload = weights?.payload ?? null
  return {
    id: 'weights',
    notAssessed: null,
    rows: [
      {
        label: 'MAX GROSS',
        value: weights?.maxGross ? kg(weights.maxGross.valueKg) : null,
        absentText: NOT_VISIBLE,
        ...PRINTED,
        certainty: weights?.maxGross?.certainty ?? 'Not seen',
        note: 'A maximum rating, not the cargo weight.',
      },
      {
        label: 'TARE',
        value: weights?.tare ? kg(weights.tare.valueKg) : null,
        absentText: NOT_VISIBLE,
        ...PRINTED,
        certainty: weights?.tare?.certainty ?? 'Not seen',
        note: null,
      },
      {
        label: 'PAYLOAD',
        value: payload ? kg(payload.valueKg) : null,
        absentText: 'Not calculated: needs maximum gross and tare',
        ...CALCULATED,
        certainty: payload?.certainty ?? 'Not seen',
        note: weights?.conflict ?? (payload ? 'Maximum gross minus tare.' : null),
      },
    ],
  }
}

const EQUIPMENT_LABEL: Record<EquipmentCheck, string> = {
  reefer: 'REEFER',
  openTop: 'OPEN TOP',
  tank: 'TANK',
  flatRack: 'FLAT RACK',
}

function checkRow(label: string, check: CheckReading): DetailRow {
  if (check.answer === null) return absent(label, NOT_CLEAR, check.certainty)
  return {
    label,
    value: check.answer === 'yes' ? 'Yes' : 'No',
    absentText: NOT_CLEAR,
    ...MODEL_SELECTED,
    certainty: check.certainty,
    note: check.conflict,
  }
}

/** Reefer, open top, tank and flat rack, each its own yes/no/unknown row. */
export function equipmentGroup(record: InspectionRecord): DetailGroup {
  const details = record.details
  if (!details) {
    return {
      id: 'equipment',
      rows: [],
      notAssessed: 'Equipment checks: not assessed in this inspection.',
    }
  }
  return {
    id: 'equipment',
    notAssessed: null,
    rows: EQUIPMENT_CHECKS.map((c) => checkRow(EQUIPMENT_LABEL[c], details.equipment[c])),
  }
}

/** Every group, in panel order. */
export function detailGroups(record: InspectionRecord): DetailGroup[] {
  return [sizeGroup(record), weightGroup(record), equipmentGroup(record)]
}

// ---------------------------------------------------------------------------------------------------
// Markings

export interface MarkingBadge {
  text: string
  caveat: string | null
  /** The hazard diamond: only for DG placards and safety markings (MarkingBadge README). */
  hazard: boolean
  /** hazard: the diamond. check: a neutral marking seen. eye: an absence stated ("No DG placard visible"). */
  glyph: 'hazard' | 'check' | 'eye'
}

export interface MarkingRow {
  label: string
  /** The badge for a marking that was seen (or for "No DG placard visible"); null otherwise. */
  badge: MarkingBadge | null
  /** Shown when there is no badge. */
  absentText: string
  certainty: CertaintyLabel
}

const MARKINGS: { check: MarkingCheck; label: string; seen: string; hazard: boolean }[] = [
  { check: 'superHeavy', label: 'SUPER HEAVY', seen: 'SUPER HEAVY marking', hazard: true },
  {
    check: 'highContainer',
    label: 'HIGH CONTAINER',
    seen: 'High-container caution',
    hazard: false,
  },
  { check: 'overwidth', label: 'OVERWIDTH', seen: 'Overwidth marking', hazard: true },
  { check: 'fumigation', label: 'FUMIGATION', seen: 'Fumigation warning', hazard: true },
  {
    check: 'marinePollutant',
    label: 'MARINE POLLUTANT',
    seen: 'Marine pollutant mark',
    hazard: true,
  },
]

const ORDER: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]

/**
 * The DG placard and each operational marking, one row each; null when the run did not check them.
 * Markings seen come first, most certain first; then those not settled, then those not seen.
 */
export function markingRows(record: InspectionRecord): MarkingRow[] | null {
  const details = record.details
  if (!details) return null
  const dg = details.dgPlacard
  const className = dg.dgClass === null ? null : dgClassName(dg.dgClass)
  const dgRow: MarkingRow = {
    label: 'DG PLACARD',
    badge:
      dg.answer === 'placard'
        ? {
            text:
              dg.dgClass === null
                ? 'DG placard visible, class not readable'
                : `DG placard, class ${dg.dgClass} (${className}) visible`,
            caveat: `${dg.symbol ? `Symbol: ${dg.symbol}. ` : ''}Cargo status unknown without a declaration`,
            hazard: true,
            glyph: 'hazard',
          }
        : dg.answer === 'none'
          ? {
              text: 'No DG placard visible',
              caveat: 'Not evidence that the cargo is non-hazardous',
              hazard: false,
              glyph: 'eye',
            }
          : null,
    absentText: NOT_CLEAR,
    certainty: dg.certainty,
  }
  const rows: MarkingRow[] = [
    dgRow,
    ...MARKINGS.map(({ check, label, seen, hazard }): MarkingRow => {
      const reading = details.markings[check]
      return {
        label,
        badge:
          reading.answer === 'yes'
            ? { text: seen, caveat: reading.conflict, hazard, glyph: hazard ? 'hazard' : 'check' }
            : null,
        absentText: reading.answer === 'no' ? NOT_VISIBLE : NOT_CLEAR,
        certainty: reading.certainty,
      }
    }),
  ]
  const seen = (row: MarkingRow) =>
    row.badge !== null && row.certainty !== 'Not seen' ? 0 : row.certainty === 'Not seen' ? 2 : 1
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        seen(a.row) - seen(b.row) ||
        ORDER.indexOf(a.row.certainty) - ORDER.indexOf(b.row.certainty) ||
        a.index - b.index,
    )
    .map(({ row }) => row)
}
