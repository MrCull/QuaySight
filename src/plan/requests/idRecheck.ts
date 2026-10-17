import { assembleLunaReading, lunaMappingOf } from '../../domain/luna'
import { lunaIdQuestionSet } from '../../domain/idQuestions'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { questionSetOf } from '../../domain/providers'
import {
  mergeRecheck,
  observationsOf,
  RECHECK_PURPOSE,
  recheckOutcome,
  recheckRecord,
  unresolvedPositions,
} from '../../domain/recheck'
import type { ContainerIdReading, RecheckRecord } from '../../domain/inspection'
import type { ChoiceReading } from '../../domain/luna'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest, PlanView } from '../requestPlan'
import { survey } from './survey'

/** The re-check's answer: the asked positions as read again. */
export interface IdAnswer {
  containerId: ContainerIdReading
  readings: ChoiceReading[]
}

/** The positions the whole-photo reading left unread. */
function askedOf(plan: PlanView): number[] {
  return unresolvedPositions(plan.answer(survey)?.readings ?? [])
}

/** The Luna ID set for just these positions, on whichever route the run is on. */
function recheckAsk(positions: number[]) {
  return questionSetAsk(lunaIdQuestionSet(positions), (reply) => {
    const { containerId, readings } = lunaMappingOf(reply, positions)
    return { containerId, readings }
  })
}

/**
 * Luna's re-check (ticket #14): once the survey's whole-photo reading answers with unread positions, those
 * positions alone are asked again, once, on the same route and model. It only fills unread positions;
 * its failure keeps the first reading, which is already usable.
 */
export const idRecheck: PlanRequest<IdAnswer> = {
  id: 'recheck',
  purpose: RECHECK_PURPOSE,
  stages: ['id'],
  after: [survey],
  optional: true,
  appliesTo: (route) => questionSetOf(route.entry) === 'luna',
  needed: (plan) => askedOf(plan).length > 0,
  send: (ctx) => askDecisions(ctx, recheckAsk(askedOf(ctx))),
  replay(raw, plan) {
    return recheckAsk(askedOf(plan)).map(raw, plan.route)
  },
  apply(record, outcome, plan) {
    const first = plan.answer(survey)
    const asked = askedOf(plan)
    if (!first) return record
    const base = {
      id: `${record.id}-recheck`,
      provider: plan.route.provider,
      model: plan.route.model,
      asked,
    }
    const unanswered = (
      outcome: RecheckRecord['outcome'],
      reason?: RecheckRecord['reason'],
    ): RecheckRecord =>
      recheckRecord({
        ...base,
        resolvedVersion: null,
        outcome,
        resolved: [],
        observations: [],
        reason,
      })

    switch (outcome.status) {
      case 'answered': {
        const again = outcome.answer.readings
        const merged = mergeRecheck(first.readings, again, asked)
        return {
          ...record,
          containerId: assembleLunaReading(merged.readings, first.ownerPick),
          rechecks: [
            recheckRecord({
              ...base,
              resolvedVersion: outcome.resolvedModel,
              outcome: recheckOutcome(asked, merged.resolved),
              resolved: merged.resolved,
              observations: observationsOf(again, asked),
            }),
          ],
        }
      }
      case 'blocked':
        return { ...record, rechecks: [unanswered('skipped-cap', outcome.reason)] }
      case 'cancelled':
        return { ...record, rechecks: [unanswered('cancelled')] }
      default:
        return { ...record, rechecks: [unanswered('failed')] }
    }
  },
}
