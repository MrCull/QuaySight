// The seal question family (spec #51, ticket #68): whether a seal is visible, each character of its
// number, and where it was read. Pure. The number is read the way the ID is, one choice per character
// with its own certainty, but a seal number has no check digit and no fixed length, so none is checked and
// the places after the last character are answered "none". Nothing here says a seal is sealed, intact or
// safe: only whether one is seen and what its number reads.
import { CERTAINTY_LABELS } from './certainty'
import { usableIdBox } from './cropRead'
import type { ReadingBox } from './enlargedCrop'
import { oneStepUp } from './combineReadings'
import { readCharacter } from './idQuestions'
import { sealCandidates } from './sealPick'
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
  /** The other plausible number, when the read from the right counted a different number of characters. */
  alternative?: string
  /** Where the number was read in the photo, when the model gave a usable box. Shown as an enlarged crop. */
  box?: ReadingBox
  /** Several photos (ticket #72): the 1-based photo the box, and so the crop, belongs to. */
  photo?: number
  /** The area found for the seal on that photo (fractions); a close-up is cut from it when present. */
  area?: { top: number; bottom: number; left: number; right: number }
  /** The numbers this read makes plausible, for the seal pick (sealPick.ts). Never shown. */
  candidates?: string[]
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
const LENGTH_QUESTION = 'seal_length'
const SECOND_QUESTION = 'seal_second_copy'
const BOX_QUESTION = 'seal_box'
const charName = (position: number) => `seal_char_${String(position).padStart(2, '0')}`
/** Recordings made before the read from the right asked for the second printed copy, left to right. */
const secondName = (position: number) => `seal_second_char_${String(position).padStart(2, '0')}`
const rightName = (position: number) => `seal_rchar_${String(position).padStart(2, '0')}`
const LENGTHS = Array.from({ length: SEAL_POSITIONS }, (_, i) => String(i + 1))

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']

const LAYOUT =
  'The seal is the small tamper-evident device fitted to the door locking bar or handle of the container, with its own number printed or embossed on it. This is not the container identification.'

const characterChoices = () => [
  ...SEAL_CHARACTERS.map((value) => ({
    value,
    description: `Character ${value}`,
  })),
  { value: NONE, description: 'The seal number has no character at this place' },
  {
    value: UNREADABLE,
    description: 'The character is not visible or cannot be read clearly',
  },
]

/**
 * A character counted from the number's right end. Read left to right, a model can lose its place and
 * read a character twice (live Jev read 0154620 as 01546220 on both printed copies); counted from the
 * other end, the same slip does not land on the same places, so the two reads check each other.
 */
function rightCharacterQuestion(position: number): ChoiceQuestion {
  return {
    type: 'choice',
    name: rightName(position),
    instructions: `${LAYOUT} Read only the ${ORDINALS[position - 1]} character of the seal number counting from its right end: the last character of the number is the first from the right. If the number is printed a second time on the seal, read it from that second copy. If the number is shorter than that, answer none.`,
    choices: characterChoices(),
  }
}

function characterQuestion(position: number): ChoiceQuestion {
  return {
    type: 'choice',
    name: charName(position),
    instructions: `${LAYOUT} Read only the ${ORDINALS[position - 1]} character of the seal number, counting from its left. If the number is shorter than that, answer none.`,
    choices: characterChoices(),
  }
}

