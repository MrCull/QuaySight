// The survey (spec #27, request A): one question set per live run that reads the container ID and
// everything else one look at the photo can answer. Pure: the set in the shared format, and the reply
// read back by meaning.
//
// The survey asks every question family of the registry (questionRegistry.ts) that names no other
// request: the ID first, then the details, face, weights and length. To add questions to the survey, write
// a family in a module of its own and list it in the registry (docs/agents/question-registry.md).
import type { ContainerDetailsReading } from './containerDetails'
import type { ChoiceReading } from './idQuestions'
import type { ContainerIdReading, InspectionRecord } from './inspection'
import type { JevBox } from './jev'
import type { OwnerPick } from './ownerPick'
import type { QuestionSet } from './providers'
import {
  SURVEY_REQUEST,
  applyFindings,
  readRequest,
  requestSet,
  type QuestionFamily,
} from './questionRegistry'
import type { SharedAnswer, SharedQuestionSet } from './questionSet'

/** What the survey asks depends on the route only through these. */
export interface SurveyAsk {
  /** The model maker's ID set. */
  questionSet: QuestionSet
  /** Whether the model takes box questions (catalogue). */
  box: boolean
}

/**
 * What the question families read, by family key. Each family adds its own key, from its own module by
 * declaration merging, or here.
 */
export interface SurveyFindings {
  details: ContainerDetailsReading
}

/** The findings of the survey's own families: those of the other requests (the damage sets) are read in theirs. */
export type SurveyAnswerFindings = Omit<SurveyFindings, 'sideDamage' | 'doorDamage'>

/** One question family (kept under its earlier name for the modules that declare one). */
export type SurveyPart = QuestionFamily

/** The survey's answer: the ID as read, and each family's findings. */
export interface SurveyAnswer {
  containerId: ContainerIdReading
  /** Per-position readings (11). Luna's re-check asks the unread ones again. */
  readings: ChoiceReading[]
  /** The model's pick from the owner-code list; the re-check and the crop read combine their readings with it. */
  ownerPick?: OwnerPick | null
  /** Where the ID is in the photo, on box-capable models that answered; otherwise null (the crop read starts from it). */
  box: JevBox | null
  findings: SurveyAnswerFindings
}

/** The survey for one route: the registry's survey families, ID first. */
export function surveyQuestionSet(
  ask: SurveyAsk,
  families?: readonly QuestionFamily[],
): SharedQuestionSet {
  return requestSet(SURVEY_REQUEST, ask, families)
}

/** The survey's answers, by meaning. */
export function readSurvey(
  answers: Record<string, SharedAnswer>,
  ask: SurveyAsk,
  families?: readonly QuestionFamily[],
): SurveyAnswer {
  const findings = readRequest(SURVEY_REQUEST, answers, ask, families)
  // The ID family is always asked: the survey is not a survey without it.
  const id = findings.id!
  return {
    containerId: id.containerId,
    readings: id.readings,
    ownerPick: id.ownerPick,
    box: id.box,
    findings: findings as SurveyAnswerFindings,
  }
}

/** The survey's answer on the record: each family's own fields. */
export function applySurvey(
  record: InspectionRecord,
  answer: SurveyAnswer,
  families?: readonly QuestionFamily[],
): InspectionRecord {
  return applyFindings(
    record,
    answer.findings as Partial<SurveyFindings>,
    { passId: `${record.id}-${SURVEY_REQUEST}` },
    families,
  )
}
