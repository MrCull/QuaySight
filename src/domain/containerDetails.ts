// Container details read by the survey (spec 4.3, 4.4; ticket #32). Pure: questions in the shared
// format, and the answers read back by meaning into the record's `details`.
//
// - The ISO size/type code is a whole-code choice among common codes, plus other, unreadable and not
//   visible, so the model is never forced into a wrong common answer. What it decodes to comes from the
//   app's table (isoSizeCode.ts), never from the model.
// - Reefer, open top, tank and flat rack are separate yes/no/unknown checks.
// - Super Heavy, high-container, overwidth, fumigation and marine pollutant are separate checks: a
//   high-container caution is never reported as overwidth.
// - The DG placard is its class and symbol only; its absence is "no DG placard visible", never a claim
//   about the cargo.
//
// Weights (max gross, tare, payload, capacity) are not asked here yet; they land in `record.weights`.
//
// The shapes and tables are in containerDetailTypes.ts, the questions in containerDetailQuestions.ts and
// the conflict wording in containerDetailWording.ts (ticket #54); the first two are re-exported here.
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel, InspectionRecord } from './inspection'
import { decodeSizeCode, type EquipmentType } from './isoSizeCode'
import type { SharedAnswer } from './questionSet'
import type { SurveyPart } from './survey'
import { detailsExport } from './detailsExport'
import { sizeCodeLine } from './exportWording'
import type { FamilyExport } from './questionRegistry'
import {
  COMMON_SIZE_CODES,
  DETAIL_QUESTION_NAMES,
  DG_CLASSES,
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  SIZE_CODE_NOT_VISIBLE,
  SIZE_CODE_OTHER,
  SIZE_CODE_UNREADABLE,
  type CheckReading,
  type ContainerDetailsReading,
  type DgPlacardReading,
  type EquipmentCheck,
  type SizeCodeReading,
} from './containerDetailTypes'
import { containerDetailQuestions } from './containerDetailQuestions'
import { codeSaysButPhotoNotText, photoSaysButCodeNotText } from './containerDetailWording'

export * from './containerDetailTypes'
export { containerDetailQuestions }

// ---------------------------------------------------------------------------------------------------
// Answers

/** A plausible other value needs at least this probability to be shown. */
const ALTERNATIVE_MIN = 0.15

interface ChoiceRead {
  value: string
  certainty: CertaintyLabel
  /** The most probable other value, with its probability. */
  runnerUp: { value: string; probability: number } | null
}

/** The chosen value and its certainty from its probability and its margin over the next value. */
function readChoice(answer: SharedAnswer | undefined): ChoiceRead | null {
  if (answer?.type !== 'choice') return null
  const chosen = answer.probabilities[answer.value] ?? answer.confidence
  if (chosen === null || chosen === undefined) return null
  const others = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .sort((a, b) => b[1] - a[1])
  const best = others[0]
  return {
    value: answer.value,
    certainty: applyMargin(certaintyOfProbability(chosen), chosen, best?.[1] ?? null),
    runnerUp: best ? { value: best[0], probability: best[1] } : null,
  }
}

const UNCLEAR = "Can't tell" as const

function readSizeCode(answer: SharedAnswer | undefined): SizeCodeReading {
  const unclear: SizeCodeReading = {
    state: 'unclear',
    code: null,
    certainty: UNCLEAR,
    source: 'printed',
    alternative: null,
    decoded: null,
  }
  const read = readChoice(answer)
  if (!read || read.certainty === UNCLEAR) return unclear
  switch (read.value) {
    case SIZE_CODE_NOT_VISIBLE:
      return { ...unclear, state: 'not-visible', certainty: 'Not seen' }
    case SIZE_CODE_UNREADABLE:
      return { ...unclear, state: 'unreadable' }
    case SIZE_CODE_OTHER:
      return { ...unclear, state: 'other', certainty: read.certainty }
  }
  const common: readonly string[] = COMMON_SIZE_CODES
  const runnerUp = read.runnerUp
  return {
    state: 'read',
    code: read.value,
    certainty: read.certainty,
    source: 'printed',
    alternative:
      runnerUp && runnerUp.probability >= ALTERNATIVE_MIN && common.includes(runnerUp.value)
        ? runnerUp.value
        : null,
    decoded: decodeSizeCode(read.value, read.certainty),
  }
}

function readCheck(answer: SharedAnswer | undefined, marking: boolean): CheckReading {
  const read = readChoice(answer)
  const value = read?.value
  if (!read || read.certainty === UNCLEAR || (value !== 'yes' && value !== 'no')) {
    return { answer: null, certainty: UNCLEAR, source: 'observed', conflict: null }
  }
  return {
    answer: value,
    certainty: marking && value === 'no' ? 'Not seen' : read.certainty,
    source: 'observed',
    conflict: null,
  }
}

