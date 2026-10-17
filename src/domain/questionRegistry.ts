// The question registry (spec #51, ticket #59). Pure.
//
// Every kind of reading is one question family, written in its own module. A family declares four things:
//   - its questions (prompt, choices, levels),
//   - how its answers are read, by meaning,
//   - what it adds to the inspection record,
//   - what it adds to the exports.
// The survey, and every other request that asks questions, takes them from here: nothing assembles a
// question set per provider. The set a request sends is the families it names, joined, and the limits on
// it (question count, choice count, duplicate names) are checked on that whole set before sending.
//
// To add a family (see docs/agents/question-registry.md):
//   1. In a module of its own, declare its finding with `declare module './survey' { interface
//      SurveyFindings { seal: SealReading | null } }` and its field on the record with `declare module
//      './inspection' { interface InspectionRecord { seal?: ... } }`.
//   2. Export `const sealFamily: QuestionFamily = { key: 'seal', questions, read, apply, export }`.
//   3. List it in FAMILIES below. Nothing else changes: the survey asks it, reads it, applies it and the
//      exports carry it. A family that is its own request names that request in `request`.
import type { InspectionRecord } from './inspection'
import type { ExportCandidate, ExportUnresolved, ExportValue } from './exportTypes'
import type { SharedAnswer, SharedQuestion, SharedQuestionSet } from './questionSetTypes'
import type { SurveyAsk, SurveyFindings } from './survey'
import { questionSet } from './questionSet'
import { containerDetailsPart } from './containerDetails'
import { doorDamageFamily, sideDamageFamily } from './damageFamilies'
import { idFamily } from './idFamily'
import { lengthPart } from './containerLength'
import { facePart } from './photoFace'
import { weightsPart } from './weightQuestions'

/** What a family adds to the JSON export and the plain-text summary. */
export interface FamilyExport {
  values: ExportValue[]
  unresolved: ExportUnresolved[]
  conflicts: string[]
  /** Lines for the plain-text summary. */
  summary: string[]
  /** Alternatives to the main value (the container ID's). */
  candidates?: ExportCandidate[]
}

/** What a family's apply knows of the request that asked it. */
export interface ApplyContext {
  /** The raw response's id, `<inspection id>-<request id>`. */
  passId: string
}

/** The request the survey is: families that name no other request are asked in it. */
export const SURVEY_REQUEST = 'read'

interface FamilyOf<K extends keyof SurveyFindings> {
  key: K
  /** The request that asks this family; default the survey. Families with the same request share one question set. */
  request?: string
  /** The text ahead of the photo for the request's set. The first family of a request that gives one decides. */
  instructions?(ask: SurveyAsk): string
  /** A whole input to send instead (a set authored as data keeps its own). Takes precedence over `instructions`. */
  input?(ask: SurveyAsk): SharedQuestionSet['input']
  /** The family's questions. Names must be unique across the request's set. */
  questions(ask: SurveyAsk): SharedQuestion[]
  /** Its answers, by meaning. A question with no usable answer is absent from `answers`. */
  read(answers: Record<string, SharedAnswer>, ask: SurveyAsk): SurveyFindings[K]
  /** Folds what it read into the record (its own fields). Omit to leave the record alone. */
  apply?(record: InspectionRecord, finding: SurveyFindings[K], ctx: ApplyContext): InspectionRecord
  /** What it adds to the exports, from the record. Omit when it adds nothing. */
  export?(record: InspectionRecord): FamilyExport
}

/** One question family. */
export type QuestionFamily = { [K in keyof SurveyFindings]: FamilyOf<K> }[keyof SurveyFindings]

/** Every family, in question order. */
const FAMILIES: QuestionFamily[] = [
  idFamily,
  containerDetailsPart,
  facePart,
  weightsPart,
  lengthPart,
  sideDamageFamily,
  doorDamageFamily,
]

export function questionFamilies(): readonly QuestionFamily[] {
  return FAMILIES
}

/** Adds a family to every later request. Returns its removal (tests add test-only families this way). */
export function registerFamily(family: QuestionFamily): () => void {
  if (FAMILIES.some((f) => f.key === family.key)) {
    throw new Error(`A question family with key ${family.key} is already registered`)
  }
  FAMILIES.push(family)
  return () => {
    const at = FAMILIES.indexOf(family)
    if (at >= 0) FAMILIES.splice(at, 1)
  }
}

/** The families a request asks, in registry order. */
export function familiesOf(
  request: string,
  families: readonly QuestionFamily[] = FAMILIES,
): QuestionFamily[] {
  return families.filter((f) => (f.request ?? SURVEY_REQUEST) === request)
}

/**
 * The question set of one request: its families' questions, joined. Not checked here: the limits apply to
 * the whole set when it is translated for the wire (questionSetLimits.ts).
 */
export function requestSet(
  request: string,
  ask: SurveyAsk,
  families: readonly QuestionFamily[] = FAMILIES,
): SharedQuestionSet {
  const asked = familiesOf(request, families)
  const questions = asked.flatMap((f) => f.questions(ask))
  const withInput = asked.find((f) => f.input)
  if (withInput?.input) return { input: withInput.input(ask), questions }
  const instructions = asked.find((f) => f.instructions)?.instructions?.(ask) ?? ''
  return questionSet(instructions, questions)
}

/** The findings of one request's families, by key, from its answers. */
export function readRequest(
  request: string,
  answers: Record<string, SharedAnswer>,
  ask: SurveyAsk,
  families: readonly QuestionFamily[] = FAMILIES,
): Partial<SurveyFindings> {
  const findings: Record<string, unknown> = {}
  for (const family of familiesOf(request, families)) {
    findings[family.key] = (family.read as (a: typeof answers, k: SurveyAsk) => unknown)(
      answers,
      ask,
    )
  }
  return findings as Partial<SurveyFindings>
}

/** Folds findings into the record, family by family. A family with no finding was not asked: nothing to fold in. */
export function applyFindings(
  record: InspectionRecord,
  findings: Partial<SurveyFindings>,
  ctx: ApplyContext,
  families: readonly QuestionFamily[] = FAMILIES,
): InspectionRecord {
  let next = record
  for (const family of families) {
    const apply = family.apply as
      | ((record: InspectionRecord, finding: unknown, ctx: ApplyContext) => InspectionRecord)
      | undefined
    if (apply && family.key in findings) next = apply(next, findings[family.key], ctx)
  }
  return next
}

/** What every family adds to the exports, in registry order. */
export function familyExports(record: InspectionRecord): FamilyExport[] {
  return FAMILIES.flatMap((f) => (f.export ? [f.export(record)] : []))
}
