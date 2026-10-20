// What the Container details panel shows, row by row, from the record. Pure.
//
// The panel is a list of groups (size and type, weights, equipment). A group that was asked shows one
// row per field; a group the run never asked shows one sentence, "not assessed in this inspection",
// never a column of Not seen chips (Not seen means "in no photo"). Each group has its own builder, so a
// ticket that adds rows (weights in kg and lb) changes only its group.
//
// This file decides which rows exist and with what certainty; the words of each row are in
// containerDetailWording.ts (ticket #54). The Markings card's rows are in markingRows.ts, re-exported here.
import { chosenLength } from '../domain/chosenLength'
import type { CheckReading } from '../domain/containerDetails'
import { EQUIPMENT_CHECKS } from '../domain/containerDetails'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'
import type { Units } from '../domain/unitPreference'
import {
  payloadConflictText,
  printedPayloadHidden,
  toImperial,
  type CapacityRow,
  type Unread,
  type WeightRow,
} from '../domain/weights'
import {
  CALCULATED,
  DECODED,
  DECODED_LABELS,
  EQUIPMENT_LABEL,
  EQUIPMENT_NOT_ASSESSED,
  MAXIMUM_MINUS_TARE,
  MAXIMUM_NOTE,
  MODEL_SELECTED,
  NOT_CLEAR,
  NOT_DECODED_CODE_NOTE,
  NOT_DECODED_TEXT,
  NOT_VISIBLE,
  PAYLOAD_NOTE,
  PAYLOAD_NOT_CALCULATED,
  PRINTED,
  SHAPE_ESTIMATED,
  WEIGHTS_NOT_ASSESSED,
  absentCodeText,
  capacityEvidence,
  capacityText,
  fmt,
  inheritedDoubtText,
  joinNotes,
  sizeCodeNote,
  unitEvidence,
  yesNoText,
} from './containerDetailWording'

export * from './markingRows'

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

/**
 * The LENGTH row when the shape of a side photo has a say (ticket #66): the shape's estimate when no
 * Confident code decided, or the code's length with a note of what the shape suggested. Null: the row stands.
 */
function lengthRow(record: InspectionRecord): DetailRow | null {
  const chosen = chosenLength(record)
  const text = `${chosen.feet} ft`
  if (chosen.source === 'shape') {
    return {
      label: 'LENGTH',
      value: text,
      absentText: NOT_VISIBLE,
      ...SHAPE_ESTIMATED,
      certainty: chosen.certainty ?? record.shapeLength?.certainty ?? 'Likely',
      note: chosen.alternative !== undefined ? `Also possible: ${chosen.alternative} ft.` : null,
    }
  }
  if (chosen.alternative !== undefined) {
    // A Confident code decides; the shape is only an estimate, so it is a note, not an alternative.
    return {
      label: 'LENGTH',
      value: text,
      absentText: NOT_VISIBLE,
      ...DECODED,
      certainty: record.sizeCode?.certainty ?? 'Confident',
      note: `The shape in the photo suggested ${chosen.alternative} ft; the size code decides.`,
    }
  }
  return null
}

/** The size/type code as printed, then what it decodes to; the length may come from the shape instead. */
export function sizeGroup(record: InspectionRecord): DetailGroup {
  const group = decodedSizeGroup(record)
  const length = lengthRow(record)
  if (!length) return group
  return { ...group, rows: group.rows.map((r) => (r.label === 'LENGTH' ? length : r)) }
}

