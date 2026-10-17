// The placards question family (spec #51, ticket #69): whether any DG placards are present, each one's
// class (1-9), its UN number (four digits, one question per character) and where it is, and whether the
// marine pollutant and limited quantity marks are present. Pure. The Markings card shows them in the hazard
// visual axis; certainty is the chip beside them and never changes their colour.
import { applyMargin, certaintyOfProbability } from './certainty'
import type { ReadingBox } from './enlargedCrop'
import type { ExportUnresolved, ExportValue } from './exportTypes'
import type { CertaintyLabel } from './inspection'
import type { PhotoFace } from './photoFace'
import type { FamilyExport, QuestionFamily } from './questionRegistry'
import type { SharedAnswer, SharedQuestion } from './questionSet'

/** Placards asked about at most: a container face rarely carries more, and each costs six questions. */
export const MAX_PLACARDS = 3
export const UN_DIGITS = 4
const UNREADABLE = 'unreadable'
const DIGIT_UNREAD = '?'
/** A yes/no needs at least this probability either way to be taken as read. */
const PRESENT = 0.5

export interface PlacardReading {
  /** 1-9, or null when the class was not read. */
  dgClass: number | null
  /** Four characters; an unread digit is "?". Null only when no digit was read at all. */
  unNumber: string | null
  /** The weakest of the class and the digits read. */
  certainty: CertaintyLabel
  /** Where it is in the photo the survey was asked on (boxes only on box-capable models). */
  box?: ReadingBox
  /** Several photos (ticket #72): the 1-based photo the box, and so the crop, belongs to. */
  photo?: number
  /** Several photos: the faces it was seen on, in photo order (faces that could not be told are left out). */
  faces?: PhotoFace[]
}

export interface MarkReading {
  /** null: the photo did not settle it. */
  answer: 'yes' | 'no' | null
  certainty: CertaintyLabel
}

export interface PlacardsReading {
  /** none: no placard seen, a result. present: at least one seen. unclear: the photo did not settle it. */
  answer: 'none' | 'present' | 'unclear'
  certainty: CertaintyLabel
  placards: PlacardReading[]
  marinePollutant: MarkReading
  limitedQuantity: MarkReading
}

declare module './survey' {
  interface SurveyFindings {
    /** The placards and DG marks, or null when the reply did not answer them. */
    placards: PlacardsReading | null
  }
}
declare module './inspection' {
  interface InspectionRecord {
    placards?: PlacardsReading
  }
}

const CERTAINTY_ORDER: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]
const worstOf = (labels: CertaintyLabel[]): CertaintyLabel =>
  labels.reduce((w, l) => (CERTAINTY_ORDER.indexOf(l) > CERTAINTY_ORDER.indexOf(w) ? l : w))

const names = {
  any: 'placards_present',
  present: (n: number) => `placard_${n}_present`,
  klass: (n: number) => `placard_${n}_class`,
  un: (n: number, position: number) => `placard_${n}_un_${position}`,
  box: (n: number) => `placard_${n}_box`,
  marine: 'marine_pollutant_mark',
  limited: 'limited_quantity_mark',
}

const DIGITS = [...'0123456789']

