import {
  combineIdReadings,
  usableIdBox,
  type CropRegion,
  type IdBox,
  type IdCropReadRecord,
} from '../../domain/cropRead'
import { jevIdQuestionSet, readIdCharacters, type ChoiceReading } from '../../domain/idQuestions'
import { jevCaveatsOf, jevIdReading, type JevCaveats } from '../../domain/jev'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { askDecisions } from '../../services/askDecisions'
import { cropPhoto } from '../../services/scalePhoto'
import type { PlanRequest, PlanView } from '../requestPlan'
import { survey } from './survey'

/** The crop read's answer: one reading per position, its caveats, and the crop it was asked on. */
export interface CropAnswer {
  readings: ChoiceReading[]
  caveats: JevCaveats
  region: CropRegion
}

/** The same group-position character questions as the full-photo read, without asking for the box again. */
const CROP_QUESTIONS = jevIdQuestionSet({ image: 'the photo', box: false, owner: false })

const CROP_ASK = questionSetAsk(CROP_QUESTIONS, ({ answers }) => ({
  readings: readIdCharacters(answers),
  caveats: jevCaveatsOf(answers),
}))

/** The box from the full-photo read, when a crop can be made from it. */
function boxOf(plan: PlanView): IdBox | null {
  return usableIdBox(plan.answer(survey)?.box)
}

/**
 * Jev's crop read (ticket #31): on box-capable models, once the full-photo read answers with a usable
 * box, the prepared photo is cropped around the ID with a margin, scaled up within the model's photo
 * limits and asked the same character questions. The two readings are then combined per character. A
 * refinement of a reading that is already usable: its failure keeps the full-photo reading.
 */
export const idCropRead: PlanRequest<CropAnswer> = {
  id: 'crop',
  purpose: 'Reading the ID up close',
  stages: ['id'],
  after: [survey],
  optional: true,
  appliesTo: (route) => route.entry.box,
  needed: (plan) => boxOf(plan) !== null && Boolean(plan.answer(survey)?.readings),
  async send(ctx) {
    const box = boxOf(ctx)
    if (!box) throw new Error('No box to crop the ID from.')
    const { photo, region } = await cropPhoto(ctx.photo, box, ctx.route.entry.photoLimits)
    const reply = await askDecisions({ ...ctx, photo }, CROP_ASK)
    return { ...reply, answer: { ...reply.answer, region } }
  },
  replay(raw, plan, { crop }) {
    if (!crop) throw new Error('A recorded crop read names the region it was cut from.')
    return { ...CROP_ASK.map(raw, plan.route), region: crop }
  },
  apply(record, outcome, plan) {
    const first = plan.answer(survey)
    const box = boxOf(plan)
    if (!first?.readings || !box) return record
    const unanswered = (
      kind: IdCropReadRecord['outcome'],
      reason: IdCropReadRecord['reason'] = null,
    ): IdCropReadRecord => ({
      outcome: kind,
      box,
      crop: null,
      resolvedVersion: null,
      disagreements: [],
      reason,
    })

    switch (outcome.status) {
      case 'answered': {
        const { readings, caveats, region } = outcome.answer
        const combined = combineIdReadings(first.readings, readings)
        return {
          ...record,
          // The crop is the closer look at the same number: its legibility and framing answers stand.
          containerId: jevIdReading(combined.readings, caveats, first.ownerPick),
          idCropRead: {
            outcome: 'combined',
            box,
            crop: {
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
              sentWidth: region.outWidth,
              sentHeight: region.outHeight,
            },
            resolvedVersion: outcome.resolvedModel,
            disagreements: combined.disagreements,
            reason: null,
          },
        }
      }
      case 'blocked':
        return { ...record, idCropRead: unanswered('skipped-cap', outcome.reason) }
      case 'cancelled':
        return { ...record, idCropRead: unanswered('cancelled') }
      default:
        return { ...record, idCropRead: unanswered('failed') }
    }
  },
}
