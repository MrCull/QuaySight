// Container details read by the survey (spec 4.3, 4.4; ticket #32). Pure: questions in the shared
// format, and the answers read back by meaning into the record's `details`.
//
// - The ISO size/type code is a whole-code choice among common codes, plus other, unreadable and not
//   visible, so the model is never forced into a wrong common answer. What it decodes to comes from the
//   app's table (isoSizeCode.ts), never from the model.
// - Reefer, open top, tank and flat rack are separate yes/no/unknown checks.
// - Super Heavy, high-container, overwidth, fumigation and marine pollutant are separate checks: a
//   high-container caution is never reported as overwidth.
// - The DG placard is its class and symbol only; its absence is "no DG placard visible", never a claim
//   about the cargo.
//
// Weights (max gross, tare, payload, capacity) are not asked here yet; they land in `record.weights`.
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel, InspectionRecord } from './inspection'
import { decodeSizeCode, type DecodedSizeCode, type EquipmentType } from './isoSizeCode'
import type { ChoiceQuestion, SharedAnswer, SharedQuestion } from './questionSet'
import type { SurveyPart } from './survey'

/** Where a detail came from: printed on the container, decoded from the ISO code, or judged from the photo. */
export type DetailSource = 'printed' | 'decoded' | 'observed'

/**
 * read: a common code was read. other: a code is printed but is not one of the common codes.
 * unreadable: a code is printed but cannot be read. not-visible: no code in the photo. unclear: no
 * answer clear enough to say which.
 */
export type SizeCodeState = 'read' | 'other' | 'unreadable' | 'not-visible' | 'unclear'

export interface SizeCodeReading {
  state: SizeCodeState
  /** The printed code, only when read. */
  code: string | null
  certainty: CertaintyLabel
  source: 'printed'
  /** A plausible other common code ("Also possible"), or null. */
  alternative: string | null
  /** What the code decodes to; null when not read or not in the decoding table. */
  decoded: DecodedSizeCode | null
}

/** One yes/no/unknown check. answer null: can't tell. */
export interface CheckReading {
  answer: 'yes' | 'no' | null
  /** A marking answered no is Not seen: it is in no photo. */
  certainty: CertaintyLabel
  source: 'observed'
  /** Plain words when the check disagrees with the decoded size/type code, or null. */
  conflict: string | null
}

export const EQUIPMENT_CHECKS = ['reefer', 'openTop', 'tank', 'flatRack'] as const
export type EquipmentCheck = (typeof EQUIPMENT_CHECKS)[number]

export const MARKING_CHECKS = [
  'superHeavy',
  'highContainer',
  'overwidth',
  'fumigation',
  'marinePollutant',
] as const
export type MarkingCheck = (typeof MARKING_CHECKS)[number]

/** The DG placard as seen: its class and symbol only. Never a statement about the cargo. */
export interface DgPlacardReading {
  /** placard: one is visible. none: no placard visible. null: can't tell. */
  answer: 'placard' | 'none' | null
  /** The class number on the placard (1 to 9), when read. */
  dgClass: number | null
  /** The placard's symbol, from its class. */
  symbol: string | null
  certainty: CertaintyLabel
}

export interface ContainerDetailsReading {
  sizeCode: SizeCodeReading
  equipment: Record<EquipmentCheck, CheckReading>
  markings: Record<MarkingCheck, CheckReading>
  dgPlacard: DgPlacardReading
}

declare module './inspection' {
  interface InspectionRecord {
    /**
     * Container details read live by the survey (ticket #32). Absent when they were not asked: recorded
     * runs, and live runs whose survey did not answer. Absent means not assessed, never Not seen.
     */
    details?: ContainerDetailsReading
  }
}

// ---------------------------------------------------------------------------------------------------
// Questions

/** Common ISO 6346 size/type codes offered as whole-code choices (spec 4.3). */
export const COMMON_SIZE_CODES = [
  '22G1',
  '22G0',
  '20G1',
  '20G0',
  '25G1',
  '22R1',
  '22R0',
  '22U1',
  '22U6',
  '22T6',
  '22T0',
  '22P1',
  '22P3',
  '22V1',
  '22B0',
  '22H0',
  '42G1',
  '42G0',
  '40G1',
  '45G1',
  '45G0',
  '42R1',
  '45R1',
  '45R0',
  '42U1',
  '45U1',
  '42P1',
  '42P3',
  '45P3',
  '42T6',
  'L5G1',
  'L2G1',
  'LEG1',
] as const

