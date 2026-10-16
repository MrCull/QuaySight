// Test support: provider replies that read the weights (ticket #34), in the response shapes the survey
// replies use (surveyReplies.ts). Hand-written; a printed figure becomes one digit answer per place.
import { weightQuestionName, type FigureUnit, type Place } from '../domain/weightQuestions'
import type { WeightQuantity } from '../domain/weights'
import type { SurveyChoice } from './surveyReplies'

export interface PrintedFigures {
  maxGross?: { kg?: string; lb?: string }
  tare?: { kg?: string; lb?: string }
  payload?: { kg?: string; lb?: string }
  capacity?: { m3?: string; cuft?: string }
}

/** The COYU 266813 0 door (22G1): the figures a careful reader sees. */
export const COYU_WEIGHTS: PrintedFigures = {
  maxGross: { kg: '30,480', lb: '67,200' },
  tare: { kg: '2,180', lb: '4,810' },
  payload: { kg: '28,300', lb: '62,390' },
  capacity: { m3: '33.2', cuft: '1,173' },
}

const WHOLE: Place[] = ['units', 'tens', 'hundreds', 'thousands', 'ten_thousands']
const CUFT: Place[] = ['units', 'tens', 'hundreds', 'thousands']
const M3: Place[] = ['units', 'tens']

function figureChoices(
  quantity: WeightQuantity,
  unit: FigureUnit,
  printed: string,
  places: Place[],
  probability: number,
): Record<string, SurveyChoice> {
  const out: Record<string, SurveyChoice> = {}
  const [whole = '', tenths] = printed.replace(/,/g, '').split('.')
  const digits = whole.split('').reverse()
  places.forEach((place, i) => {
    out[weightQuestionName(quantity, unit, place)] = [[digits[i] ?? 'none', probability]]
  })
  if (tenths !== undefined)
    out[weightQuestionName(quantity, unit, 'tenths')] = [[tenths, probability]]
  return out
}

/** One answer per digit for the printed figures given, each read at `probability`. */
export function weightChoices(
  figures: PrintedFigures,
  probability = 0.97,
): Record<string, SurveyChoice> {
  const out: Record<string, SurveyChoice> = {}
  for (const quantity of ['maxGross', 'tare', 'payload'] as const) {
    const f = figures[quantity]
    if (f?.kg) Object.assign(out, figureChoices(quantity, 'kg', f.kg, WHOLE, probability))
    if (f?.lb) Object.assign(out, figureChoices(quantity, 'lb', f.lb, WHOLE, probability))
  }
  const c = figures.capacity
  if (c?.m3) Object.assign(out, figureChoices('capacity', 'm3', c.m3, M3, probability))
  if (c?.cuft) Object.assign(out, figureChoices('capacity', 'cuft', c.cuft, CUFT, probability))
  return out
}

/** An OpenAI Decisions reply holding only these choice answers (the weights second look). */
export function openAiChoiceReply(choices: Record<string, SurveyChoice>, model = 'gpt-6-luna') {
  return {
    model,
    usage: { input_tokens: 2100, output_tokens: 0 },
    answers: Object.entries(choices).map(([name, c]) => ({
      type: 'choice',
      name,
      choice: c[0]![0],
      probabilities: c.map(([value, probability]) => ({ value, probability })),
    })),
  }
}

/** An OpenRouter Decisions reply holding only these choice answers. */
export function openRouterChoiceReply(
  choices: Record<string, SurveyChoice>,
  model = 'typesafe/jev-1.14-20261014',
) {
  return {
    model,
    answers: Object.fromEntries(
      Object.entries(choices).map(([name, c]) => [
        name,
        {
          type: 'choice',
          choice: c[0]![0],
          probabilities: Object.fromEntries(c),
          confidence: c[0]![1],
        },
      ]),
    ),
    usage: { input_tokens: 900, output_tokens: 40, cost: 0.0001 },
  }
}
