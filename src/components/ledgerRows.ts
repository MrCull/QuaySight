// What the readings ledger shows (design-system ReadingsLedger and DoorFace), from the record. Pure.
//
// Each reading painted on a container's rear doors gets a row beside the door drawing, level with where it
// is normally stencilled: the container ID, the size-type code, the weight block and the seal on the right
// leaf; the DG placard and the high-container caution on the left. The rows reuse the Container details and
// Markings builders, so the words, certainties and notes are the same; whatever the ledger shows is left
// out of those cards (LEDGER_DETAIL_LABELS, ledgerMarkingLabels).
import { placardInDoubt } from '../domain/keyFacts'
import { idResultState, visibleAlternatives } from '../domain/certainty'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'
import type { Units } from '../domain/unitPreference'
import { sizeGroup, weightGroup, type DetailRow } from './containerDetailRows'
import { PRINTED } from './containerDetailWording'
import { markingRows } from './markingRows'
import { placardRows } from './placardRows'
import { charState, idCells, idLayout, idSpelled, idTags, type CharState } from './idDisplay'
import { DETAIL_IDS } from '../composables/detailJump'

/** Where a slot is painted on the door, in the DoorFace's own 600 x 620 coordinates (its middle height). */
export const SLOT_Y = {
  id: 70,
  type: 112,
  gross: 201,
  tare: 227,
  net: 253,
  cube: 279,
  seal: 412,
  caution: 76,
  placard: 330,
} as const
export type Slot = keyof typeof SLOT_Y

/** The door's own width in its coordinates: a slot's page height is SLOT_Y × drawn width ÷ DOOR_WIDTH. */
export const DOOR_WIDTH = 600

export interface LedgerChar {
  ch: string
  state: CharState
  /** The container ID's check digit, drawn boxed. */
  check?: boolean
}

export interface LedgerTag {
  text: string
  modifier: string
}

export interface LedgerRow {
  key: string
  side: 'left' | 'right'
  /** The reading glyph: qs-glyph--{glyph}. */
  glyph:
    | 'tag'
    | 'container'
    | 'weight'
    | 'scale'
    | 'package'
    | 'cube'
    | 'padlock'
    | 'hazard'
    | 'height'
  label: string
  /** The reading character by character, in groups (a space between groups); null for a reading in words. */
  groups: LedgerChar[][] | null
  /** kg, lb, m³ or cu ft after the number. */
  unit: string | null
  /** A reading in words, or why there is no value ("No seal visible in this photo"). */
  words: string | null
  certainty: CertaintyLabel
  tags: LedgerTag[]
  /** Plausible alternative IDs, each as printed ("PPHH 888884 7"). */
  alternatives: string[]
  note: string | null
  /** Where it is painted on the door; null for a reading with no place there (a calculated payload). */
  slot: Slot | null
  /** The detail section a key-facts tile leads to. */
  detail: string | null
  /** The reading spelt out for a screen reader. */
  spoken: string | null
}

/** What the DoorFace paints. A slot left out is not painted: nothing read, nothing drawn. */
export interface DoorPaint {
  id?: { text: string; check: string; state: CharState }
  type?: { text: string; state: CharState }
  gross?: { text: string; state: CharState }
  tare?: { text: string; state: CharState }
  net?: { text: string; state: CharState }
  cube?: { text: string; state: CharState }
  seal?: boolean
  placard?: 'seen' | 'unseen'
  caution?: boolean
}

export interface LedgerModel {
  rows: LedgerRow[]
  door: DoorPaint
  /** The Markings card rows the ledger shows instead, so they are not said twice. */
  markingLabels: string[]
}

/** Rows of the Container details card that the ledger shows instead. */
export const LEDGER_DETAIL_LABELS = [
  'ISO CODE',
  'MAX GROSS',
  'TARE',
  'PAYLOAD',
  'PAYLOAD (CALCULATED)',
  'CUBIC CAPACITY',
] as const

