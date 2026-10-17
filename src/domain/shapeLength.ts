// The length-from-shape question (spec #51, ticket #66): 20, 40 or 45 ft from the cues a side photo shows.
// A question family of the registry. Pure. Which length the drawing uses is chosen in chosenLength.ts.
import { applyMargin, certaintyOfProbability } from './certainty'
import { chosenLength, codeFeetOf, type ContainerLengthFt, type LengthReading } from './chosenLength'
import { withShapeLength } from './damageSets'
import type { CertaintyLabel, InspectionRecord } from './inspection'
import type { QuestionFamily } from './questionRegistry'
import type { ChoiceQuestion, SharedAnswer } from './questionSet'

export const SHAPE_LENGTH_QUESTION: ChoiceQuestion = {
  type: 'choice',
  name: 'shape_length',
  instructions:
    'If the photo shows a long side of the container, how long is it, judged only from its shape? Use the length-to-height proportion, the number of corrugated panels, a gooseneck tunnel or label (40 ft or longer) and forklift pockets (20 ft only). Answer unknown if the photo does not show a side.',
  choices: [
    { value: '20_ft', description: 'A 20 ft container: short, with forklift pockets possible' },
    { value: '40_ft', description: 'A 40 ft container: long, a gooseneck tunnel possible' },
    { value: '45_ft', description: 'A 45 ft container: a little longer than a 40 ft one' },
    { value: 'unknown', description: 'This photo does not show a side well enough to say' },
  ],
}

const FEET_OF_VALUE: Record<string, ContainerLengthFt> = { '20_ft': 20, '40_ft': 40, '45_ft': 45 }

/** A shape cannot tell 45 ft from 40 ft as surely as it tells 20 ft from 40 ft. */
const CAP: Record<ContainerLengthFt, CertaintyLabel> = {
  20: 'Confident',
  40: 'Confident',
  45: 'Likely',
}

const RANK: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]

/** The shape estimate from the survey's answers, or null when there is no usable one. */
export function shapeLengthOf(answers: Record<string, SharedAnswer>): LengthReading | null {
  const answer = answers[SHAPE_LENGTH_QUESTION.name]
  if (answer?.type !== 'choice') return null
  const feet = FEET_OF_VALUE[answer.value]
  if (!feet) return null
  const probability = answer.probabilities[answer.value] ?? answer.confidence ?? 0
  const runnerUp = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .reduce<number | null>((best, [, p]) => (best === null || p > best ? p : best), null)
  const reached = applyMargin(certaintyOfProbability(probability), probability, runnerUp)
  if (reached === "Can't tell") return null
  const certainty = RANK.indexOf(reached) < RANK.indexOf(CAP[feet]) ? CAP[feet] : reached
  return { feet, probability, certainty }
}

/** The warning when a size code (Confident or Likely) and the shape disagree on the length, or null. */
export function lengthDisagreement(record: InspectionRecord): string | null {
  const chosen = chosenLength(record)
  const code = codeFeetOf(record)
  if (chosen.alternative === undefined || code === null) return null
  const shape = chosen.source === 'shape' ? chosen.feet : chosen.alternative
  return `The size code says ${code} ft but the shape of the container in the photo says ${shape} ft.`
}

declare module './survey' {
  interface SurveyFindings {
    shapeLength: LengthReading | null
  }
}
declare module './inspection' {
  interface InspectionRecord {
    /** The length estimated from a side photo's shape; null when none, absent when not asked. */
    shapeLength?: LengthReading | null
  }
}

/** The question family that asks the length from the shape of a side photo. */
export const shapeLengthFamily: QuestionFamily = {
  key: 'shapeLength',
  questions: () => [SHAPE_LENGTH_QUESTION],
  read: (answers) => shapeLengthOf(answers),
  apply: (record, reading) => withShapeLength(record, reading),
  export: (record) => {
    const warning = lengthDisagreement(record)
    return { values: [], unresolved: [], conflicts: warning ? [warning] : [], summary: [] }
  },
}
