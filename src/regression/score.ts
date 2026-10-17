import { chosenLength } from '../domain/chosenLength'
import type { InspectionRecord } from '../domain/inspection'

// The regression set (spec #51, ticket #61): what each recorded run read, scored field by field against
// what the photo itself shows. Expected values are hand-written (expected.json), never taken from a model.

/** What a photo truly shows. `null`: the photo shows none of it, so a model should give none. */
export interface Expected {
  /** The photo, as a recording names it. */
  photo: string
  containerId: string | null
  sizeCode: string | null
  maxGrossKg: number | null
  tareKg: number | null
  /** The payload as printed, or max gross minus tare. */
  payloadKg: number | null
  face: string
  lengthFt: 20 | 40 | 45
  /** Whether the photo shows any damage a careful look would list. */
  damage: 'none' | 'some'
}

export const SCORE_FIELDS = [
  'id',
  'size',
  'maxGross',
  'tare',
  'payload',
  'face',
  'length',
  'damage',
] as const
export type ScoreField = (typeof SCORE_FIELDS)[number]

/** hit: read as expected. miss: read differently (or invented where the photo shows none). unread: no answer. */
export type ScoreResult = 'hit' | 'miss' | 'unread'

export interface FieldScore {
  field: ScoreField
  result: ScoreResult
}

function compare<T>(read: T | null | undefined, truth: T | null): ScoreResult {
  if (read === null || read === undefined) return truth === null ? 'hit' : 'unread'
  return read === truth ? 'hit' : 'miss'
}

export function scoreRecord(record: InspectionRecord, expected: Expected): FieldScore[] {
  const weights = record.weights
  const damage = record.damage
  const damageRead = damage ? (damage.findings.length > 0 ? 'some' : 'none') : null
  const lengthRead = record.sizeCode || record.modelLength ? chosenLength(record).feet : null
  const results: Record<ScoreField, ScoreResult> = {
    id: compare(record.containerId?.value, expected.containerId),
    size: compare(record.sizeCode?.code, expected.sizeCode),
    maxGross: compare(weights?.maxGross?.valueKg, expected.maxGrossKg),
    tare: compare(weights?.tare?.valueKg, expected.tareKg),
    payload: compare(
      weights?.printedPayload?.valueKg ?? weights?.payload?.valueKg,
      expected.payloadKg,
    ),
    face: compare(record.photoFace?.face, expected.face),
    length: compare(lengthRead, expected.lengthFt),
    damage: damageRead === null ? 'unread' : damageRead === expected.damage ? 'hit' : 'miss',
  }
  return SCORE_FIELDS.map((field) => ({ field, result: results[field] }))
}

export interface ScoredRow {
  /** The row label: a model, or a model on a photo. */
  model: string
  scores: FieldScore[]
}

/** A plain-text table: one row per label, one column per field. */
export function formatScoreTable(rows: readonly ScoredRow[]): string {
  const fields = rows[0]?.scores.map((s) => s.field) ?? []
  const labelWidth = Math.max(5, ...rows.map((r) => r.model.length))
  const widths = fields.map((f) => Math.max(f.length, 6))
  const line = (label: string, cells: string[]) =>
    [label.padEnd(labelWidth), ...cells.map((c, i) => c.padEnd(widths[i] ?? 0))]
      .join('  ')
      .trimEnd()
  return [
    line('', [...fields]),
    ...rows.map((r) =>
      line(
        r.model,
        r.scores.map((s) => s.result),
      ),
    ),
  ].join('\n')
}