function questions(ask: { box: boolean }): SharedQuestion[] {
  const out: SharedQuestion[] = [
    {
      type: 'predicate',
      name: names.any,
      instructions:
        'Is at least one dangerous goods placard visible on the container in this photo? A placard is a square label standing on its point, with a hazard symbol in its upper half and a class number in its bottom corner. A yellow rectangular height sign (for example 2,6m / 8\'6"), a plate, a sticker or a label with plain text is not a placard.',
    },
  ]
  for (let n = 1; n <= MAX_PLACARDS; n++) {
    out.push(
      {
        type: 'predicate',
        name: names.present(n),
        instructions: `Is a dangerous goods placard number ${n} visible? Number them from the left of the photo; answer false if there are fewer than ${n}.`,
      },
      {
        type: 'choice',
        name: names.klass(n),
        instructions: `The hazard class printed in the bottom corner of placard number ${n}, counting from the left of the photo.`,
        choices: [
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => ({ value: `class_${c}` })),
          { value: UNREADABLE, description: 'No class number can be read clearly.' },
        ],
      },
    )
    for (let position = 1; position <= UN_DIGITS; position++) {
      out.push({
        type: 'choice',
        name: names.un(n, position),
        instructions: `Digit ${position} of 4 of the UN number printed on or beside placard number ${n}, exactly as printed.`,
        choices: [
          ...DIGITS.map((d) => ({ value: d })),
          { value: UNREADABLE, description: 'The digit is not visible or cannot be read clearly.' },
        ],
      })
    }
    if (ask.box) {
      out.push({
        type: 'box',
        name: names.box(n),
        instructions: `The dangerous goods placard number ${n}, counting from the left of the photo, with its UN number if shown.`,
      })
    }
  }
  out.push(
    {
      type: 'predicate',
      name: names.marine,
      instructions:
        'Is the marine pollutant mark (a triangle with a fish and a tree) visible on the container?',
    },
    {
      type: 'predicate',
      name: names.limited,
      instructions:
        'Is the limited quantity mark (a diamond with its upper and lower halves black) visible on the container?',
    },
  )
  return out
}

/** Yes or no from a probability, with its certainty; null when no usable answer. */
function readPredicate(
  answer: SharedAnswer | undefined,
): { yes: boolean; certainty: CertaintyLabel } | null {
  if (answer?.type !== 'predicate') return null
  const yes = answer.probability >= PRESENT
  const chosen = yes ? answer.probability : 1 - answer.probability
  return { yes, certainty: certaintyOfProbability(chosen) }
}

function readChoice(
  answer: SharedAnswer | undefined,
): { value: string; certainty: CertaintyLabel } | null {
  if (answer?.type !== 'choice') return null
  const chosen = answer.probabilities[answer.value] ?? answer.confidence
  if (chosen === null || chosen === undefined) return null
  const runnerUp = Object.entries(answer.probabilities)
    .filter(([v]) => v !== answer.value)
    .reduce<number | null>((best, [, p]) => (best === null || p > best ? p : best), null)
  return {
    value: answer.value,
    certainty: applyMargin(certaintyOfProbability(chosen), chosen, runnerUp),
  }
}

function readMark(answer: SharedAnswer | undefined): MarkReading {
  const read = readPredicate(answer)
  if (!read || read.certainty === "Can't tell") return { answer: null, certainty: "Can't tell" }
  return read.yes
    ? { answer: 'yes', certainty: read.certainty }
    : { answer: 'no', certainty: 'Not seen' }
}

function readPlacard(answers: Record<string, SharedAnswer>, n: number): PlacardReading {
  const klass = readChoice(answers[names.klass(n)])
  const classNumber = /^class_([1-9])$/.exec(klass?.value ?? '')?.[1]
  const dgClass =
    classNumber && klass && klass.certainty !== "Can't tell" ? Number(classNumber) : null
  const digits = Array.from({ length: UN_DIGITS }, (_, i) => {
    const read = readChoice(answers[names.un(n, i + 1)])
    return read && DIGITS.includes(read.value) && read.certainty !== "Can't tell"
      ? { value: read.value, certainty: read.certainty }
      : null
  })
  const unNumber = digits.some((d) => d)
    ? digits.map((d) => d?.value ?? DIGIT_UNREAD).join('')
    : null
  const certainty = worstOf([
    dgClass === null ? "Can't tell" : klass!.certainty,
    ...digits.map((d) => d?.certainty ?? ("Can't tell" as CertaintyLabel)),
  ])
  const answer = answers[names.box(n)]
  const placard: PlacardReading = { dgClass, unNumber, certainty }
  if (answer?.type === 'box' && answer.confidence !== null) {
    placard.box = { ...answer.box, confidence: answer.confidence }
  }
  return placard
}