/** The seal questions: whether one is visible, how many characters, each character from the left, then from the right. */
export function sealQuestions(ask: { box: boolean }): SharedQuestion[] {
  const out: SharedQuestion[] = [
    {
      type: 'predicate',
      name: VISIBLE_QUESTION,
      instructions: `${LAYOUT} Is a seal visible in the photo?`,
    },
    {
      type: 'choice',
      name: LENGTH_QUESTION,
      instructions: `${LAYOUT} How many characters does the seal number have? Count every digit or letter of the number, including any you cannot read.`,
      choices: [
        ...LENGTHS.map((value) => ({ value, description: `${value} characters` })),
        { value: UNREADABLE, description: 'The number cannot be counted' },
      ],
    },
    ...Array.from({ length: SEAL_POSITIONS }, (_, i) => characterQuestion(i + 1)),
    ...Array.from({ length: SEAL_POSITIONS }, (_, i) => rightCharacterQuestion(i + 1)),
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

const rankOf = (l: CertaintyLabel) => CERTAINTY_LABELS.indexOf(l)
/** The weaker of two labels; with `better`, the stronger (two copies that agree stand on the better one). */
function weakerLabel(a: CertaintyLabel, b: CertaintyLabel, better = false): CertaintyLabel {
  const aWeaker = rankOf(a) >= rankOf(b)
  return aWeaker !== better ? a : b
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
  const lengthRead = readCharacter(answers[LENGTH_QUESTION], LENGTHS)
  const count = lengthRead.value === null ? null : Number(lengthRead.value)
  // The count comes first. Without one (an older recording, or an unreadable count) the number ends at its
  // last read character, or at an unreadable one the model said was there; places after it were answered
  // "none", or too weakly to say.
  let end = 0
  places.forEach((p, i) => {
    if (p.kind === 'read' || p.kind === 'unreadable') end = i + 1
  })
  if (count !== null) end = count
  // A second printed copy is a second, separate read of each place.
  const secondSeen = answers[SECOND_QUESTION]
  const second =
    count !== null && secondSeen?.type === 'predicate' && secondSeen.probability >= VISIBLE_MIN
      ? Array.from({ length: SEAL_POSITIONS }, (_, i) => placeAt(answers[secondName(i + 1)]))
      : null
  // One read of a seal, however sure the model sounds, is no better than Likely: nothing else says how many
  // characters it has. Live Jev read COYU 0154620 as 01546220 at 0.97 on the length. A second copy that
  // agrees, or a zoomed read that agrees (sealZoom.ts), lifts it back up.
  const capped = (c: CertaintyLabel): CertaintyLabel => (second ? c : weakerLabel(c, 'Likely'))
  const merged = places.slice(0, end).map((p, i): Place => {
    const other = second?.[i]
    if (!other || other.kind !== 'read') {
      return p.kind === 'read'
        ? { kind: 'read', character: { ...p.character, certainty: capped(p.character.certainty) } }
        : p
    }
    if (p.kind !== 'read') return other
    const [a, b] = [p.character, other.character]
    if (a.value === b.value) {
      return {
        kind: 'read',
        character: {
          value: a.value,
          certainty: oneStepUp(weakerLabel(a.certainty, b.certainty, true)),
        },
      }
    }
    const best = rankOf(a.certainty) <= rankOf(b.certainty) ? a : b
    return {
      kind: 'read',
      character: { value: best.value, certainty: weakerLabel(best.certainty, 'Uncertain') },
    }
  })
  const anyRead = merged.some((p) => p.kind === 'read')
  const fromLeft = anyRead
    ? merged.map((p): SealCharacter => (p.kind === 'read' ? p.character : UNREAD))
    : []
  const { characters, alternative } = checkedFromRight(fromLeft, answers, count)

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
  const reading: SealReading = {
    visible: true,
    characters,
    value,
    certainty,
    ...(alternative ? { alternative } : {}),
    ...(box ? { box } : {}),
  }
  const candidates = sealCandidates(answers, reading, SEAL_POSITIONS)
  return candidates.length > 0 ? { ...reading, candidates } : reading
}

const spelled = (cs: SealCharacter[]) => cs.map((c) => c.value ?? '?').join('')

/** `long` is `short` with one character read twice in a row: the slip a reader that loses its place makes. */
function readTwice(long: string, short: string): boolean {
  if (long.length !== short.length + 1) return false
  for (let i = 0; i + 1 < long.length; i++) {
    if (long[i] === long[i + 1] && long.slice(0, i) + long.slice(i + 1) === short) return true
  }
  return false
}

/**
 * The read from the left checked against the read from the right. Same count: each place is two reads,
 * and agreement lifts it as a second copy does. A different count: the number is in doubt (Uncertain at
 * best) and the other read is its alternative; a read with one character doubled gives way to the other,
 * else the read whose count the count question gave stands, else the read from the left.
 */
function checkedFromRight(
  fromLeft: SealCharacter[],
  answers: Record<string, SharedAnswer>,
  count: number | null,
): { characters: SealCharacter[]; alternative: string | null } {
  const places = Array.from({ length: SEAL_POSITIONS }, (_, i) =>
    placeAt(answers[rightName(i + 1)]),
  )
  let end = 0
  places.forEach((p, i) => {
    if (p.kind === 'read' || p.kind === 'unreadable') end = i + 1
  })
  const fromRight = places
    .slice(0, end)
    .reverse()
    .map((p): SealCharacter => (p.kind === 'read' ? p.character : UNREAD))
  if (fromLeft.length === 0 || !fromRight.some((c) => c.value !== null)) {
    return { characters: fromLeft, alternative: null }
  }
  if (fromRight.length === fromLeft.length) {
    const characters = fromLeft.map((a, i): SealCharacter => {
      const b = fromRight[i]!
      if (b.value === null) return a
      if (a.value === null) return b
      if (a.value === b.value) {
        return { value: a.value, certainty: oneStepUp(weakerLabel(a.certainty, b.certainty, true)) }
      }
      const best = rankOf(a.certainty) <= rankOf(b.certainty) ? a : b
      return { value: best.value, certainty: weakerLabel(best.certainty, 'Uncertain') }
    })
    return { characters, alternative: null }
  }
  const [left, right] = [spelled(fromLeft), spelled(fromRight)]
  const rightStands =
    readTwice(left, right) ||
    (!readTwice(right, left) &&
      count !== null &&
      fromRight.length === count &&
      fromLeft.length !== count)
  const [kept, other] = rightStands ? [fromRight, left] : [fromLeft, right]
  return {
    characters: kept.map((c) =>
      c.value === null ? c : { ...c, certainty: weakerLabel(c.certainty, 'Uncertain') },
    ),
    alternative: other,
  }
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
  questions: sealQuestions,
  read: (answers, ask) => readSeal(answers, ask),
  apply: (record, finding) => (finding ? { ...record, seal: finding } : record),
  export: sealExport,
}
