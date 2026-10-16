// Which face of the container a photo shows (spec #27, ticket #33). Pure.
//
// The survey request (A) asks it alongside the ID, so the presenter is never asked. The damage shown
// comes from the damage set written for that face (damageSets.ts).
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import {
  readAnswers,
  type ChoiceQuestion,
  type QuestionWireFormat,
  type SharedQuestionSet,
} from './questionSet'

export type PhotoFace = 'rear-doors' | 'long-side' | 'front-end' | 'roof' | 'close-up' | 'unknown'

export interface FaceReading {
  face: PhotoFace
  /** The model's probability for the face it chose. */
  probability: number
  certainty: CertaintyLabel
}

const FACE_OF_VALUE: Record<string, PhotoFace> = {
  rear_doors: 'rear-doors',
  long_side: 'long-side',
  front_end: 'front-end',
  roof: 'roof',
  close_up: 'close-up',
  unknown: 'unknown',
}

/** The survey's face question. Answer values are wire-safe names; readPhotoFace maps them back. */
export const FACE_QUESTION: ChoiceQuestion = {
  type: 'choice',
  name: 'photo_face',
  instructions:
    'Which face of the freight container does this photo mainly show? Judge only from what is visible.',
  choices: [
    {
      value: 'rear_doors',
      description: 'The door end: two door leaves with locking bars, cams and hinges.',
    },
    {
      value: 'long_side',
      description: 'A long side wall of corrugated sheet between the corner posts.',
    },
    { value: 'front_end', description: 'The plain end wall opposite the doors, with no doors.' },
    { value: 'roof', description: 'The roof, seen from above.' },
    {
      value: 'close_up',
      description: 'A close-up of one part or marking, too close to tell which face it is.',
    },
    { value: 'unknown', description: 'No container face can be identified.' },
  ],
}

/** The survey set with the face question added (once), after its own questions. */
export function withFaceQuestion(set: SharedQuestionSet): SharedQuestionSet {
  if (set.questions.some((q) => q.name === FACE_QUESTION.name)) return set
  return { ...set, questions: [...set.questions, FACE_QUESTION] }
}

const FACE_ONLY: SharedQuestionSet = { input: [], questions: [FACE_QUESTION] }

/**
 * The face from a survey reply, by meaning, on either wire format. Null when the reply carries no
 * usable face answer: the face is then unknown to the run, never guessed.
 */
export function readPhotoFace(wire: QuestionWireFormat, raw: unknown): FaceReading | null {
  let answer
  try {
    answer = readAnswers(wire, raw, FACE_ONLY, '').answers[FACE_QUESTION.name]
  } catch {
    return null
  }
  if (answer?.type !== 'choice') return null
  const face = FACE_OF_VALUE[answer.value]
  if (!face) return null
  const probability = answer.probabilities[answer.value] ?? answer.confidence ?? 0
  const runnerUp = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .reduce<number | null>((best, [, p]) => (best === null || p > best ? p : best), null)
  return {
    face,
    probability,
    certainty: applyMargin(certaintyOfProbability(probability), probability, runnerUp),
  }
}
