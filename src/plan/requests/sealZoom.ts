import { usableIdBox, type CropRegion, type IdBox } from '../../domain/cropRead'
import { questionSet } from '../../domain/questionSet'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { readSeal, sealQuestions, type SealReading } from '../../domain/sealFamily'
import { combineSealReads, type SealZoomRecord } from '../../domain/sealZoom'
import { askDecisions } from '../../services/askDecisions'
import { cropForRead } from '../../services/scalePhoto'
import type { PlanRequest, PlanView } from '../requestPlan'
import { ZOOM_MARGIN } from './idCropRead'
import { regions } from './regions'
import { survey } from './survey'

/** The zoomed seal read's answer: the seal as read from the crop (null when it gave no answer to visibility), and the crop. */
export interface SealZoomAnswer {
  seal: SealReading | null
  region: CropRegion
}

const INSTRUCTIONS =
  'This is a close view of part of a freight container photo. Read the number on the seal fitted to the container door, character by character. Answer each question from what is visible; if a character cannot be read, answer unreadable rather than guessing.'

const SEAL_ASK = questionSetAsk(
  questionSet(INSTRUCTIONS, sealQuestions({ box: false })),
  ({ answers }) => readSeal(answers, { box: false }),
)

function areaOf(plan: PlanView): { box: IdBox; marks: number[] } | null {
  const area = plan.answer(regions)?.seal
  if (!area) return null
  const box = usableIdBox({ ...area.box, confidence: 1 })
  return box ? { box, marks: area.marks } : null
}

/**
 * The zoomed seal read (ticket #84): once the numbered regions name where the seal is, that area is cut
 * from the full-resolution photo and the seal's characters are read again. The zoomed read and the
 * whole-photo one are two reads of one number (domain/sealZoom.ts). A refinement: its failure keeps the
 * whole-photo reading.
 */
export const sealZoom: PlanRequest<SealZoomAnswer> = {
  id: 'seal-zoom',
  purpose: 'Reading the seal up close',
  stages: ['details'],
  after: [survey, regions],
  optional: true,
  needed: (plan) => areaOf(plan) !== null,
  async send(ctx) {
    const area = areaOf(ctx)
    if (!area) throw new Error('No area to crop the seal from.')
    const { photo, region } = await cropForRead(
      ctx.photo,
      ctx.original,
      area.box,
      ctx.route.entry.photoLimits,
      ZOOM_MARGIN,
    )
    const reply = await askDecisions({ ...ctx, photo }, SEAL_ASK)
    return { ...reply, answer: { seal: reply.answer, region } }
  },
  replay(raw, plan, { crop }) {
    if (!crop) throw new Error('A recorded seal zoom names the region it was cut from.')
    return { seal: SEAL_ASK.map(raw, plan.route), region: crop }
  },
  apply(record, outcome, plan) {
    const area = areaOf(plan)
    if (!area) return record
    const { box, marks } = area
    const unanswered = (
      kind: SealZoomRecord['outcome'],
      reason: SealZoomRecord['reason'] = null,
    ): SealZoomRecord => ({ outcome: kind, box, marks, crop: null, resolvedVersion: null, reason })

    switch (outcome.status) {
      case 'answered': {
        const { seal, region } = outcome.answer
        const combined = combineSealReads(record.seal, seal)
        return {
          ...record,
          ...(combined ? { seal: combined } : {}),
          sealZoomRead: {
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
            reason: null,
          },
        }
      }
      case 'blocked':
        return { ...record, sealZoomRead: unanswered('skipped-cap', outcome.reason) }
      case 'cancelled':
        return { ...record, sealZoomRead: unanswered('cancelled') }
      default:
        return { ...record, sealZoomRead: unanswered('failed') }
    }
  },
}
