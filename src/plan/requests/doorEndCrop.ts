import type { CropRegion, IdBox } from '../../domain/cropRead'
import { DOOR_DAMAGE_REQUEST } from '../../domain/damageFamilies'
import { damageSetAsk } from '../../domain/damageSetAsk'
import { withDamageReading, type DamageSetReading } from '../../domain/damageSets'
import { DOOR_END_MARGIN, doorEndBox, type DoorEndCropRecord } from '../../domain/doorEndCrop'
import { askDecisions } from '../../services/askDecisions'
import { cropForRead } from '../../services/scalePhoto'
import type { PlanRequest, PlanView } from '../requestPlan'
import { regions } from './regions'
import { survey } from './survey'

/** The door set's reading of the door end alone, and the crop it was read from. */
export interface DoorEndCropAnswer {
  reading: DamageSetReading
  region: CropRegion
}

const ASK = damageSetAsk(DOOR_DAMAGE_REQUEST, 'doorDamage')
const ID = 'door-end-crop'

function boxOf(plan: PlanView): IdBox | null {
  return doorEndBox(plan.answer(survey)?.findings.face, plan.answer(regions))
}

/**
 * The door end checked on its own (domain/doorEndCrop.ts): once the survey says the photo shows the doors
 * and the numbered regions name the columns the door end spans, that area is cut from the full-resolution
 * photo and the door set is asked again of the crop. Its reading stands in for the whole-photo one. A
 * refinement: its failure keeps the whole-photo reading.
 */
export const doorEndCrop: PlanRequest<DoorEndCropAnswer> = {
  id: ID,
  purpose: 'Checking the door end up close',
  stages: ['damage'],
  after: [survey, regions],
  optional: true,
  needed: (plan) => boxOf(plan) !== null,
  async send(ctx) {
    const box = boxOf(ctx)
    if (!box) throw new Error('No door end to crop.')
    const { photo, region } = await cropForRead(
      ctx.photo,
      ctx.original,
      box,
      ctx.route.entry.photoLimits,
      DOOR_END_MARGIN,
    )
    const reply = await askDecisions({ ...ctx, photo }, ASK)
    return { ...reply, answer: { reading: reply.answer, region } }
  },
  replay(raw, plan, { crop }) {
    if (!crop) throw new Error('A recorded door-end crop names the region it was cut from.')
    return { reading: ASK.map(raw, plan.route), region: crop }
  },
  apply(record, outcome, plan) {
    const box = boxOf(plan)
    if (!box) return record
    const unanswered = (
      kind: DoorEndCropRecord['outcome'],
      reason: DoorEndCropRecord['reason'] = null,
    ): DoorEndCropRecord => ({ outcome: kind, box, crop: null, resolvedVersion: null, reason })

    switch (outcome.status) {
      case 'answered': {
        const { reading, region } = outcome.answer
        // A crop that missed the door end leaves the whole-photo reading as it is.
        const checked = reading.inspectable
          ? withDamageReading(record, {
              ...reading,
              passId: `${record.id}-${ID}`,
              fromCrop: true,
            })
          : record
        return {
          ...checked,
          doorEndCrop: {
            outcome: 'checked',
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
            reason: null,
          },
        }
      }
      case 'blocked':
        return { ...record, doorEndCrop: unanswered('skipped-cap', outcome.reason) }
      case 'cancelled':
        return { ...record, doorEndCrop: unanswered('cancelled') }
      default:
        return { ...record, doorEndCrop: unanswered('failed') }
    }
  },
}