const STATE_ORDER: CharState[] = [undefined, 'likely', 'uncertain', 'unknown']
/** The weakest of a reading's characters: one underline on the drawing stands for all of them. */
function weakest(states: CharState[]): CharState {
  return states.reduce<CharState>(
    (worst, s) => (STATE_ORDER.indexOf(s) > STATE_ORDER.indexOf(worst) ? s : worst),
    undefined,
  )
}

const spread = (text: string, state: CharState): LedgerChar[] =>
  [...text].map((ch) => ({ ch, state }))

const tag = (provenance: string, provenanceClass: string): LedgerTag[] =>
  provenance ? [{ text: provenance, modifier: provenanceClass }] : []

/** "Also possible: QSIU 307478 1": a full ID as printed, an unread position as a middle dot. */
function groupedId(id: string): string {
  const marked = id.replace(/\?/g, '·')
  return marked.length === 11
    ? `${marked.slice(0, 4)} ${marked.slice(4, 10)} ${marked.slice(10)}`
    : marked
}

function idRow(record: InspectionRecord, door: DoorPaint): LedgerRow | null {
  const reading = record.containerId
  const base = {
    key: 'id',
    side: 'right' as const,
    glyph: 'tag' as const,
    label: 'ID',
    unit: null,
    slot: 'id' as const,
    detail: DETAIL_IDS.id,
    alternatives: [] as string[],
  }
  if (!reading) {
    if (record.differentContainers) return null
    return {
      ...base,
      groups: null,
      words: 'Not read from this photo',
      certainty: "Can't tell",
      tags: [],
      note: null,
      spoken: null,
      slot: null,
    }
  }
  if (idResultState(reading) === 'insufficient') {
    return {
      ...base,
      groups: null,
      words: 'ID not readable in this photo',
      certainty: reading.certainty,
      tags: [],
      note: null,
      spoken: null,
      slot: null,
    }
  }
  const cells = idCells(reading)
  const layout = idLayout(cells)
  const groups: LedgerChar[][] = [
    ...layout.groups.map((g) => g.map((c) => ({ ch: c.ch, state: c.state }))),
    [{ ch: layout.check.ch, state: layout.check.state, check: true }],
  ]
  const alternatives = visibleAlternatives(reading).map(groupedId)
  door.id = {
    text: `${cells
      .slice(0, 4)
      .map((c) => c.ch)
      .join('')} ${cells
      .slice(4, 10)
      .map((c) => c.ch)
      .join('')}`,
    check: layout.check.ch,
    state: weakest(cells.map((c) => c.state)),
  }
  return {
    ...base,
    groups,
    words: null,
    certainty: reading.certainty,
    tags: idTags(reading, cells),
    alternatives,
    note: null,
    spoken: idSpelled(reading, cells),
  }
}

/** The size-type code as printed, with what it means in words when it was read at Confident or Likely. */
function typeRow(record: InspectionRecord, door: DoorPaint): LedgerRow | null {
  const code = sizeGroup(record).rows.find((r) => r.label === 'ISO CODE')
  if (!code) return null
  const base = {
    key: 'type',
    side: 'right' as const,
    glyph: 'container' as const,
    label: 'Type',
    unit: null,
    detail: null,
    spoken: null,
    alternatives: [],
  }
  if (code.value === null) {
    return {
      ...base,
      groups: null,
      words: code.absentText,
      certainty: code.certainty,
      tags: [],
      note: null,
      slot: null,
    }
  }
  const state = charState(code.certainty)
  door.type = { text: code.value, state }
  const size = record.sizeCode
  const plain =
    size && (size.certainty === 'Confident' || size.certainty === 'Likely') ? size.summary : null
  return {
    ...base,
    groups: [spread(code.value, state)],
    words: null,
    certainty: code.certainty,
    tags: tag(code.provenance, code.provenanceClass),
    note: plain ?? code.note,
    slot: 'type',
  }
}

interface WeightSpec {
  key: string
  label: string
  glyph: LedgerRow['glyph']
  /** Where a printed value of this row is painted; a calculated one is not painted. */
  slot: 'gross' | 'tare' | 'net' | 'cube' | null
}

