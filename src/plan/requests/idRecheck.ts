import { assembleLunaReading } from '../../domain/luna'
import { questionSetOf } from '../../domain/providers'
import {
  mergeRecheck,
  observationsOf,
  RECHECK_PURPOSE,
  recheckOutcome,
  recheckRecord,
  unresolvedPositions,
} from '../../domain/recheck'
import type { RecheckRecord } from '../../domain/inspection'
import type { PlanRequest, PlanView } from '../requestPlan'
import { readId, readLuna, type IdAnswer } from './readId'

/** The positions the whole-photo reading left unread. */
function askedOf(plan: PlanView): number[] {
  return unresolvedPositions(plan.answer(readId)?.readings ?? [])
}

/**
 * Luna's re-check (ticket #14): once the whole-photo reading answers with unread positions, those
 * positions alone are asked again, once, on the same route and model. It only fills unread positions;
 * its failure keeps the first reading, which is already usable.
 */
export const idRecheck: PlanRequest<IdAnswer> = {
  id: 'recheck',
  purpose: RECHECK_PURPOSE,
  stages: ['id'],
  after: [readId],
  optional: true,
  appliesTo: (route) => questionSetOf(route.entry) === 'luna',
  needed: (plan) => askedOf(plan).length > 0,
  send: (ctx) => readLuna(ctx, askedOf(ctx)),
  apply(record, outcome, plan) {
    const first = plan.answer(readId)
    const asked = askedOf(plan)
    if (!first?.readings) return record
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
        const again = outcome.answer.readings ?? []
        const merged = mergeRecheck(first.readings, again, asked)
        return {
          ...record,
          containerId: assembleLunaReading(merged.readings),
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
