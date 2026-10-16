// The container weights as survey questions (spec #27, ticket #34). Pure: the questions in the shared
// format, and the answers read back by meaning into figures (weights.ts judges them).
//
// MAX GROSS, TARE and NET (payload) are separate rows on a door, each printed in kg and again in lb, and
// the cubic capacity in m3 and cu ft. Each figure is read digit by digit: one question per digit, naming
// the digit by its place counted from the figure's right-hand end ("the thousands digit: the fourth from
// the right-hand end"), which keeps the model from losing count along a run of repeated digits (the same
// wording that took the container ID from COCI6361130 to COYU2668130, 16 Oct 2026). No arithmetic and no
// conversion is put in front of the model: the app compares the two units itself.
//
// A digit that cannot be read is unread, never filled in, and the figure with it. Nothing here names a
// maximum as a loaded weight: MAX GROSS is a rating and NET is the most a container may carry.
import { applyMargin, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import { usableIdBox, type IdBox } from './cropRead'
import type { ChoiceQuestion, SharedAnswer, SharedQuestion } from './questionSet'
import type { SurveyPart } from './survey'
import {
  evaluateWeights,
  WEIGHT_QUANTITIES,
  type Figure,
  type WeightQuantity,
  type WeightsReading,
} from './weights'

export type FigureUnit = 'kg' | 'lb' | 'm3' | 'cuft'
export type Place = 'units' | 'tens' | 'hundreds' | 'thousands' | 'ten_thousands' | 'tenths'

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i))
export const NO_DIGIT = 'none'
export const UNREADABLE = 'unreadable'
export const NOT_VISIBLE = 'not_visible'

/** The name the answer to a digit comes back under, shared by every route. */
export function weightQuestionName(
  quantity: WeightQuantity,
  unit: FigureUnit,
  place: Place,
): string {
  const row = { maxGross: 'max_gross', tare: 'tare', payload: 'payload', capacity: 'capacity' }[
    quantity
  ]
  return `${row}_${unit}_${place}`
}

export const WEIGHTS_BOX_QUESTION = 'weights_box'

interface Layout {
  unit: FigureUnit
  /** Whole-number places, lowest first. */
  whole: Place[]
  /** The place after the decimal point, when the figure has one. */
  tenths: boolean
}

const WEIGHT_PLACES: Place[] = ['units', 'tens', 'hundreds', 'thousands', 'ten_thousands']
const CUFT_PLACES: Place[] = ['units', 'tens', 'hundreds', 'thousands']

const LAYOUTS: Record<WeightQuantity, { metric: Layout; imperial: Layout }> = {
  maxGross: weightLayouts(),
  tare: weightLayouts(),
  payload: weightLayouts(),
  capacity: {
    metric: { unit: 'm3', whole: ['units', 'tens'], tenths: true },
    imperial: { unit: 'cuft', whole: CUFT_PLACES, tenths: false },
  },
}

function weightLayouts(): { metric: Layout; imperial: Layout } {
  return {
    metric: { unit: 'kg', whole: WEIGHT_PLACES, tenths: false },
    imperial: { unit: 'lb', whole: WEIGHT_PLACES, tenths: false },
  }
}

const ROW_TEXT: Record<WeightQuantity, string> = {
  maxGross: 'MAX. GROSS (also written MAX GROSS or MAXIMUM GROSS WEIGHT)',
  tare: 'TARE (also written TARE WEIGHT)',
  payload: 'NET (also written PAYLOAD or MAX PAYLOAD)',
  capacity: 'CU. CAP. (also written CUBIC CAPACITY or CAPACITY)',
}