const WEIGHTS: Record<string, WeightSpec> = {
  'MAX GROSS': { key: 'gross', label: 'Max gross', glyph: 'weight', slot: 'gross' },
  TARE: { key: 'tare', label: 'Tare', glyph: 'scale', slot: 'tare' },
  PAYLOAD: { key: 'net', label: 'Payload', glyph: 'package', slot: 'net' },
  'PAYLOAD (CALCULATED)': { key: 'payload', label: 'Payload', glyph: 'package', slot: null },
  'CUBIC CAPACITY': { key: 'cube', label: 'Cu. cap.', glyph: 'cube', slot: 'cube' },
}

/** "32,500 kg" → the number, then the unit. */
function splitUnit(value: string): { number: string; unit: string | null } {
  const space = value.indexOf(' ')
  return space < 0
    ? { number: value, unit: null }
    : { number: value.slice(0, space), unit: value.slice(space + 1) }
}

function weightRows(record: InspectionRecord, units: Units, door: DoorPaint): LedgerRow[] {
  const group = weightGroup(record, units)
  return group.rows.flatMap((row: DetailRow): LedgerRow[] => {
    const spec = WEIGHTS[row.label]
    if (!spec) return []
    // Painted on the door only when printed there; a value worked out (or converted) has no place on it.
    const printed =
      row.value !== null && row.provenance === PRINTED.provenance && spec.slot !== null
    const base = {
      // A recorded sample's payload is labelled PAYLOAD but worked out: it is the calculated row.
      key: spec.key === 'net' && row.value !== null && !printed ? 'payload' : spec.key,
      side: 'right' as const,
      glyph: spec.glyph,
      label: spec.label,
      certainty: row.certainty,
      detail: null,
      spoken: null,
      alternatives: [],
      slot: printed ? spec.slot : null,
    }
    if (row.value === null) {
      return [{ ...base, groups: null, unit: null, words: row.absentText, tags: [], note: null }]
    }
    const { number, unit } = splitUnit(row.value)
    const state = charState(row.certainty)
    if (printed && spec.slot) door[spec.slot] = { text: row.value, state }
    return [
      {
        ...base,
        groups: [spread(number, state)],
        unit,
        words: null,
        tags: tag(row.provenance, row.provenanceClass),
        note: row.note,
      },
    ]
  })
}

function sealRow(record: InspectionRecord, door: DoorPaint): LedgerRow | null {
  const seal = record.seal
  if (!seal) return null
  const base = {
    key: 'seal',
    side: 'right' as const,
    glyph: 'padlock' as const,
    label: 'Seal',
    unit: null,
    certainty: seal.certainty,
    tags: [],
    alternatives: [],
    note: null,
    detail: DETAIL_IDS.seal,
  }
  if (!seal.visible) {
    return {
      ...base,
      groups: null,
      words: 'No seal visible in this photo',
      slot: null,
      spoken: null,
    }
  }
  door.seal = true
  if (!seal.characters.some((c) => c.value !== null)) {
    return {
      ...base,
      groups: null,
      words: 'A seal is visible, number not readable in this photo',
      slot: 'seal',
      spoken: null,
    }
  }
  const chars = seal.characters.map((c): LedgerChar => ({
    ch: c.value ?? '?',
    state: c.value === null ? 'unknown' : charState(c.certainty),
  }))
  return {
    ...base,
    alternatives: seal.alternative ? [seal.alternative] : [],
    groups: [chars],
    words: null,
    slot: 'seal',
    spoken: seal.characters
      .map((c, i) =>
        c.value === null
          ? `position ${i + 1} not read`
          : c.certainty === 'Confident'
            ? c.value
            : `${c.value} (${c.certainty.toLowerCase()})`,
      )
      .join(' '),
  }
}

/**
 * The DG placard as one row on the left of the door: the placard summary when the run read placards
 * (each placard keeps its own row, with its crop, in the Markings card), else the survey's DG placard row.
 */
