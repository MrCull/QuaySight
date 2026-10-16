// The container-ID character questions (spec #27, ticket #29), in the shared question format. Pure.
//
// Each character question describes the printed layout (four capital letters, a gap, a six-digit group,
// then a single digit in a drawn box) and names the character by its place in its group. The check-digit
// calculation is never put in front of the model: the app validates the check digit itself
// (iso6346.ts, containerId.ts). On COYU 266813 0 (16 Oct 2026) the old wording, which numbered positions
// 1 to 11 and carried the calculation, gave Luna COCI6361130; this wording gave COYU2668130.
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import type { ChoiceQuestion, SharedAnswer, SharedQuestion, SharedQuestionSet } from './questionSet'
import { questionSet } from './questionSet'

export const ID_POSITIONS = 11
const LETTER_POSITIONS = 4
const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const DIGITS = Array.from({ length: 10 }, (_, i) => String(i))
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** Jev's extra option on each character: a position it cannot see is answered as such, not guessed. */
export const UNREADABLE_OPTION = 'unreadable'

/** The answer name for a 1-based position, e.g. id_char_07. Shared by every route, so answers map alike. */
export function idQuestionName(position: number): string {
  return `id_char_${String(position).padStart(2, '0')}`
}

/** The values a position can take: letters in the four-letter group, digits elsewhere. */
export function allowedAt(position: number): string[] {
  return position <= LETTER_POSITIONS ? LETTERS : DIGITS
}

function layout(image: string): string {
  return `The container number on ${image} is printed as four capital letters, a gap, a six-digit group, then a single digit in a drawn box.`
}

function place(position: number): string {
  if (position <= LETTER_POSITIONS) {
    return `Read only the ${ORDINALS[position - 1]} letter of the four-letter group.`
  }
  if (position < ID_POSITIONS) {
    return `Read only the ${ORDINALS[position - LETTER_POSITIONS - 1]} digit of the six-digit group.`
  }
  return 'Read only the single digit in the drawn box, exactly as printed.'
}

/** One character question: the layout, then the character's place in its group. */
function characterQuestion(
  position: number,
  image: string,
  extra: ChoiceQuestion['choices'] = [],
): ChoiceQuestion {
  const isLetter = position <= LETTER_POSITIONS
  return {
    type: 'choice',
    name: idQuestionName(position),
    instructions: `${layout(image)} ${place(position)}`,
    choices: [
      ...allowedAt(position).map((value) => ({
        value,
        description: `${isLetter ? 'Letter' : 'Digit'} ${value}`,
      })),
      ...extra,
    ],
  }
}

function allPositions(): number[] {
  return Array.from({ length: ID_POSITIONS }, (_, i) => i + 1)
}

/** The text ahead of the photo on every route that asks the Luna ID set. No check-digit calculation. */
export const LUNA_IDENTIFICATION_INSTRUCTIONS =
  'Read the container identification printed on this freight container photo. Answer each question with the one character you can see at that place. If a character is not visible or cannot be read, give a low probability for every choice rather than a clear character.'

/**
 * The Luna ID set: one choice per character. With positions (1-based), only those are asked; the
 * re-check uses this for the characters the first reading left unread.
 */
export function lunaIdQuestionSet(positions?: number[]): SharedQuestionSet {
  const wanted = positions ?? allPositions()
  return questionSet(
    LUNA_IDENTIFICATION_INSTRUCTIONS,
    wanted.map((position) => characterQuestion(position, 'this photo')),
  )
}

/** The text sent ahead of the photo for the Jev ID set through OpenRouter. */
export const JEV_STATE_INSTRUCTIONS =
  'Freight container photo. Judge only what is visible in the photo. Answer every question about this one photo.'

export interface JevIdOptions {
  /** How the instructions name the photo, e.g. "the image referenced as `photo_1`" or "the photo". */
  image: string
  /** Ask the box question. Only for models the catalogue declares box-capable; older models reject it. */
  box: boolean
}

/**
 * The Jev ID set: the character questions with an explicit unreadable option, legibility, whether the
 * whole number is in frame and, on box-capable models only, where the number is.
 */
export function jevIdQuestionSet({ image, box }: JevIdOptions): SharedQuestionSet {
  const unreadable = [
    {
      value: UNREADABLE_OPTION,
      description: 'The character is not visible or cannot be read clearly',
    },
  ]
  const questions: SharedQuestion[] = [
    ...allPositions().map((position) => characterQuestion(position, image, unreadable)),
    {
      type: 'score',
      name: 'legibility',
      instructions: `How legible is the full container identification printed on ${image}?`,
      levels: [
        { label: 'Not visible at all' },
        { label: 'Mostly unreadable' },
        { label: 'Partly readable, with several positions unclear' },
        { label: 'Mostly readable, with one or two positions unclear' },
        { label: 'Fully readable and sharp' },
      ],
    },
    {
      type: 'predicate',
      name: 'full_number_visible',
      instructions: `Is the complete 11-character container identification visible within ${image}, with no part cut off?`,
    },
  ]
  if (box) {
    questions.push({
      type: 'box',
      name: 'container_box',
      instructions: `The container identification number printed on the container in ${image}.`,
    })
  }
  return questionSet(JEV_STATE_INSTRUCTIONS, questions)
}

/** One character as read: the value, its certainty, and a plausible runner-up. */
export interface ChoiceReading {
  value: string | null
  certainty: CertaintyLabel
  runnerUp: string | null
}

const RUNNER_UP_MIN = 0.15
const UNREAD_CHARACTER: ChoiceReading = { value: null, certainty: "Can't tell", runnerUp: null }

function readCharacter(answer: SharedAnswer | undefined, allowed: string[]): ChoiceReading {
  if (answer?.type !== 'choice' || !allowed.includes(answer.value)) return UNREAD_CHARACTER
  const scored = Object.entries(answer.probabilities)
    .filter(([value]) => allowed.includes(value))
    .map(([value, probability]) => ({ value, probability }))
    .sort((a, b) => b.probability - a.probability)
  const chosen = scored.find((e) => e.value === answer.value)
  if (!chosen) return UNREAD_CHARACTER
  const best = scored.find((e) => e.value !== chosen.value)
  const certainty = applyMargin(
    certaintyOfProbability(chosen.probability),
    chosen.probability,
    best?.probability ?? null,
  )
  if (certainty === "Can't tell") return UNREAD_CHARACTER
  const runner = scored.find((e) => e.value !== chosen.value && e.probability >= RUNNER_UP_MIN)
  return { value: chosen.value, certainty, runnerUp: runner?.value ?? null }
}

/**
 * One reading per position (11), from answers mapped by meaning. A position not asked, not answered,
 * answered unreadable or answered too weakly is unread; it is never filled in.
 */
export function readIdCharacters(
  answers: Record<string, SharedAnswer>,
  positions?: number[],
): ChoiceReading[] {
  const asked = new Set(positions ?? allPositions())
  return allPositions().map((position) =>
    asked.has(position)
      ? readCharacter(answers[idQuestionName(position)], allowedAt(position))
      : UNREAD_CHARACTER,
  )
}