function decodedSizeGroup(record: InspectionRecord): DetailGroup {
  const reading = record.details?.sizeCode
  const size = record.sizeCode
  if (size) {
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
          note: sizeCodeNote(size.summary, reading?.alternative),
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
  const code: DetailRow =
    reading.state === 'read'
      ? {
          label: 'ISO CODE',
          value: reading.code,
          absentText: NOT_VISIBLE,
          ...PRINTED,
          certainty: reading.certainty,
          note: NOT_DECODED_CODE_NOTE,
        }
      : absent(
          'ISO CODE',
          absentCodeText(reading.state),
          reading.state === 'not-visible' ? 'Not seen' : reading.certainty,
        )
  const follows = reading.state === 'not-visible' ? 'Not seen' : "Can't tell"
  return {
    id: 'size',
    notAssessed: null,
    rows: [code, ...DECODED_LABELS.map((label) => absent(label, NOT_DECODED_TEXT, follows))],
  }
}

/** One weight in the unit in force: the value, and whether it is converted from the other unit. */
function weightIn(row: WeightRow, units: Units): { text: string; converted: boolean } {
  if (units === 'metric') {
    return {
      text: `${fmt(row.valueKg)} kg`,
      converted: row.printed ? row.printed.kg === null : false,
    }
  }
  const lb = row.valueLb ?? Math.round(toImperial('weight', row.valueKg))
  return { text: `${fmt(lb)} lb`, converted: row.printed ? row.printed.lb === null : true }
}

function weightRow(
  label: string,
  row: WeightRow | null,
  unread: Unread | undefined,
  units: Units,
  options: { note: string | null; calculated?: boolean; absentText?: string },
): DetailRow {
  if (!row) {
    return absent(
      label,
      unread === 'unclear' ? NOT_CLEAR : (options.absentText ?? NOT_VISIBLE),
      unread === 'unclear' ? "Can't tell" : 'Not seen',
    )
  }
  const shown = weightIn(row, units)
  const calculated = options.calculated || shown.converted
  return {
    label,
    value: shown.text,
    absentText: NOT_VISIBLE,
    ...(calculated ? CALCULATED : PRINTED),
    certainty: row.certainty,
    note: joinNotes(
      options.calculated ? null : unitEvidence(row, units, shown.converted),
      options.note,
    ),
  }
}

function capacityRow(
  capacity: CapacityRow | null,
  unread: Unread | undefined,
  units: Units,
): DetailRow {
  if (!capacity) {
    return absent(
      'CUBIC CAPACITY',
      unread === 'unclear' ? NOT_CLEAR : NOT_VISIBLE,
      unread === 'unclear' ? "Can't tell" : 'Not seen',
    )
  }
  const metric = units === 'metric'
  const converted = metric ? capacity.printed.m3 === null : capacity.printed.cuFt === null
  return {
    label: 'CUBIC CAPACITY',
    value: capacityText(capacity, metric),
    absentText: NOT_VISIBLE,
    ...(converted ? CALCULATED : PRINTED),
    certainty: capacity.certainty,
    note: capacityEvidence(capacity, metric, converted),
  }
}

/**
 * Printed maximum gross, tare and payload, payload calculated from them, and the cubic capacity (spec
 * 4.3, 4.4), in the units in force. A live run read each in both units: the evidence (agreement, a
 * disagreement with both readings, a conversion) is the row's note. A recorded sample carries kg only;
 * its lb is converted and tagged Calculated.
 */
export function weightGroup(record: InspectionRecord, units: Units = 'metric'): DetailGroup {
  const weights = record.weights
  // A live survey that did not ask the weights: not assessed, never Not seen.
  if (!weights && record.details) {
    return { id: 'weights', rows: [], notAssessed: WEIGHTS_NOT_ASSESSED }
  }
  const live = weights?.printedPayload !== undefined
  const showPrinted = live && !printedPayloadHidden(weights)
  const conflict = weights?.payloadConflict
    ? payloadConflictText(weights.payloadConflict, units)
    : (weights?.conflict ?? null)
  const doubtful = [
    weights?.maxGross?.units === 'conflict' ? 'maximum gross' : null,
    weights?.tare?.units === 'conflict' ? 'tare' : null,
  ].filter((name): name is string => name !== null)
  const inheritedDoubt =
    weights?.payload?.certainty === 'Uncertain' ? inheritedDoubtText(doubtful) : null
  const rows: DetailRow[] = [
    weightRow('MAX GROSS', weights?.maxGross ?? null, weights?.unread?.maxGross, units, {
      note: MAXIMUM_NOTE,
    }),
    weightRow('TARE', weights?.tare ?? null, weights?.unread?.tare, units, { note: null }),
  ]
  if (showPrinted) {
    rows.push(
      weightRow(
        'PAYLOAD',
        weights?.printedPayload ?? null,
        weights?.unread?.printedPayload,
        units,
        { note: PAYLOAD_NOTE },
      ),
    )
  }
  const payload = weights?.payload ?? null
  rows.push(
    weightRow(live ? 'PAYLOAD (CALCULATED)' : 'PAYLOAD', payload, undefined, units, {
      calculated: true,
      absentText: PAYLOAD_NOT_CALCULATED,
      note: joinNotes(
        conflict,
        payload && !conflict ? MAXIMUM_MINUS_TARE : null,
        conflict ? null : inheritedDoubt,
      ),
    }),
  )
  if (weights?.capacity !== undefined) {
    rows.push(capacityRow(weights.capacity, weights.unread?.capacity, units))
  }
  return { id: 'weights', notAssessed: null, rows }
}

function checkRow(label: string, check: CheckReading): DetailRow {
  if (check.answer === null) return absent(label, NOT_CLEAR, check.certainty)
  return {
    label,
    value: yesNoText(check.answer),
    absentText: NOT_CLEAR,
    ...MODEL_SELECTED,
    certainty: check.certainty,
    note: check.conflict,
  }
}

/** Reefer, open top, tank and flat rack, each its own yes/no/unknown row. */
export function equipmentGroup(record: InspectionRecord): DetailGroup {
  const details = record.details
  if (!details) return { id: 'equipment', rows: [], notAssessed: EQUIPMENT_NOT_ASSESSED }
  return {
    id: 'equipment',
    notAssessed: null,
    rows: EQUIPMENT_CHECKS.map((c) => checkRow(EQUIPMENT_LABEL[c], details.equipment[c])),
  }
}

/** Every group, in panel order. */
export function detailGroups(record: InspectionRecord, units: Units = 'metric'): DetailGroup[] {
  return [sizeGroup(record), weightGroup(record, units), equipmentGroup(record)]
}
