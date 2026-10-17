// The words of a refused question set (spec #27, ticket #29; split out in ticket #54). Pure: each takes the
// facts and returns the sentence, so the wording can change and be tested apart from the checks that
// decide a set must be refused (questionSetLimits.ts).
import type { QuestionWireFormat } from './questionSetTypes'

export const askedTwiceText = (name: string) => `Question ${name} is asked twice.`
export const noChoicesText = (name: string) => `Question ${name} offers no choices.`
export const noLevelsText = (name: string) => `Question ${name} has no levels.`

export const tooManyChoicesText = (
  name: string,
  count: number,
  wire: QuestionWireFormat,
  max: number,
) => `Question ${name} offers ${count} choices; ${wire} takes at most ${max} choices per question.`

export const tooManyQuestionsText = (count: number, wire: QuestionWireFormat, max: number) =>
  `${count} questions; ${wire} takes at most ${max} questions per request. Split the set first.`

export const boxNotTakenText = (name: string) =>
  `Question ${name} is a box question, which OpenAI does not take.`
