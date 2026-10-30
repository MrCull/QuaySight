import { questionSet } from '../../domain/questionSet'
import { questionSetAsk } from '../../domain/questionSetAsk'
import type { SealReading } from '../../domain/sealFamily'
import {
  applySealPick,
  joinCandidates,
  readSealPick,
  sealPickQuestion,
  SEAL_PICK_INSTRUCTIONS,
  type SealPick,
} from '../../domain/sealPick'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest, PlanView } from '../requestPlan'
import { sealZoom } from './sealZoom'
import { survey } from './survey'

/** What the seal pick did, for the export. Never shown. */
export interface SealPickRecord {
  outcome: 'picked' | 'none-of-these' | 'failed' | 'cancelled' | 'skipped-cap'
  /** How many numbers were offered. */
  offered: number
  resolvedVersion: string | null
  reason: 'requests' | 'spend' | null
}

declare module '../../domain/inspection' {
  interface InspectionRecord {
    /** The seal pick, when one was started. Absent on other runs. */
    sealPick?: SealPickRecord
  }
}

const seen = (s: SealReading | null | undefined): s is SealReading => Boolean(s?.visible)

/** The numbers to offer: the survey's read first, then the zoomed read's, when it gave one. */
function candidatesOf(plan: PlanView): string[] {
  const read = plan.answer(survey)?.findings.seal
  if (!seen(read)) return []
  const zoomed = plan.answer(sealZoom)?.seal
  return joinCandidates(read.candidates ?? [], (seen(zoomed) && zoomed.candidates) || [])
}

function pickAsk(candidates: string[]) {
  return questionSetAsk(
    questionSet(SEAL_PICK_INSTRUCTIONS, [sealPickQuestion(candidates)]),
    ({ answers }) => readSealPick(answers, candidates),
  )
}

/**
 * The seal pick (src/domain/sealPick.ts): once the seal has been read, and read up close when the regions
 * found it, the whole photo is asked which of the numbers those reads make plausible is the one printed
 * on the seal. A refinement: its failure keeps the reading as it stands.
 */
export const sealPick: PlanRequest<SealPick> = {
  id: 'seal-pick',
  purpose: 'Checking the seal number',
  stages: ['details'],
  after: [survey],
  settledAfter: [sealZoom],
  optional: true,
  needed: (plan) => candidatesOf(plan).length > 0,
  send: (ctx) => askDecisions(ctx, pickAsk(candidatesOf(ctx))),
  replay: (raw, plan) => pickAsk(candidatesOf(plan)).map(raw, plan.route),
  apply(record, outcome, plan) {
    const offered = candidatesOf(plan).length
    const unanswered = (
      kind: SealPickRecord['outcome'],
      reason: SealPickRecord['reason'] = null,
    ): SealPickRecord => ({ outcome: kind, offered, resolvedVersion: null, reason })

    switch (outcome.status) {
      case 'answered': {
        const pick = outcome.answer
        return {
          ...record,
          ...(record.seal ? { seal: applySealPick(record.seal, pick) } : {}),
          sealPick: {
            outcome: pick.value === null ? 'none-of-these' : 'picked',
            offered,
            resolvedVersion: outcome.resolvedModel,
            reason: null,
          },
        }
      }
      case 'blocked':
        return { ...record, sealPick: unanswered('skipped-cap', outcome.reason) }
      case 'cancelled':
        return { ...record, sealPick: unanswered('cancelled') }
      default:
        return { ...record, sealPick: unanswered('failed') }
    }
  },
}
