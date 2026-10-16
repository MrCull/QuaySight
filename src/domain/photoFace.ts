// Which face of the container a photo shows (spec #27, ticket #33). Pure.
//
// The survey request (A) asks it alongside the ID (as a survey part), so the presenter is never asked. The damage shown
// comes from the damage set written for that face (damageSets.ts).
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import { withPhotoFace } from './damageSets'
import type { ChoiceQuestion, SharedAnswer } from './questionSet'
import type { SurveyPart } from './survey'

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

/**
 * The face from the survey's answers, by meaning. Null when there is no usable face answer: the face
 * is then unknown to the run, never guessed.
 */
export function faceOf(answers: Record<string, SharedAnswer>): FaceReading | null {
  const answer = answers[FACE_QUESTION.name]
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

declare module './survey' {
  interface SurveyFindings {
    /** Which face the photo shows, or null when the survey gave none. */
    face: FaceReading | null
  }
}

/** The survey part that asks which face the photo shows; the damage shown follows it (damageSets.ts). */
export const facePart: SurveyPart = {
  key: 'face',
  questions: () => [FACE_QUESTION],
  read: (answers) => faceOf(answers),
  apply: (record, face) => withPhotoFace(record, face),
}
