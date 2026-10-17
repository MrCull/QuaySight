// What makes a question set unsendable (spec #27, ticket #29; split out in ticket #54). The checks decide;
// questionSetWording.ts words the refusal.
import { REQUEST_LIMITS, QuestionSetError } from './questionSetTypes'
import type { QuestionWireFormat, SharedQuestionSet } from './questionSetTypes'
import {
  askedTwiceText,
  boxNotTakenText,
  noChoicesText,
  noLevelsText,
  tooManyChoicesText,
  tooManyQuestionsText,
} from './questionSetWording'

export function checkNames(set: SharedQuestionSet): void {
  const seen = new Set<string>()
  for (const q of set.questions) {
    if (seen.has(q.name)) throw new QuestionSetError(askedTwiceText(q.name))
    seen.add(q.name)
  }
  for (const q of set.questions) {
    if (q.type === 'choice' && q.choices.length === 0) {
      throw new QuestionSetError(noChoicesText(q.name))
    }
    if (q.type === 'score' && q.levels.length === 0) {
      throw new QuestionSetError(noLevelsText(q.name))
    }
  }
}

function checkChoices(set: SharedQuestionSet, wire: QuestionWireFormat): void {
  const { maxChoices } = REQUEST_LIMITS[wire]
  for (const q of set.questions) {
    if (q.type === 'choice' && q.choices.length > maxChoices) {
      throw new QuestionSetError(tooManyChoicesText(q.name, q.choices.length, wire, maxChoices))
    }
  }
}

/** Refuses a set the wire format cannot take in one request. Called before anything is sent. */
export function checkLimits(set: SharedQuestionSet, wire: QuestionWireFormat): void {
  checkNames(set)
  checkChoices(set, wire)
  const { maxQuestions } = REQUEST_LIMITS[wire]
  if (set.questions.length > maxQuestions) {
    throw new QuestionSetError(tooManyQuestionsText(set.questions.length, wire, maxQuestions))
  }
  if (wire === 'openai-decisions') {
    const box = set.questions.find((q) => q.type === 'box')
    if (box) throw new QuestionSetError(boxNotTakenText(box.name))
  }
}

/**
 * The set as one or more sets within the wire format's question limit, in order, each with the same
 * input. A choice question over the choice limit is refused: splitting its options would change what
 * it asks (the manifest check splits its own entries, saying so in each part).
 */
export function splitQuestionSet(
  set: SharedQuestionSet,
  wire: QuestionWireFormat,
): SharedQuestionSet[] {
  checkNames(set)
  checkChoices(set, wire)
  const { maxQuestions } = REQUEST_LIMITS[wire]
  const parts: SharedQuestionSet[] = []
  for (let i = 0; i < set.questions.length; i += maxQuestions) {
    parts.push({ input: set.input, questions: set.questions.slice(i, i + maxQuestions) })
  }
  return parts.length > 0 ? parts : [set]
}
