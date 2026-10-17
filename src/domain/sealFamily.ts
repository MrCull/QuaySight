// The seal question family (spec #51, ticket #68): whether a seal is visible, each character of its
// number, and where it was read. Pure. The number is read the way the ID is, one choice per character
// with its own certainty, but a seal number has no check digit and no fixed length, so none is checked and
// the places after the last character are answered "none". Nothing here says a seal is sealed, intact or
// safe: only whether one is seen and what its number reads.
import { CERTAINTY_LABELS } from './certainty'
import { usableIdBox } from './cropRead'
import type { ReadingBox } from './enlargedCrop'
import { readCharacter } from './idQuestions'
import type { CertaintyLabel } from './inspection'
import type { FamilyExport, QuestionFamily } from './questionRegistry'
import type { ChoiceQuestion, SharedAnswer, SharedQuestion } from './questionSetTypes'

/** One seal character as read: the value, or null when it was not read. */
export interface SealCharacter {
  value: string | null
  certainty: CertaintyLabel
}

export interface SealReading {
  /** Whether a seal is visible in the photo. */
  visible: boolean
  /** The number, one entry per character up to the last one read. Empty when no seal is visible. */
  characters: SealCharacter[]
  /** The number as one string, an unread character as `?`. Empty when no seal is visible or none was read. */
  value: string
  /** "Not seen" when no seal is visible; otherwise the number's: its weakest character, no better than Uncertain if any is unread. */
  certainty: CertaintyLabel
  /** Where the number was read in the photo, when the model gave a usable box. Shown as an enlarged crop. */
  box?: ReadingBox
  /** Several photos (ticket #72): the 1-based photo the box, and so the crop, belongs to. */
  photo?: number
}

declare module './survey' {
  interface SurveyFindings {
    /** The seal, or null when the survey gave no answer to whether one is visible (not assessed). */
    seal: SealReading | null
  }
}
declare module './inspection' {
  interface InspectionRecord {
    /** The seal read by the survey (ticket #68). Absent when it was not asked or not answered: not assessed, never Not seen. */
    seal?: SealReading
  }
}

/** Places a seal number is read at. Seal numbers are shorter than this; the places after the last are "none". */
export const SEAL_POSITIONS = 8
const SEAL_CHARACTERS = [
  ...Array.from({ length: 10 }, (_, i) => String(i)),
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
]
const NONE = 'none'
const UNREADABLE = 'unreadable'
/** A visible seal needs at least this probability from the visibility question. */
const VISIBLE_MIN = 0.5

const VISIBLE_QUESTION = 'seal_visible'
const BOX_QUESTION = 'seal_box'
const charName = (position: number) => `seal_char_${String(position).padStart(2, '0')}`

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

const LAYOUT =
  'The seal is the small tamper-evident device fitted to the door locking bar or handle of the container, with its own number printed or embossed on it. This is not the container identification.'

function characterQuestion(position: number): ChoiceQuestion {
  return {
    type: 'choice',
    name: charName(position),
    instructions: `${LAYOUT} Read only the ${ORDINALS[position - 1]} character of the seal number, counting from its left. If the number is shorter than that, answer none.`,
    choices: [
      ...SEAL_CHARACTERS.map((value) => ({
        value,
        description: `Character ${value}`,
      })),
      { value: NONE, description: 'The seal number has no character at this place' },
      {
        value: UNREADABLE,
        description: 'The character is not visible or cannot be read clearly',
      },
    ],
  }
}

function questions(ask: { box: boolean }): SharedQuestion[] {
  const out: SharedQuestion[] = [
    {
      type: 'predicate',
      name: VISIBLE_QUESTION,
      instructions: `${LAYOUT} Is a seal visible in the photo?`,
    },
    ...Array.from({ length: SEAL_POSITIONS }, (_, i) => characterQuestion(i + 1)),
  ]
  if (ask.box) {
    out.push({
      type: 'box',
      name: BOX_QUESTION,
      instructions: 'The number printed or embossed on the seal fitted to the container door.',
    })
  }
  return out
}

/** unreadable: the model said a character is there but cannot be read. unread: no usable answer. */
type Place =
  | { kind: 'read'; character: SealCharacter }
  | { kind: 'none' }
  | { kind: 'unreadable' }
  | { kind: 'unread' }

