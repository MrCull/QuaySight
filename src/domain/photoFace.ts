// Which face of the container a photo shows (spec #27, ticket #33). Pure.
//
// The survey request (A) asks it alongside the ID (as a survey part), so the presenter is never asked. The damage shown
// comes from the damage set written for that face (damageSets.ts).
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import { withPhotoFace } from './damageSets'
import type { ChoiceQuestion, PredicateQuestion, SharedAnswer } from './questionSet'
import type { SurveyPart } from './survey'

export type PhotoFace =
  | 'rear-doors'
  | 'long-side'
  | 'front-end'
  | 'roof'
  | 'close-up'
  | 'not-container'
  | 'unknown'

/** What a close-up photo shows. Only readings of this subject may come from it. */
export type CloseUpSubject = 'seal' | 'id' | 'weights' | 'placard' | 'damage'

export interface FaceReading {
  face: PhotoFace
  /** For a close-up: what it shows; absent when the model did not say. */
  closeUpSubject?: CloseUpSubject
  /** The model's probability for the face it chose. */
  probability: number
  certainty: CertaintyLabel
  /**
   * Every face the photo shows, the main face first (a corner photo shows doors and a long side). Absent
   * when the model answered none of the "shows" questions: the photo then shows its main face only.
   */
  shown?: PhotoFace[]
}

/** The faces a photo shows, the main face first. A close-up, a non-container and an unknown face show only themselves. */
export function facesShown(
  reading: Pick<FaceReading, 'face' | 'shown'> | null | undefined,
): PhotoFace[] {
  if (!reading) return []
  return reading.shown && reading.shown.length > 0 ? reading.shown : [reading.face]
}

const CLOSE_UP_OF_VALUE: Record<string, CloseUpSubject> = {
  close_up_seal: 'seal',
  close_up_id: 'id',
  close_up_weights: 'weights',
  close_up_placard: 'placard',
  close_up_damage: 'damage',
}

const FACE_OF_VALUE: Record<string, PhotoFace> = {
  ...Object.fromEntries(Object.keys(CLOSE_UP_OF_VALUE).map((v) => [v, 'close-up' as const])),
  rear_doors: 'rear-doors',
  long_side: 'long-side',
  front_end: 'front-end',
  roof: 'roof',
  close_up: 'close-up',
  not_a_container: 'not-container',
  unknown: 'unknown',
}

/** Whether a photo shows some of a face at all (even beside its main face): one yes/no question per face. */
const SHOWS_QUESTIONS: { name: string; face: PhotoFace; instructions: string }[] = [
  {
    name: 'shows_rear_doors',
    face: 'rear-doors',
    instructions:
      'Does this photo show any of the container door end, even if it is not the main subject? The doors are known by their vertical locking bars with handles, cams and hinges. Markings, the container ID or a hazard placard on an end wall do not make it the doors: an end wall with none of that hardware is the front end.',
  },
  {
    name: 'shows_long_side',
    face: 'long-side',
    instructions:
      'Does this photo show any of a long side wall (corrugated sheet between the corner posts), even if it is not the main subject?',
  },
  {
    name: 'shows_front_end',
    face: 'front-end',
    instructions:
      'Does this photo show any of the front end: the end wall opposite the doors, a short corrugated or flat panel between two corner posts with no locking bars, handles or hinges? It may carry the container ID, the size-type code or a hazard placard. Count it even if it is seen at an angle beside a long side and is not the main subject.',
  },
]

/** A face counts as shown beside the main one when the model puts it above even odds. */
const SHOWN_MIN = 0.5