const UNIT_TEXT: Record<FigureUnit, string> = {
  kg: 'kg (printed KGS or KG)',
  lb: 'lb (printed LBS or LB)',
  m3: 'm3 (printed CU.M or M3)',
  cuft: 'cu ft (printed CU.FT or FT3)',
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth']

const PLACE_NAME: Record<Exclude<Place, 'tenths'>, string> = {
  units: 'units digit',
  tens: 'tens digit',
  hundreds: 'hundreds digit',
  thousands: 'thousands digit',
  ten_thousands: 'ten-thousands digit',
}

const PLACE_DETAIL: Record<Exclude<Place, 'tenths'>, string> = {
  units: 'the last digit of the whole-number part',
  tens: 'the digit just before the units digit',
  hundreds: 'the first digit of the three-digit group after the thousands separator',
  thousands: 'the last digit before the thousands separator',
  ten_thousands: 'the digit just before the thousands digit, the first of a five-digit figure',
}

function placeText(layout: Layout, place: Place): string {
  if (place === 'tenths') {
    return 'Read only the tenths digit: the digit after the decimal point. If the figure is printed as a whole number, answer none.'
  }
  const ordinal = ORDINAL[layout.whole.indexOf(place)]
  const from = layout.tenths ? 'the decimal point, leftwards' : 'its right-hand end'
  return `Read only the ${PLACE_NAME[place]}: the ${ordinal} digit counting from ${from}, which is ${PLACE_DETAIL[place]}. If the figure is shorter and has no digit at this place, answer none.`
}

const LAYOUT_TEXT =
  'The weight markings on a container door print each weight as a number followed by its unit, one row each: MAX. GROSS, TARE and NET (or PAYLOAD), each in KGS and again in LBS, then CU. CAP. in CU.M and again in CU.FT.'

function digitQuestion(quantity: WeightQuantity, layout: Layout, place: Place): ChoiceQuestion {
  const anchor = place === 'units'
  return {
    type: 'choice',
    name: weightQuestionName(quantity, layout.unit, place),
    instructions: `${LAYOUT_TEXT} Look at the ${ROW_TEXT[quantity]} figure in ${UNIT_TEXT[layout.unit]}. ${placeText(layout, place)} Read the digit exactly as printed; do not work it out from the other unit, from the other rows or from what is usual for a container.`,
    choices: [
      ...DIGITS.map((value) => ({ value, description: `Digit ${value}` })),
      ...(anchor
        ? []
        : [{ value: NO_DIGIT, description: 'No digit at this place: the figure is shorter' }]),
      { value: UNREADABLE, description: 'There is a digit here, but it cannot be read clearly' },
      { value: NOT_VISIBLE, description: 'This figure is not visible in this photo' },
    ],
  }
}

/** What the weight questions depend on the route for: whether it takes box questions (catalogue). */
export interface WeightAsk {
  box: boolean
}

function placesOf(layout: Layout): Place[] {
  return [...layout.whole, ...(layout.tenths ? (['tenths'] as const) : [])]
}

/**
 * The weight questions for these quantities, in the shared format: every digit in both units. With
 * `box` (box-capable models, the survey only) also where the block of weight markings is, so a second
 * look can be made on a crop.
 */
export function weightQuestions(
  quantities: readonly WeightQuantity[],
  ask: WeightAsk,
): SharedQuestion[] {
  const questions: SharedQuestion[] = quantities.flatMap((q) =>
    [LAYOUTS[q].metric, LAYOUTS[q].imperial].flatMap((layout) =>
      placesOf(layout).map((place) => digitQuestion(q, layout, place)),
    ),
  )
  if (ask.box) {
    questions.push({
      type: 'box',
      name: WEIGHTS_BOX_QUESTION,
      instructions:
        'The block of weight markings on the container door: the MAX. GROSS, TARE, NET and CU. CAP. rows with their figures, in both units.',
    })
  }
  return questions
}

// ---------------------------------------------------------------------------------------------------
// Answers

interface DigitRead {
  value: string
  certainty: CertaintyLabel
}

const UNCLEAR: Figure = { state: 'unclear', value: null, certainty: "Can't tell" }
const NOT_SEEN: Figure = { state: 'not-visible', value: null, certainty: 'Not seen' }

/** One digit's answer: the offered value and its certainty from its probability and margin; null when unusable. */
function readDigit(answer: SharedAnswer | undefined, allowed: readonly string[]): DigitRead | null {
  if (answer?.type !== 'choice' || !allowed.includes(answer.value)) return null
  const chosen = answer.probabilities[answer.value] ?? answer.confidence
  if (chosen === null || chosen === undefined) return null
  const runnerUp = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value && allowed.includes(value))
    .reduce((best, [, p]) => Math.max(best, p), -1)
  const certainty = applyMargin(
    certaintyOfProbability(chosen),
    chosen,
    runnerUp < 0 ? null : runnerUp,
  )
  return certainty === "Can't tell" ? null : { value: answer.value, certainty }
}

