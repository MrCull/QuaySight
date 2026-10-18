import { idCloseUp, sealCloseUp } from '../domain/closeUpSources'
import { chosenLength } from '../domain/chosenLength'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'

// The regression set (spec #51, ticket #61): what each recorded run read, scored field by field against
// what the photo itself shows. Expected values are hand-written (expected.json), never taken from a model.

/** One photo of an inspection, as the expected entry lists it. */
export interface ExpectedPhoto {
  /** The photo, as a recording names it. */
  photo: string
  /** Every face the photo shows, the main face first. A close-up is `['close-up']`. */
  faces: string[]
  /** Set on a close-up photo: what it shows. */
  closeUp?: 'seal' | 'id' | 'weights' | 'placard' | 'damage'
  /** What the photo shows that the faces do not say, such as which long side. Not scored. */
  note?: string
}

/**
 * What one inspection (1 to 5 photos of one container) truly shows. `null`: the photos show none of it,
 * so a model should give none.
 */
export interface Expected {
  /** The entry's name. */
  id: string
  /** The photos, in the order they are given to the inspection. */
  photos: ExpectedPhoto[]
  containerId: string | null
  sizeCode: string | null
  maxGrossKg: number | null
  tareKg: number | null
  /** The payload as printed, or max gross minus tare. */
  payloadKg: number | null
  /** The seal number as printed; null when no seal is shown. */
  seal: string | null
  /** The ID certainty the photos justify; null when there is no ID. */
  idCertainty: CertaintyLabel | null
  /** Whether "Also possible" alternatives may be shown for the ID. */
  alternativesAllowed: boolean
  /** Whether the "different containers" warning is expected. */
  differentContainersWarning: boolean
  /** The 1-based photo each close-up (beside the ID, beside the seal) is expected to come from; null: none. */
  closeUpFrom: { id: number | null; seal: number | null }
  lengthFt: 20 | 40 | 45
  /** Whether the photos show any damage a careful look would list. */
  damage: 'none' | 'some'
}

/** The fields of the original single-photo score, in their original order. */
export const ORIGINAL_SCORE_FIELDS = [
  'id',
  'size',
  'maxGross',
  'tare',
  'payload',
  'face',
  'length',
  'damage',
] as const

export const SCORE_FIELDS = [
  ...ORIGINAL_SCORE_FIELDS,
  'seal',
  'idCertainty',
  'alternatives',
  'differentContainers',
  'faces',
  'closeUps',
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

/** The faces each photo was given, in photo order; a single photo's record has its one face. */
function facesRead(record: InspectionRecord): (string | null)[] {
  if (record.photos) return record.photos.map((p) => p.face?.face ?? null)
  return record.photoFace ? [record.photoFace.face] : []
}

/** The 1-based photo a close-up on screen is cut from (closeUpSources.ts); null when none is shown. */
const closeUpPhoto = (source: { photo: number } | null) => source?.photo ?? null

/** The face of the first photo that is not a close-up: the one the record's own face stands for. */
function firstFace(expected: Expected): string | null {
  return (expected.photos.find((p) => !p.closeUp) ?? expected.photos[0])?.faces[0] ?? null
}

function scoreSeal(record: InspectionRecord, expected: Expected): ScoreResult {
  const seal = record.seal
  if (!seal) return expected.seal === null ? 'hit' : 'unread'
  const read = seal.visible && seal.value !== '' ? seal.value : null
  return compare(read, expected.seal)
}

function scoreFaces(record: InspectionRecord, expected: Expected): ScoreResult {
  const read = facesRead(record)
  if (read.length === 0) return 'unread'
  const truth = expected.photos.map((p) => p.faces[0])
  if (read.length !== truth.length) return 'miss'
  if (read.some((f) => f === null)) return 'unread'
  return read.every((f, i) => f === truth[i]) ? 'hit' : 'miss'
}

function scoreCloseUps(record: InspectionRecord, expected: Expected): ScoreResult {
  const read = { id: closeUpPhoto(idCloseUp(record)), seal: closeUpPhoto(sealCloseUp(record)) }
  const truth = expected.closeUpFrom
  if (read.id === truth.id && read.seal === truth.seal) return 'hit'
  const absent = read.id === null && read.seal === null
  const wanted = truth.id !== null || truth.seal !== null
  return absent && wanted ? 'unread' : 'miss'
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
    face: compare(record.photoFace?.face, firstFace(expected)),
    length: compare(lengthRead, expected.lengthFt),
    damage: damageRead === null ? 'unread' : damageRead === expected.damage ? 'hit' : 'miss',
    seal: scoreSeal(record, expected),
    idCertainty: compare(record.containerId?.certainty, expected.idCertainty),
    alternatives:
      !expected.alternativesAllowed && (record.containerId?.alternatives?.length ?? 0) > 0
        ? 'miss'
        : 'hit',
    differentContainers:
      (record.differentContainers === true) === expected.differentContainersWarning
        ? 'hit'
        : 'miss',
    faces: scoreFaces(record, expected),
    closeUps: scoreCloseUps(record, expected),
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
