import {
  combineIdReadings,
  usableIdBox,
  type CropRegion,
  type IdBox,
  type IdCropReadRecord,
} from '../../domain/cropRead'
import {
  jevIdQuestionSet,
  lunaIdQuestionSet,
  readIdCharacters,
  type ChoiceReading,
} from '../../domain/idQuestions'
import { withCategoryLetter } from '../../domain/idCandidates'
import { combineOwnerReading } from '../../domain/ownerPick'
import { jevCaveatsOf, jevIdReading, type JevCaveats } from '../../domain/jev'
import { assembleLunaReading } from '../../domain/luna'
import { questionSetOf } from '../../domain/providers'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { askDecisions } from '../../services/askDecisions'
import { cropForRead } from '../../services/scalePhoto'
import type { PlanRequest, PlanView, RunRoute } from '../requestPlan'
import { recheckedReadings } from './idRecheck'
import { regions } from './regions'
import { survey } from './survey'

/** The zoomed read's answer: one reading per position, its caveats, and the crop it was asked on. */
export interface CropAnswer {
  readings: ChoiceReading[]
  caveats: JevCaveats
  region: CropRegion
}

/**
 * Space kept around the named area on every side, as a fraction of its long side. The marks already
 * name a generous area (a cell, or two), so this adds a margin rather than the 0.35 a tight box needs.
 */
export const ZOOM_MARGIN = 0.25

const NO_CAVEATS: JevCaveats = { hardToRead: false, partlyOutOfFrame: false }

/** The same group-position character questions as the whole-photo read, in the route's own wording, without the owner or box questions. */
function zoomAsk(route: RunRoute) {
  const luna = questionSetOf(route.entry) === 'luna'
  const set = luna
    ? lunaIdQuestionSet(Array.from({ length: 11 }, (_, i) => i + 1))
    : jevIdQuestionSet({ image: 'the photo', box: false, owner: false })
  return questionSetAsk(set, ({ answers }) => ({
    readings: readIdCharacters(answers),
    caveats: luna ? NO_CAVEATS : jevCaveatsOf(answers),
  }))
}

/**
 * How the zoomed read joins the whole-photo one. Jev's weighs them character by character (a crop fixed one
 * wrong digit on COYU 266813 0). Luna's only fills and corroborates: on the regression set its zoomed read
 * overruled right whole-photo characters (COYU 266813 0, JDLU 200690 2) more often than it fixed wrong ones.
 */
export function zoomMode(route: RunRoute): 'weigh' | 'fill-only' {
  return questionSetOf(route.entry) === 'luna' ? 'fill-only' : 'weigh'
}

/** The area the numbered regions named for the ID, as a box a crop can be cut around. */
function areaOf(plan: PlanView): { box: IdBox; marks: number[] } | null {
  const area = plan.answer(regions)?.id
  if (!area) return null
  const box = usableIdBox({ ...area.box, confidence: 1 })
  return box ? { box, marks: area.marks } : null
}

/**
 * The zoomed ID read (ticket #84): once the numbered regions name where the ID is, that area is cut from
 * the full-resolution photo with a margin, scaled up within the model's photo limits and asked the same
 * character questions. The two readings are combined per character (the more confident one wins, a
 * disagreement is recorded, two that agree throughout are corroborated). The same on Luna and Jev: it
 * replaces Jev's own coordinate box as the way the ID is located. A refinement of a reading that is
 * already usable: its failure keeps the whole-photo reading.
 */
export const idCropRead: PlanRequest<CropAnswer> = {
  id: 'crop',
  purpose: 'Reading the ID up close',
  stages: ['id'],
  after: [survey, regions],
  optional: true,
  needed: (plan) => areaOf(plan) !== null && Boolean(plan.answer(survey)?.readings),
  async send(ctx) {
    const area = areaOf(ctx)
    if (!area) throw new Error('No area to crop the ID from.')
    const { photo, region } = await cropForRead(
      ctx.photo,
      ctx.original,
      area.box,
      ctx.route.entry.photoLimits,
      ZOOM_MARGIN,
    )
    const reply = await askDecisions({ ...ctx, photo }, zoomAsk(ctx.route))
    return { ...reply, answer: { ...reply.answer, region } }
  },
  replay(raw, plan, { crop }) {
    if (!crop) throw new Error('A recorded crop read names the region it was cut from.')
    return { ...zoomAsk(plan.route).map(raw, plan.route), region: crop }
  },
  apply(record, outcome, plan) {
    const first = plan.answer(survey)
    const area = areaOf(plan)
    if (!first?.readings || !area) return record
    const { box, marks } = area
    const unanswered = (
      kind: IdCropReadRecord['outcome'],
      reason: IdCropReadRecord['reason'] = null,
    ): IdCropReadRecord => ({
      outcome: kind,
      box,
      marks,
      crop: null,
      resolvedVersion: null,
      disagreements: [],
      reason,
    })

    switch (outcome.status) {
      case 'answered': {
        const { readings, caveats, region } = outcome.answer
        // Behind a Luna re-check's fill-ins, when that has answered: the zoomed read joins the best whole-photo reading.
        const wholeReadings = recheckedReadings(plan) ?? first.readings
        const combined = combineIdReadings(wholeReadings, readings, zoomMode(plan.route))
        const luna = questionSetOf(plan.route.entry) === 'luna'
        const reading = luna
          ? assembleLunaReading(combined.readings, first.ownerPick, combined.corroborated)
          : // The crop is the closer look at the same number: its legibility and framing answers stand.
            jevIdReading(combined.readings, caveats, first.ownerPick, combined.corroborated)
        return {
          ...record,
          containerId: { ...reading, ...(record.containerId?.box ? { box: record.containerId.box } : {}) },
          idCropRead: {
            outcome: 'combined',
            box,
            marks,
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
            read: { readings, caveats },
            whole: withCategoryLetter(combineOwnerReading(wholeReadings, first.ownerPick).readings),
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