function read(answers: Record<string, SharedAnswer>): PlacardsReading | null {
  const any = readPredicate(answers[names.any])
  if (!any) return null
  const marinePollutant = readMark(answers[names.marine])
  const limitedQuantity = readMark(answers[names.limited])
  if (!any.yes) {
    const settled = any.certainty !== "Can't tell"
    return {
      answer: settled ? 'none' : 'unclear',
      certainty: settled ? 'Not seen' : "Can't tell",
      placards: [],
      marinePollutant,
      limitedQuantity,
    }
  }
  const placards = Array.from({ length: MAX_PLACARDS }, (_, i) => i + 1)
    .filter((n) => readPredicate(answers[names.present(n)])?.yes)
    .map((n) => readPlacard(answers, n))
  return { answer: 'present', certainty: any.certainty, placards, marinePollutant, limitedQuantity }
}

const markLine = (label: string, mark: MarkReading) =>
  mark.answer === 'yes'
    ? `${label}: seen - ${mark.certainty}`
    : mark.answer === 'no'
      ? `${label}: not seen`
      : `${label}: not clear from the photo`

function placardsExport(
  record: Parameters<NonNullable<QuestionFamily['export']>>[0],
): FamilyExport {
  const out: FamilyExport = { values: [], unresolved: [], conflicts: [], summary: [] }
  const reading = record.placards
  if (!reading) return out
  const value = (v: Omit<ExportValue, 'category' | 'uncertainty'>): ExportValue => ({
    category: 'printed',
    uncertainty: null,
    ...v,
  })
  const unresolved = (field: string, reason: string): ExportUnresolved => ({
    field,
    category: 'unresolved',
    reason,
  })

  if (reading.answer === 'none') {
    out.values.push(
      value({
        field: 'placards',
        value: 'none seen',
        provenance: 'observed',
        certainty: 'Not seen',
      }),
    )
    out.summary.push('Placards: none seen')
  } else if (reading.answer === 'unclear') {
    out.unresolved.push(unresolved('placards', 'Not clear from the photo.'))
    out.summary.push('Placards: not clear from the photo')
  } else {
    if (reading.placards.length === 0) {
      out.unresolved.push(
        unresolved('placards', 'A placard is visible, but none could be told apart.'),
      )
      out.summary.push('Placards: one is visible, but none could be told apart')
    }
    reading.placards.forEach((p, i) => {
      const field = `placards[${i}]`
      if (p.dgClass === null) {
        out.unresolved.push(unresolved(`${field}.class`, 'Class not read from the photo.'))
      } else {
        out.values.push(
          value({
            field: `${field}.class`,
            value: p.dgClass,
            provenance: 'observed',
            certainty: p.certainty,
          }),
        )
      }
      if (p.unNumber === null) {
        out.unresolved.push(unresolved(`${field}.unNumber`, 'UN number not read from the photo.'))
      } else {
        for (const [at, ch] of [...p.unNumber].entries()) {
          if (ch === DIGIT_UNREAD) {
            out.unresolved.push(
              unresolved(`${field}.unNumber.position[${at}]`, 'Digit not read from the photo.'),
            )
          }
        }
        out.values.push(
          value({
            field: `${field}.unNumber`,
            value: p.unNumber,
            provenance: 'printed',
            certainty: p.certainty,
          }),
        )
      }
      const klass = p.dgClass === null ? 'class not read' : `class ${p.dgClass}`
      const un = p.unNumber === null ? 'UN number not read' : `UN ${p.unNumber}`
      out.summary.push(`Placard ${i + 1}: ${klass}, ${un} - ${p.certainty}`)
    })
  }
  for (const [field, label, mark] of [
    ['marinePollutantMark', 'Marine pollutant mark', reading.marinePollutant],
    ['limitedQuantityMark', 'Limited quantity mark', reading.limitedQuantity],
  ] as const) {
    if (mark.answer === null) out.unresolved.push(unresolved(field, 'Not clear from the photo.'))
    else {
      out.values.push(
        value({
          field,
          value: mark.answer,
          provenance: 'observed',
          certainty: mark.certainty,
        }),
      )
    }
    out.summary.push(markLine(label, mark))
  }
  return out
}

export const placardsFamily: QuestionFamily = {
  key: 'placards',
  questions,
  read,
  apply: (record, finding) => (finding ? { ...record, placards: finding } : record),
  export: placardsExport,
}
