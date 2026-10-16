import { assembleLunaReading, mapLunaResponse } from '../../domain/luna'
import { mapOpenRouterLunaResponse } from '../../domain/openrouter'
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
import { callLuna } from '../../services/luna'
import { callOpenRouterLuna } from '../../services/openrouter'
import type { PlanRequest, PlanView, RequestContext, RequestReply } from '../requestPlan'
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

/** The Luna ID set for just these positions, on the run's route: OpenAI direct, or OpenRouter. */
async function readLuna(ctx: RequestContext, positions: number[]): Promise<RequestReply<IdAnswer>> {
  const { route, apiKey, photo, signal } = ctx
  const call =
    route.entry.wireFormat === 'openrouter-decisions'
      ? await callOpenRouterLuna({
          apiKey,
          photo,
          model: route.model,
          positions,
          describe: route.describe,
          signal,
        })
      : { ...(await callLuna({ apiKey, photo, positions, signal })), reportedCostUsd: null }
  return {
    answer: { containerId: call.containerId, readings: call.readings },
    resolvedModel: call.resolvedModel,
    usage: call.usage,
    latencyMs: call.latencyMs,
    reportedCostUsd: call.reportedCostUsd,
    raw: call.raw,
  }
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
  send: (ctx) => readLuna(ctx, askedOf(ctx)),
  replay(raw, plan) {
    const { route } = plan
    const asked = askedOf(plan)
    const mapped =
      route.entry.wireFormat === 'openrouter-decisions'
        ? mapOpenRouterLunaResponse(raw, route.model, asked)
        : mapLunaResponse(raw, route.model, asked)
    return { containerId: mapped.containerId, readings: mapped.readings }
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