const WORST: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]
const weakest = (labels: CertaintyLabel[]) =>
  labels.reduce(
    (w, l) => (WORST.indexOf(l) > WORST.indexOf(w) ? l : w),
    'Confident' as CertaintyLabel,
  )

function readFigure(
  answers: Record<string, SharedAnswer>,
  quantity: WeightQuantity,
  layout: Layout,
): Figure {
  const name = (place: Place) => weightQuestionName(quantity, layout.unit, place)
  const wholeAllowed = [...DIGITS, NO_DIGIT, UNREADABLE, NOT_VISIBLE]
  const reads = layout.whole.map((place) =>
    readDigit(
      answers[name(place)],
      place === 'units' ? wholeAllowed.filter((v) => v !== NO_DIGIT) : wholeAllowed,
    ),
  )
  // The units digit anchors the figure: not visible there means the figure is in no photo.
  if (reads[0]?.value === NOT_VISIBLE) return NOT_SEEN
  const certainties: CertaintyLabel[] = []
  let whole = 0
  let gap = false
  let sawDigit = false
  // Highest place first: nothing but no-digit may sit above the first digit, and none below it.
  for (let i = reads.length - 1; i >= 0; i--) {
    const read = reads[i]
    if (!read || read.value === UNREADABLE) return UNCLEAR
    certainties.push(read.certainty)
    const noDigit = read.value === NO_DIGIT || read.value === NOT_VISIBLE
    if (noDigit) {
      if (sawDigit) gap = true
      continue
    }
    // A zero before the first digit is no digit at all (02,180).
    if (!sawDigit && read.value === '0') continue
    sawDigit = true
    whole += Number(read.value) * 10 ** i
  }
  if (gap) return UNCLEAR
  let value = whole
  if (layout.tenths) {
    const tenths = readDigit(answers[name('tenths')], [
      ...DIGITS,
      NO_DIGIT,
      UNREADABLE,
      NOT_VISIBLE,
    ])
    if (!tenths || tenths.value === UNREADABLE) return UNCLEAR
    certainties.push(tenths.certainty)
    if (/^\d$/.test(tenths.value)) value = (whole * 10 + Number(tenths.value)) / 10
  }
  if (!(value > 0)) return UNCLEAR
  return { state: 'read', value, certainty: weakest(certainties) }
}

/**
 * The weights as read, by meaning, for the quantities asked (all by default). A figure with any digit
 * unreadable, a tie or no answer is unread; it is never filled in.
 */
export function readWeights(
  answers: Record<string, SharedAnswer>,
  quantities: readonly WeightQuantity[] = WEIGHT_QUANTITIES,
): WeightsReading {
  const out: WeightsReading = {}
  for (const q of quantities) {
    out[q] = {
      metric: readFigure(answers, q, LAYOUTS[q].metric),
      imperial: readFigure(answers, q, LAYOUTS[q].imperial),
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------
// The survey part

/** What the survey read of the weights: the figures, and where the weight block is on box-capable models. */
export interface WeightsFinding {
  readings: WeightsReading
  /** A box for the weight block, when asked and usable. A second look crops to it. */
  box: IdBox | null
}

declare module './survey' {
  interface SurveyFindings {
    weights: WeightsFinding
  }
}

/** The survey part for the weights: all four quantities, both units. */
export const weightsPart: SurveyPart = {
  key: 'weights',
  questions: (ask) => weightQuestions(WEIGHT_QUANTITIES, { box: ask.box }),
  read: (answers, ask) => {
    const answer = answers[WEIGHTS_BOX_QUESTION]
    const box =
      ask.box && answer?.type === 'box' && answer.confidence !== null
        ? usableIdBox({ ...answer.box, confidence: answer.confidence })
        : null
    return { readings: readWeights(answers), box }
  },
  apply: (record, finding) => ({ ...record, weights: evaluateWeights(finding.readings) }),
}