export const SIZE_CODE_OTHER = 'other'
export const SIZE_CODE_UNREADABLE = 'unreadable'
export const SIZE_CODE_NOT_VISIBLE = 'not_visible'

export const DETAIL_QUESTION_NAMES = {
  sizeCode: 'size_type_code',
  equipment: {
    reefer: 'equipment_reefer',
    openTop: 'equipment_open_top',
    tank: 'equipment_tank',
    flatRack: 'equipment_flat_rack',
  } satisfies Record<EquipmentCheck, string>,
  markings: {
    superHeavy: 'marking_super_heavy',
    highContainer: 'marking_high_container',
    overwidth: 'marking_overwidth',
    fumigation: 'marking_fumigation',
    marinePollutant: 'marking_marine_pollutant',
  } satisfies Record<MarkingCheck, string>,
  dgPlacard: 'dg_placard',
} as const

const YES_NO_UNKNOWN = (yes: string, no: string): ChoiceQuestion['choices'] => [
  { value: 'yes', description: yes },
  { value: 'no', description: no },
  { value: 'unknown', description: 'This photo does not show enough to say' },
]

const EQUIPMENT_INSTRUCTIONS: Record<EquipmentCheck, [question: string, yes: string, no: string]> =
  {
    reefer: [
      'Is this a refrigerated (reefer) container, with a refrigeration unit or machinery panel built into one end?',
      'A reefer container',
      'Not a reefer container',
    ],
    openTop: [
      'Is this an open-top container, with no solid steel roof, closed by a removable tarpaulin over roof bows?',
      'An open-top container',
      'Not an open-top container',
    ],
    tank: [
      'Is this a tank container: a cylindrical tank held inside a steel frame?',
      'A tank container',
      'Not a tank container',
    ],
    flatRack: [
      'Is this a flat rack or platform: a floor with end walls or corner posts, but no side walls and no roof?',
      'A flat rack or platform',
      'Not a flat rack or platform',
    ],
  }

const MARKING_INSTRUCTIONS: Record<MarkingCheck, [question: string, yes: string, no: string]> = {
  superHeavy: [
    'Is a SUPER HEAVY marking visible on the container?',
    'A SUPER HEAVY marking is visible',
    'No SUPER HEAVY marking is visible',
  ],
  highContainer: [
    'Is the high-container caution visible: yellow and black diagonal stripes along the top edge or at the top corners, or a sign warning that the container is taller than usual? This is a height warning, not a width warning.',
    'High-container caution stripes or signage are visible',
    'No high-container caution is visible',
  ],
  overwidth: [
    'Is an overwidth marking visible, warning that the container is wider than standard? Do not count the high-container caution stripes: they warn about height, not width.',
    'An overwidth marking is visible',
    'No overwidth marking is visible',
  ],
  fumigation: [
    'Is a fumigation warning sign visible, saying the container is or was under fumigation?',
    'A fumigation warning sign is visible',
    'No fumigation warning sign is visible',
  ],
  marinePollutant: [
    'Is the marine pollutant mark visible: a triangle showing a dead fish and a dead tree?',
    'The marine pollutant mark is visible',
    'No marine pollutant mark is visible',
  ],
}

/** The DG classes and their placard symbols (UN Model Regulations). Symbol and class only. */
const DG_CLASSES: Record<number, { name: string; symbol: string }> = {
  1: { name: 'explosives', symbol: 'Exploding bomb' },
  2: { name: 'gases', symbol: 'Gas cylinder, flame or skull and crossbones' },
  3: { name: 'flammable liquids', symbol: 'Flame' },
  4: { name: 'flammable solids', symbol: 'Flame' },
  5: { name: 'oxidisers and organic peroxides', symbol: 'Flame over circle' },
  6: { name: 'toxic and infectious substances', symbol: 'Skull and crossbones' },
  7: { name: 'radioactive material', symbol: 'Radiation trefoil' },
  8: { name: 'corrosives', symbol: 'Liquids eating into a hand and metal' },
  9: { name: 'miscellaneous dangerous goods', symbol: 'Seven vertical stripes' },
}

/** The DG class's plain name, e.g. "flammable liquids". */
export function dgClassName(dgClass: number): string | null {
  return DG_CLASSES[dgClass]?.name ?? null
}

