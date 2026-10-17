import { usableIdBox, type CropRegion } from '../../domain/cropRead'
import { questionSet } from '../../domain/questionSet'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { readWeights, weightQuestions } from '../../domain/weightQuestions'
import {
  evaluateWeights,
  secondLookQuantities,
  weightsAfterReread,
  type WeightQuantity,
  type WeightsReading,
} from '../../domain/weights'
import { askDecisions } from '../../services/askDecisions'
import { cropForRead, cropPhoto } from '../../services/scalePhoto'
import type { PlanRequest, PlanView } from '../requestPlan'
import { ZOOM_MARGIN } from './idCropRead'
import { regions } from './regions'
import { survey } from './survey'

/** The second look's answer: just the weights asked again, and the crop it was asked on, if any. */
export interface WeightCheckAnswer {
  quantities: WeightQuantity[]
  readings: WeightsReading
  crop: CropRegion | null
}

export const WEIGHT_CHECK_PURPOSE = 'Checking the weights'

const INSTRUCTIONS =
  'Read the weight markings printed on this freight container photo, digit by digit. Answer each question from what is visible; if a digit cannot be read, answer unreadable rather than guessing.'

/** The second look's questions for these weights, and how its reply is read. */
function weightsAsk(quantities: WeightQuantity[], crop: CropRegion | null) {
  const set = questionSet(INSTRUCTIONS, weightQuestions(quantities, { box: false }))
  return questionSetAsk(set, ({ answers }) => ({
    quantities,
    readings: readWeights(answers, quantities),
    crop,
  }))
}

/** The weights the first reading left in disagreement or unread (domain/weights.ts). */
function askedOf(plan: PlanView): WeightQuantity[] {
  const first = plan.answer(survey)?.findings.weights
  return first ? secondLookQuantities(first.readings) : []
}

/**
 * The second look at the weights (spec #27, E; ticket #87): when the survey's kg and lb readings of a
 * weight disagree after conversion, printed and calculated payload conflict, or a weight came back
 * unclear in both units, just those weights are asked again, once, on a zoomed crop of the weights
 * panel. The crop is the area the numbered regions named (ticket #84), else the survey's own box.
 * A refinement of a usable reading: its failure keeps the first readings, which then read Uncertain
 * with both shown.
 */
export const weightCheck: PlanRequest<WeightCheckAnswer> = {
  id: 'weights',
  purpose: WEIGHT_CHECK_PURPOSE,
  stages: ['details'],
  after: [survey, regions],
  optional: true,
  needed: (plan) => askedOf(plan).length > 0,
  async send(ctx) {
    const quantities = askedOf(ctx)
    const area = ctx.answer(regions)?.weights
    const zoomBox = area ? usableIdBox({ ...area.box, confidence: 1 }) : null
    const box = zoomBox ?? usableIdBox(ctx.answer(survey)?.findings.weights.box)
    let photo = ctx.photo
    let crop: CropRegion | null = null
    if (box) {
      try {
        const cropped = zoomBox
          ? await cropForRead(
              ctx.photo,
              ctx.original,
              box,
              ctx.route.entry.photoLimits,
              ZOOM_MARGIN,
            )
          : await cropPhoto(ctx.photo, box, ctx.route.entry.photoLimits)
        photo = cropped.photo
        crop = cropped.region
      } catch {
        // No crop fits the model's limits: the whole photo is still a fair look.
      }
    }
    return askDecisions({ ...ctx, photo }, weightsAsk(quantities, crop))
  },
  // The crop is not kept on the record, so a replay does not need it.
  replay: (raw, plan) => weightsAsk(askedOf(plan), null).map(raw, plan.route),
  apply(record, outcome, plan) {
    const first = plan.answer(survey)?.findings.weights
    if (!first) return record
    switch (outcome.status) {
      case 'answered':
        return { ...record, weights: weightsAfterReread(first.readings, outcome.answer.readings) }
      case 'blocked':
        return { ...record, weights: evaluateWeights(first.readings, null, 'skipped-cap') }
      case 'cancelled':
        return { ...record, weights: evaluateWeights(first.readings, null, 'cancelled') }
      default:
        return { ...record, weights: evaluateWeights(first.readings, null, 'failed') }
    }
  },
}