function readDgPlacard(answer: SharedAnswer | undefined): DgPlacardReading {
  const read = readChoice(answer)
  if (!read || read.certainty === UNCLEAR) {
    return { answer: null, dgClass: null, symbol: null, certainty: UNCLEAR }
  }
  if (read.value === 'none') {
    return { answer: 'none', dgClass: null, symbol: null, certainty: 'Not seen' }
  }
  const dgClass = /^class_(\d)$/.exec(read.value)?.[1]
  const known = dgClass ? DG_CLASSES[Number(dgClass)] : undefined
  return {
    answer: 'placard',
    dgClass: known ? Number(dgClass) : null,
    symbol: known?.symbol ?? null,
    certainty: read.certainty,
  }
}

/** The equipment each check stands for, as the decoded type code names it. */
const CHECK_EQUIPMENT: Record<EquipmentCheck, readonly EquipmentType[]> = {
  reefer: ['reefer'],
  openTop: ['open-top'],
  tank: ['tank'],
  flatRack: ['flat-rack', 'platform'],
}

function weakerThanLikely(certainty: CertaintyLabel): CertaintyLabel {
  return certainty === 'Confident' || certainty === 'Likely' ? 'Uncertain' : certainty
}

/**
 * A check that disagrees with the decoded code keeps its answer, gains a plain note and reads no more
 * than Uncertain. Only a code read Likely or better is weighed against a check.
 */
function withCodeConflict(
  check: EquipmentCheck,
  reading: CheckReading,
  code: SizeCodeReading,
): CheckReading {
  const decoded = code.decoded
  if (!decoded || reading.answer === null) return reading
  if (code.certainty !== 'Confident' && code.certainty !== 'Likely') return reading
  const codeSays = CHECK_EQUIPMENT[check].includes(decoded.type.equipment)
  if (codeSays && reading.answer === 'no') {
    return {
      ...reading,
      certainty: weakerThanLikely(reading.certainty),
      conflict: codeSaysButPhotoNotText(check, decoded.code),
    }
  }
  if (!codeSays && reading.answer === 'yes') {
    return {
      ...reading,
      certainty: weakerThanLikely(reading.certainty),
      conflict: photoSaysButCodeNotText(check, decoded.code, decoded.type.label),
    }
  }
  return reading
}

function mapRecord<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>
}

/** The details as read, by meaning. A question with no clear answer is unread, never filled in. */
export function readContainerDetails(
  answers: Record<string, SharedAnswer>,
): ContainerDetailsReading {
  const names = DETAIL_QUESTION_NAMES
  const sizeCode = readSizeCode(answers[names.sizeCode])
  return {
    sizeCode,
    equipment: mapRecord(EQUIPMENT_CHECKS, (c) =>
      withCodeConflict(c, readCheck(answers[names.equipment[c]], false), sizeCode),
    ),
    markings: mapRecord(MARKING_CHECKS, (c) => readCheck(answers[names.markings[c]], true)),
    dgPlacard: readDgPlacard(answers[names.dgPlacard]),
  }
}

/** The details on the record. The decoded code also fills `sizeCode`, which exports and summaries read. */
export function applyContainerDetails(
  record: InspectionRecord,
  details: ContainerDetailsReading,
): InspectionRecord {
  return { ...record, details, sizeCode: details.sizeCode.decoded }
}

/**
 * What the details add to the exports: a live survey's printed code, what it decodes to, the checks and the
 * markings; without a survey, the decoded size code a recorded run carries, or that it is not read.
 */
function containerDetailsExport(record: InspectionRecord): FamilyExport {
  if (record.details) return detailsExport(record.details)
  const out: FamilyExport = { values: [], unresolved: [], conflicts: [], summary: [] }
  if (record.sizeCode) {
    for (const [field, value] of [
      ['sizeCode', record.sizeCode.code],
      ['sizeCode.meaning', record.sizeCode.summary],
    ] as const) {
      out.values.push({
        field,
        category: 'derived',
        value,
        provenance: 'decoded',
        certainty: record.sizeCode.certainty,
        uncertainty: null,
      })
    }
    out.summary.push(
      sizeCodeLine(record.sizeCode.code, record.sizeCode.summary, record.sizeCode.certainty),
    )
  } else {
    out.unresolved.push({
      field: 'sizeCode',
      category: 'unresolved',
      reason: 'Not read or not decoded.',
    })
  }
  return out
}

/** The question family for the container details. */
export const containerDetailsPart: SurveyPart = {
  key: 'details',
  questions: () => containerDetailQuestions(),
  read: (answers) => readContainerDetails(answers),
  apply: applyContainerDetails,
  export: containerDetailsExport,
}