/** The survey's container-detail questions, in the shared format (11 questions). */
export function containerDetailQuestions(): SharedQuestion[] {
  const names = DETAIL_QUESTION_NAMES
  const sizeCode: ChoiceQuestion = {
    type: 'choice',
    name: names.sizeCode,
    instructions:
      'The ISO size/type code is printed on the container as four characters, usually below or beside the container number (for example 22G1 or 45G1). Which code is printed? Read it exactly as printed; do not work it out from the container size.',
    choices: [
      ...COMMON_SIZE_CODES.map((code) => ({ value: code, description: `Code ${code}` })),
      {
        value: SIZE_CODE_OTHER,
        description: 'A size/type code is printed, but it is none of the codes listed',
      },
      {
        value: SIZE_CODE_UNREADABLE,
        description: 'A size/type code is printed, but it cannot be read clearly',
      },
      { value: SIZE_CODE_NOT_VISIBLE, description: 'No size/type code is visible in this photo' },
    ],
  }
  const check = (name: string, [question, yes, no]: [string, string, string]): ChoiceQuestion => ({
    type: 'choice',
    name,
    instructions: question,
    choices: YES_NO_UNKNOWN(yes, no),
  })
  const dgPlacard: ChoiceQuestion = {
    type: 'choice',
    name: names.dgPlacard,
    instructions:
      'Is a dangerous-goods (DG) placard visible on the container: a diamond-shaped label with a symbol and a class number at its bottom corner? If one is visible, which class does it show?',
    choices: [
      { value: 'none', description: 'No dangerous-goods placard is visible' },
      ...Object.entries(DG_CLASSES).map(([n, c]) => ({
        value: `class_${n}`,
        description: `A class ${n} placard (${c.name}): ${c.symbol.toLowerCase()}`,
      })),
      {
        value: 'unreadable',
        description: 'A dangerous-goods placard is visible, but its class cannot be read',
      },
    ],
  }
  return [
    sizeCode,
    ...EQUIPMENT_CHECKS.map((c) => check(names.equipment[c], EQUIPMENT_INSTRUCTIONS[c])),
    ...MARKING_CHECKS.map((c) => check(names.markings[c], MARKING_INSTRUCTIONS[c])),
    dgPlacard,
  ]
}

// ---------------------------------------------------------------------------------------------------
// Answers

/** A plausible other value needs at least this probability to be shown. */
const ALTERNATIVE_MIN = 0.15

interface ChoiceRead {
  value: string
  certainty: CertaintyLabel
  /** The most probable other value, with its probability. */
  runnerUp: { value: string; probability: number } | null
}

/** The chosen value and its certainty from its probability and its margin over the next value. */
function readChoice(answer: SharedAnswer | undefined): ChoiceRead | null {
  if (answer?.type !== 'choice') return null
  const chosen = answer.probabilities[answer.value] ?? answer.confidence
  if (chosen === null || chosen === undefined) return null
  const others = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .sort((a, b) => b[1] - a[1])
  const best = others[0]
  return {
    value: answer.value,
    certainty: applyMargin(certaintyOfProbability(chosen), chosen, best?.[1] ?? null),
    runnerUp: best ? { value: best[0], probability: best[1] } : null,
  }
}

const UNCLEAR = "Can't tell" as const

function readSizeCode(answer: SharedAnswer | undefined): SizeCodeReading {
  const unclear: SizeCodeReading = {
    state: 'unclear',
    code: null,
    certainty: UNCLEAR,
    source: 'printed',
    alternative: null,
    decoded: null,
  }
  const read = readChoice(answer)
  if (!read || read.certainty === UNCLEAR) return unclear
  switch (read.value) {
    case SIZE_CODE_NOT_VISIBLE:
      return { ...unclear, state: 'not-visible', certainty: 'Not seen' }
    case SIZE_CODE_UNREADABLE:
      return { ...unclear, state: 'unreadable' }
    case SIZE_CODE_OTHER:
      return { ...unclear, state: 'other', certainty: read.certainty }
  }
  const common: readonly string[] = COMMON_SIZE_CODES
  const runnerUp = read.runnerUp
  return {
    state: 'read',
    code: read.value,
    certainty: read.certainty,
    source: 'printed',
    alternative:
      runnerUp && runnerUp.probability >= ALTERNATIVE_MIN && common.includes(runnerUp.value)
        ? runnerUp.value
        : null,
    decoded: decodeSizeCode(read.value, read.certainty),
  }
}

