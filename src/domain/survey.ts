// The survey (spec #27, request A): one question set per live run that reads the container ID and
// everything else one look at the photo can answer. Pure: the set in the shared format, and the reply
// read back by meaning.
//
// The ID questions are the core (the Luna set or the Jev set, with the box on box-capable models).
// Everything else comes from survey parts: each part brings its own questions, reads its own answers and
// folds them into the record. To add questions to the survey, write a part in your own module and list
// it in SURVEY_PARTS (see notes/survey.md):
//
//   declare module './survey' { interface SurveyFindings { face: FaceReading } }
//   export const facePart: SurveyPart = { key: 'face', questions, read, apply }
import { containerDetailsPart, type ContainerDetailsReading } from './containerDetails'
import {
  JEV_STATE_INSTRUCTIONS,
  LUNA_IDENTIFICATION_INSTRUCTIONS,
  jevIdQuestionSet,
  lunaIdQuestionSet,
  readIdCharacters,
  type ChoiceReading,
} from './idQuestions'
import type { ContainerIdReading, InspectionRecord } from './inspection'
import { facePart } from './photoFace'
import { jevIdReadingOf, type JevBox } from './jev'
import { assembleLunaReading } from './luna'
import type { QuestionSet } from './providers'
import {
  questionSet,
  type SharedAnswer,
  type SharedQuestion,
  type SharedQuestionSet,
} from './questionSet'
import { weightsPart } from './weightQuestions'

/** What the survey asks depends on the route only through these. */
export interface SurveyAsk {
  /** The model maker's ID set. */
  questionSet: QuestionSet
  /** Whether the model takes box questions (catalogue). */
  box: boolean
}

/**
 * What the survey's parts read, by part key. Each part adds its own key, from its own module by
 * declaration merging, or here.
 */
export interface SurveyFindings {
  details: ContainerDetailsReading
}

interface PartOf<K extends keyof SurveyFindings> {
  key: K
  /** The part's questions. Names must be unique across the survey. */
  questions(ask: SurveyAsk): SharedQuestion[]
  /** Its answers, by meaning. A question with no usable answer is absent from `answers`. */
  read(answers: Record<string, SharedAnswer>, ask: SurveyAsk): SurveyFindings[K]
  /** Folds what it read into the record (its own fields). Omit to leave the record alone. */
  apply?(record: InspectionRecord, finding: SurveyFindings[K]): InspectionRecord
}

/** One part of the survey. */
export type SurveyPart = { [K in keyof SurveyFindings]: PartOf<K> }[keyof SurveyFindings]

/** Every part the survey asks, in question order after the ID. */
export const SURVEY_PARTS: readonly SurveyPart[] = [containerDetailsPart, facePart, weightsPart]

/** The survey's answer: the ID as read, and each part's findings. */
export interface SurveyAnswer {
  containerId: ContainerIdReading
  /** Per-position readings (11). Luna's re-check asks the unread ones again. */
  readings: ChoiceReading[]
  /** Where the ID is in the photo, on box-capable models that answered; otherwise null (the crop read starts from it). */
  box: JevBox | null
  findings: SurveyFindings
}

const LUNA_SURVEY_INSTRUCTIONS = `${LUNA_IDENTIFICATION_INSTRUCTIONS} The questions after the container identification ask about the container's other markings and its type; answer each from what is visible in this photo.`

/** The survey for one route: the ID questions, then every part's. */
export function surveyQuestionSet(
  ask: SurveyAsk,
  parts: readonly SurveyPart[] = SURVEY_PARTS,
): SharedQuestionSet {
  const id =
    ask.questionSet === 'luna'
      ? lunaIdQuestionSet()
      : jevIdQuestionSet({ image: 'the photo', box: ask.box })
  return questionSet(
    ask.questionSet === 'luna' ? LUNA_SURVEY_INSTRUCTIONS : JEV_STATE_INSTRUCTIONS,
    [...id.questions, ...parts.flatMap((part) => part.questions(ask))],
  )
}

/** The survey's answers, by meaning. */
export function readSurvey(
  answers: Record<string, SharedAnswer>,
  ask: SurveyAsk,
  parts: readonly SurveyPart[] = SURVEY_PARTS,
): SurveyAnswer {
  const findings = {} as Record<string, unknown>
  for (const part of parts) findings[part.key] = part.read(answers, ask)
  if (ask.questionSet === 'luna') {
    const readings = readIdCharacters(answers)
    return {
      containerId: assembleLunaReading(readings),
      readings,
      box: null,
      findings: findings as unknown as SurveyFindings,
    }
  }
  const jev = jevIdReadingOf(answers)
  return {
    containerId: jev.containerId,
    readings: jev.readings,
    box: ask.box ? jev.box : null,
    findings: findings as unknown as SurveyFindings,
  }
}

/** The survey's answer on the record: the ID, then each part's own fields. */
export function applySurvey(
  record: InspectionRecord,
  answer: SurveyAnswer,
  parts: readonly SurveyPart[] = SURVEY_PARTS,
): InspectionRecord {
  let next: InspectionRecord = { ...record, containerId: answer.containerId }
  for (const part of parts) {
    const apply = part.apply as
      | ((record: InspectionRecord, finding: unknown) => InspectionRecord)
      | undefined
    // A part the survey did not ask has no finding: nothing to fold in (an unread answer is not the same thing).
    if (apply && part.key in answer.findings) next = apply(next, answer.findings[part.key])
  }
  return next
}