function placardRow(record: InspectionRecord, door: DoorPaint): LedgerRow | null {
  const base = {
    key: 'placard',
    side: 'left' as const,
    glyph: 'hazard' as const,
    label: 'DG placard',
    groups: null,
    unit: null,
    tags: [],
    alternatives: [],
    detail: DETAIL_IDS.markings,
    spoken: null,
  }
  const reading = record.placards
  if (reading) {
    const head = placardRows(record)[0]
    if (!head) return null
    const count = reading.placards.length
    // A placard below Likely is drawn as the dashed outline, never in hazard colour.
    door.placard =
      reading.answer === 'present'
        ? placardInDoubt(reading.certainty)
          ? 'unseen'
          : 'seen'
        : reading.answer === 'none'
          ? 'unseen'
          : undefined
    return {
      ...base,
      label: 'Placards',
      words:
        reading.answer === 'present' && count > 1
          ? `${count} placards seen`
          : (head.badge?.text ?? head.absentText),
      certainty: head.certainty,
      note: count > 1 ? null : (head.badge?.caveat ?? null),
      slot: door.placard ? 'placard' : null,
    }
  }
  const dg = markingRows(record)?.find((r) => r.label === 'DG PLACARD')
  if (!dg) return null
  door.placard =
    dg.badge?.hazard && !placardInDoubt(dg.certainty) ? 'seen' : dg.badge ? 'unseen' : undefined
  return {
    ...base,
    words: dg.badge?.text ?? dg.absentText,
    certainty: dg.certainty,
    note: dg.badge?.caveat ?? null,
    slot: door.placard ? 'placard' : null,
  }
}

/** The high-container caution, drawn as the stripes at the top corners, only when it was seen. */
function cautionRow(record: InspectionRecord, door: DoorPaint): LedgerRow | null {
  const row = markingRows(record)?.find((r) => r.label === 'HIGH CONTAINER')
  if (!row?.badge) return null
  door.caution = true
  return {
    key: 'caution',
    side: 'left',
    glyph: 'height',
    label: 'High container',
    groups: null,
    unit: null,
    words: row.badge.text,
    certainty: row.certainty,
    tags: [],
    alternatives: [],
    note: row.badge.caveat,
    slot: 'caution',
    detail: null,
    spoken: null,
  }
}

/** Every ledger row, top to bottom on each side, and what the door paints. */
export function ledgerModel(
  record: InspectionRecord,
  units: Units = 'metric',
  parts: { id: boolean; details: boolean } = { id: true, details: true },
): LedgerModel {
  const door: DoorPaint = {}
  const rows: (LedgerRow | null)[] = []
  if (parts.id) rows.push(idRow(record, door))
  if (parts.details) {
    rows.push(typeRow(record, door), ...weightRows(record, units, door))
  }
  if (parts.id) rows.push(sealRow(record, door))
  if (parts.details) rows.push(cautionRow(record, door), placardRow(record, door))
  const shown = rows.filter((r): r is LedgerRow => r !== null)
  // A run that read the placards keeps one row per placard, with its crop, in the Markings card; only
  // its summary row ("No placards seen") moves here.
  const markingLabels = [
    ...(shown.some((r) => r.key === 'caution') ? ['HIGH CONTAINER'] : []),
    ...(shown.some((r) => r.key === 'placard')
      ? [record.placards ? 'PLACARDS' : 'DG PLACARD']
      : []),
  ]
  return { rows: shown, door, markingLabels }
}

/**
 * Where each row goes down one side of the door: as near its ideal top (level with its slot) as it can,
 * never overlapping the row above (`gap` apart). Rows are taken in order; returns each row's top.
 */
export function placeRows(rows: { ideal: number | null; height: number }[], gap: number): number[] {
  const tops: number[] = []
  let floor = 0
  for (const row of rows) {
    const top = Math.max(row.ideal ?? floor, floor)
    tops.push(top)
    floor = top + row.height + gap
  }
  return tops
}