function readCheck(answer: SharedAnswer | undefined, marking: boolean): CheckReading {
  const read = readChoice(answer)
  const value = read?.value
  if (!read || read.certainty === UNCLEAR || (value !== 'yes' && value !== 'no')) {
    return { answer: null, certainty: UNCLEAR, source: 'observed', conflict: null }
  }
  return {
    answer: value,
    certainty: marking && value === 'no' ? 'Not seen' : read.certainty,
    source: 'observed',
    conflict: null,
  }
}

function readDgPlacard(answer: SharedAnswer | undefined): DgPlacardReading {
  const read = readChoice(answer)
  if (!read || read.certainty === UNCLEAR) {
    return { answer: null, dgClass: null, symbol: null, certainty: UNCLEAR }
  }
  if (read.value === 'none') {
    return { answer: 'none', dgClass: null, symbol: null, certainty: 'Not seen' }
  }
  const dgClass = /^class_(\d)$/.exec(read.value)?.[1]
  const known = dgClass ? DG_CLASSES[Number(dgClass)] : undefined
  return {
    answer: 'placard',
    dgClass: known ? Number(dgClass) : null,
    symbol: known?.symbol ?? null,
    certainty: read.certainty,
  }
}

/** The equipment each check stands for, as the decoded type code names it. */
const CHECK_EQUIPMENT: Record<EquipmentCheck, readonly EquipmentType[]> = {
  reefer: ['reefer'],
  openTop: ['open-top'],
  tank: ['tank'],
  flatRack: ['flat-rack', 'platform'],
}
const CHECK_NAME: Record<EquipmentCheck, string> = {
  reefer: 'a reefer',
  openTop: 'an open top',
  tank: 'a tank',
  flatRack: 'a flat rack or platform',
}

function weakerThanLikely(certainty: CertaintyLabel): CertaintyLabel {
  return certainty === 'Confident' || certainty === 'Likely' ? 'Uncertain' : certainty
}

/**
 * A check that disagrees with the decoded code keeps its answer, gains a plain note and reads no more
 * than Uncertain. Only a code read Likely or better is weighed against a check.
 */
function withCodeConflict(
  check: EquipmentCheck,
  reading: CheckReading,
  code: SizeCodeReading,
): CheckReading {
  const decoded = code.decoded
  if (!decoded || reading.answer === null) return reading
  if (code.certainty !== 'Confident' && code.certainty !== 'Likely') return reading
  const codeSays = CHECK_EQUIPMENT[check].includes(decoded.type.equipment)
  if (codeSays && reading.answer === 'no') {
    return {
      ...reading,
      certainty: weakerThanLikely(reading.certainty),
      conflict: `The size/type code ${decoded.code} is ${CHECK_NAME[check]} code, but the photo was read as not ${CHECK_NAME[check]}.`,
    }
  }
  if (!codeSays && reading.answer === 'yes') {
    return {
      ...reading,
      certainty: weakerThanLikely(reading.certainty),
      conflict: `The photo was read as ${CHECK_NAME[check]}, but the size/type code ${decoded.code} is ${decoded.type.label.toLowerCase()}.`,
    }
  }
  return reading
}

function mapRecord<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<K, V>
}

/** The details as read, by meaning. A question with no clear answer is unread, never filled in. */
export function readContainerDetails(
  answers: Record<string, SharedAnswer>,
): ContainerDetailsReading {
  const names = DETAIL_QUESTION_NAMES
  const sizeCode = readSizeCode(answers[names.sizeCode])
  return {
    sizeCode,
    equipment: mapRecord(EQUIPMENT_CHECKS, (c) =>
      withCodeConflict(c, readCheck(answers[names.equipment[c]], false), sizeCode),
    ),
    markings: mapRecord(MARKING_CHECKS, (c) => readCheck(answers[names.markings[c]], true)),
    dgPlacard: readDgPlacard(answers[names.dgPlacard]),
  }
}

/** The details on the record. The decoded code also fills `sizeCode`, which exports and summaries read. */
export function applyContainerDetails(
  record: InspectionRecord,
  details: ContainerDetailsReading,
): InspectionRecord {
  return { ...record, details, sizeCode: details.sizeCode.decoded }
}

/** The survey part for the container details. */
export const containerDetailsPart: SurveyPart = {
  key: 'details',
  questions: () => containerDetailQuestions(),
  read: (answers) => readContainerDetails(answers),
  apply: applyContainerDetails,
}
