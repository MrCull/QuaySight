// The container-ID question family (spec #51, ticket #59): the character questions and the owner-code
// question, how their answers combine into one reading, and what the reading adds to the record and the
// exports. Pure. The question wording is in idQuestions.ts and ownerPick.ts, the combining of owner and
// letters in luna.ts and jev.ts; this declares them as one family for the registry.
import {
  JEV_STATE_INSTRUCTIONS,
  LUNA_IDENTIFICATION_INSTRUCTIONS,
  jevIdQuestionSet,
  lunaIdQuestionSet,
  readIdCharacters,
  type ChoiceReading,
} from './idQuestions'
import { idResultState } from './certainty'
import type { ContainerIdReading, InspectionRecord } from './inspection'
import { jevIdReadingOf, type JevBox } from './jev'
import { assembleLunaReading } from './luna'
import { readOwnerPick, type OwnerPick } from './ownerPick'
import type { FamilyExport, QuestionFamily } from './questionRegistry'
import {
  alsoPossibleLine,
  checkDigitLine,
  idLine,
  idNotReadableLine,
  recheckLine,
} from './exportWording'

/** What the ID questions read: the ID as read, each position, the owner pick and where the ID is. */
export interface IdFinding {
  containerId: ContainerIdReading
  /** Per-position readings (11). Luna's re-check asks the unread ones again. */
  readings: ChoiceReading[]
  /** The model's pick from the owner-code list; the re-check and the crop read combine their readings with it. */
  ownerPick: OwnerPick | null
  /** Where the ID is in the photo, on box-capable models that answered; otherwise null (the crop read starts from it). */
  box: JevBox | null
}

declare module './survey' {
  interface SurveyFindings {
    id: IdFinding
  }
}

const LUNA_SURVEY_INSTRUCTIONS = `${LUNA_IDENTIFICATION_INSTRUCTIONS} The questions after the container identification ask about the container's other markings and its type; answer each from what is visible in this photo.`

/** The ID reading, or null when too little of it was read to show (it is then exported as not read). */
function readableId(record: InspectionRecord) {
  const reading = record.containerId
  return reading && idResultState(reading) !== 'insufficient' ? reading : null
}

function unreadPositions(value: string): number[] {
  return [...value].flatMap((ch, i) => (ch === '?' ? [i] : []))
}

function idExport(record: Parameters<NonNullable<QuestionFamily['export']>>[0]): FamilyExport {
  const out: FamilyExport = {
    values: [],
    unresolved: [],
    conflicts: [],
    summary: [],
    candidates: [],
  }
  const reading = readableId(record)
  if (reading) {
    out.values.push({
      field: 'containerId',
      category: 'printed',
      value: reading.value,
      provenance: 'printed',
      certainty: reading.certainty,
      uncertainty: reading.uncertainty ?? null,
    })
    for (const index of unreadPositions(reading.value)) {
      out.unresolved.push({
        field: `containerId.position[${index}]`,
        category: 'unresolved',
        reason: 'Character not read from the photo.',
      })
    }
    if (reading.observedCheckDigit === null) {
      out.unresolved.push({
        field: 'containerId.observedCheckDigit',
        category: 'unresolved',
        reason: 'Check digit not seen in the photo.',
      })
    } else {
      out.values.push({
        field: 'containerId.observedCheckDigit',
        category: 'printed',
        value: reading.observedCheckDigit,
        provenance: 'printed',
        certainty: reading.certainty,
        uncertainty: null,
      })
    }
    if (reading.calculatedCheckDigit === null) {
      out.unresolved.push({
        field: 'containerId.calculatedCheckDigit',
        category: 'unresolved',
        reason: 'Not calculated: the first ten characters are not all read.',
      })
    } else {
      out.values.push({
        field: 'containerId.calculatedCheckDigit',
        category: 'derived',
        value: reading.calculatedCheckDigit,
        provenance: 'calculated',
        certainty: null,
        uncertainty: null,
      })
    }
  } else {
    out.unresolved.push({ field: 'containerId', category: 'unresolved', reason: 'Not read.' })
  }

  out.candidates = (reading?.alternatives ?? []).map((alt) => ({
    field: 'containerId',
    category: 'candidate',
    provenance: 'candidate',
    value: alt,
  }))

  if (reading) {
    out.summary.push(idLine(reading))
    if (reading.observedCheckDigit !== null) out.summary.push(checkDigitLine(reading))
    for (const alt of out.candidates) out.summary.push(alsoPossibleLine(alt.value))
  } else if (record.containerId) {
    out.summary.push(idNotReadableLine)
  }
  for (const check of record.rechecks ?? []) out.summary.push(recheckLine(check))
  return out
}

/** The ID family, asked first in the survey: the Luna set or the Jev set by the route's question set. */
export const idFamily: QuestionFamily = {
  key: 'id',
  instructions: (ask) =>
    ask.questionSet === 'luna' ? LUNA_SURVEY_INSTRUCTIONS : JEV_STATE_INSTRUCTIONS,
  questions: (ask) =>
    (ask.questionSet === 'luna'
      ? lunaIdQuestionSet()
      : jevIdQuestionSet({ image: 'the photo', box: ask.box })
    ).questions,
  read: (answers, ask): IdFinding => {
    if (ask.questionSet === 'luna') {
      const readings = readIdCharacters(answers)
      const ownerPick = readOwnerPick(answers)
      return {
        containerId: assembleLunaReading(readings, ownerPick),
        readings,
        ownerPick,
        box: null,
      }
    }
    const jev = jevIdReadingOf(answers)
    return {
      containerId: jev.containerId,
      readings: jev.readings,
      ownerPick: jev.ownerPick,
      box: ask.box ? jev.box : null,
    }
  },
  apply: (record, finding) => ({ ...record, containerId: finding.containerId }),
  export: idExport,
}
