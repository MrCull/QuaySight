// The survey's length question (spec 4.3, ticket #46): about how long is this container. Pure.
// What the schematic draws is chosen in chosenLength.ts.
import { applyMargin, certaintyOfProbability } from './certainty'
import { withModelLength } from './damageSets'
import type { ContainerLengthFt, LengthReading } from './chosenLength'
import type { ChoiceQuestion, SharedAnswer } from './questionSet'
import type { SurveyPart } from './survey'

export const LENGTH_QUESTION: ChoiceQuestion = {
  type: 'choice',
  name: 'container_length',
  instructions:
    'About how long is this container? Judge from the whole photo, for example from the proportions of the side or the door end. Answer unknown if the photo does not show enough to say.',
  choices: [
    { value: '20_ft', description: 'A 20 ft container' },
    { value: '40_ft', description: 'A 40 ft container' },
    { value: '45_ft', description: 'A 45 ft container' },
    { value: 'unknown', description: 'This photo does not show enough to say' },
  ],
}

const FEET_OF_VALUE: Record<string, ContainerLengthFt> = { '20_ft': 20, '40_ft': 40, '45_ft': 45 }

/** The model's length from the survey's answers, or null when there is no usable one. */
export function lengthOf(answers: Record<string, SharedAnswer>): LengthReading | null {
  const answer = answers[LENGTH_QUESTION.name]
  if (answer?.type !== 'choice') return null
  const feet = FEET_OF_VALUE[answer.value]
  if (!feet) return null
  const probability = answer.probabilities[answer.value] ?? answer.confidence ?? 0
  const runnerUp = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .reduce<number | null>((best, [, p]) => (best === null || p > best ? p : best), null)
  const certainty = applyMargin(certaintyOfProbability(probability), probability, runnerUp)
  if (certainty === "Can't tell") return null
  return { feet, probability, certainty }
}

declare module './survey' {
  interface SurveyFindings {
    length: LengthReading | null
  }
}

/** The survey part that asks the container's length. */
export const lengthPart: SurveyPart = {
  key: 'length',
  questions: () => [LENGTH_QUESTION],
  read: (answers) => lengthOf(answers),
  apply: (record, reading) => withModelLength(record, reading),
}