function placeAt(answer: SharedAnswer | undefined): Place {
  if (answer?.type === 'choice') {
    if (answer.value === NONE && (answer.probabilities[NONE] ?? 0) >= 0.6) return { kind: 'none' }
    if (answer.value === UNREADABLE) return { kind: 'unreadable' }
  }
  const read = readCharacter(answer, SEAL_CHARACTERS)
  return read.value === null
    ? { kind: 'unread' }
    : { kind: 'read', character: { value: read.value, certainty: read.certainty } }
}

function weakest(labels: CertaintyLabel[]): CertaintyLabel {
  return labels.reduce((worst, l) =>
    CERTAINTY_LABELS.indexOf(l) > CERTAINTY_LABELS.indexOf(worst) ? l : worst,
  )
}

const UNREAD: SealCharacter = { value: null, certainty: "Can't tell" }

export function readSeal(
  answers: Record<string, SharedAnswer>,
  ask: { box: boolean },
): SealReading | null {
  const seen = answers[VISIBLE_QUESTION]
  if (seen?.type !== 'predicate') return null
  if (seen.probability < VISIBLE_MIN) {
    return { visible: false, characters: [], value: '', certainty: 'Not seen' }
  }

  const places = Array.from({ length: SEAL_POSITIONS }, (_, i) => placeAt(answers[charName(i + 1)]))
  // The number ends at its last read character, or at an unreadable one the model said was there.
  // Places after it were answered "none", or too weakly to say: they are not part of the number.
  let end = 0
  places.forEach((p, i) => {
    if (p.kind === 'read' || p.kind === 'unreadable') end = i + 1
  })
  const anyRead = places.some((p) => p.kind === 'read')
  const characters = anyRead
    ? places.slice(0, end).map((p): SealCharacter => (p.kind === 'read' ? p.character : UNREAD))
    : []

  const read = characters.filter((c) => c.value !== null)
  const value = characters.map((c) => c.value ?? '?').join('')
  const certainty: CertaintyLabel =
    read.length === 0
      ? "Can't tell"
      : read.length < characters.length
        ? weakest([...read.map((c) => c.certainty), 'Uncertain'])
        : weakest(read.map((c) => c.certainty))

  const boxAnswer = ask.box ? answers[BOX_QUESTION] : undefined
  const box =
    boxAnswer?.type === 'box' && boxAnswer.confidence !== null
      ? usableIdBox({ ...boxAnswer.box, confidence: boxAnswer.confidence })
      : null
  return { visible: true, characters, value, certainty, ...(box ? { box } : {}) }
}

const shown = (value: string) => value.split('?').join('·')

function sealExport(record: Parameters<NonNullable<QuestionFamily['export']>>[0]): FamilyExport {
  const out: FamilyExport = { values: [], unresolved: [], conflicts: [], summary: [] }
  const seal = record.seal
  if (!seal) return out
  if (!seal.visible) {
    out.unresolved.push({ field: 'seal', category: 'unresolved', reason: 'Not seen in the photo.' })
    out.summary.push('Seal: Not seen')
    return out
  }
  if (seal.characters.every((c) => c.value === null)) {
    out.unresolved.push({
      field: 'seal',
      category: 'unresolved',
      reason: 'A seal is visible, but its number could not be read.',
    })
    out.summary.push(`Seal: number not readable - ${seal.certainty}`)
    return out
  }
  out.values.push({
    field: 'seal',
    category: 'printed',
    value: seal.value,
    provenance: 'printed',
    certainty: seal.certainty,
    uncertainty: null,
  })
  seal.characters.forEach((c, index) => {
    if (c.value === null) {
      out.unresolved.push({
        field: `seal.position[${index}]`,
        category: 'unresolved',
        reason: 'Character not read from the photo.',
      })
    }
  })
  out.summary.push(`Seal: ${shown(seal.value)} - ${seal.certainty}`)
  return out
}

/** The seal family, asked in the survey after the ID. */
export const sealFamily: QuestionFamily = {
  key: 'seal',
  questions,
  read: (answers, ask) => readSeal(answers, ask),
  apply: (record, finding) => (finding ? { ...record, seal: finding } : record),
  export: sealExport,
}