/** The survey's face question. Answer values are wire-safe names; readPhotoFace maps them back. */
export const FACE_QUESTION: ChoiceQuestion = {
  type: 'choice',
  name: 'photo_face',
  instructions:
    'Which face of the freight container does this photo mainly show? Judge only from what is visible.',
  choices: [
    {
      value: 'rear_doors',
      description:
        'The door end: two door leaves with vertical locking bars, handles, cams and hinges. Markings alone do not make an end the doors.',
    },
    {
      value: 'long_side',
      description: 'A long side wall of corrugated sheet between the corner posts.',
    },
    {
      value: 'front_end',
      description:
        'The front end: the short end wall opposite the doors, corrugated or flat, with no locking bars, handles or hinges. It may carry the container ID, size-type code or a hazard placard.',
    },
    { value: 'roof', description: 'The roof, seen from above.' },
    {
      value: 'close_up_seal',
      description: 'A close-up of the seal, too close to tell which face it is.',
    },
    {
      value: 'close_up_id',
      description: 'A close-up of the container ID, too close to tell which face it is.',
    },
    {
      value: 'close_up_weights',
      description: 'A close-up of the weights panel, too close to tell which face it is.',
    },
    {
      value: 'close_up_placard',
      description: 'A close-up of a hazard placard, too close to tell which face it is.',
    },
    {
      value: 'close_up_damage',
      description: 'A close-up of one damaged spot, too close to tell which face it is.',
    },
    {
      value: 'close_up',
      description: 'A close-up of some other part or marking, too close to tell which face it is.',
    },
    {
      value: 'not_a_container',
      description: 'The photo does not show a freight container at all.',
    },
    { value: 'unknown', description: 'A container is shown but no face can be identified.' },
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
  const subject = CLOSE_UP_OF_VALUE[answer.value]
  return {
    face,
    ...(subject ? { closeUpSubject: subject } : {}),
    probability,
    certainty: applyMargin(certaintyOfProbability(probability), probability, runnerUp),
    ...shownBeside(face, answers),
  }
}

/**
 * The other faces the photo shows, the main face first. Only a photo of a container face has any; a close-up,
 * a non-container or an unknown face shows only itself. Nothing is returned when no "shows" question was answered.
 */
function shownBeside(
  face: PhotoFace,
  answers: Record<string, SharedAnswer>,
): { shown?: PhotoFace[] } {
  const faceKinds: PhotoFace[] = ['rear-doors', 'long-side', 'front-end']
  if (!faceKinds.includes(face)) return {}
  const asked = SHOWS_QUESTIONS.filter((q) => answers[q.name]?.type === 'predicate')
  if (asked.length === 0) return {}
  const others = asked.filter(
    (q) =>
      q.face !== face &&
      ((answers[q.name] as { probability: number }).probability ?? 0) >= SHOWN_MIN,
  )
  return { shown: [face, ...others.map((q) => q.face)] }
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
  questions: () => [
    FACE_QUESTION,
    ...SHOWS_QUESTIONS.map((q): PredicateQuestion => ({
      type: 'predicate',
      name: q.name,
      instructions: q.instructions,
    })),
  ],
  read: (answers) => faceOf(answers),
  apply: (record, face) => withPhotoFace(record, face),
}

const SUBJECT_WORD: Record<CloseUpSubject, string> = {
  seal: 'Seal',
  id: 'ID',
  weights: 'Weights',
  placard: 'Placard',
  damage: 'Damage',
}

/** The words on a photo's face chip (ticket #70). A long side is named left or right once the doors settle it. */
export function faceChipLabel(
  face: PhotoFace | null,
  side: 'left' | 'right' | null = null,
  subject: CloseUpSubject | null = null,
  shown: readonly PhotoFace[] = [],
): string {
  const main = mainFaceLabel(face, side, subject)
  // The other faces the photo shows follow the main one: "Doors · Right side".
  const others = shown.filter((f) => f !== face).map((f) => mainFaceLabel(f, side, null))
  return [main, ...others].join(' · ')
}

function mainFaceLabel(
  face: PhotoFace | null,
  side: 'left' | 'right' | null,
  subject: CloseUpSubject | null,
): string {
  switch (face) {
    case 'close-up':
      return subject ? `Close-up · ${SUBJECT_WORD[subject]}` : 'Close-up'
    case 'rear-doors':
      return 'Doors'
    case 'front-end':
      return 'Front end'
    case 'long-side':
      return side === 'left' ? 'Left side' : side === 'right' ? 'Right side' : 'Long side'
    case 'not-container':
      return 'Not a container'
    default:
      return "Can't tell"
  }
}
