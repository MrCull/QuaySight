import { DOOR_DAMAGE_REQUEST } from '../../domain/damageFamilies'
import type { DamageSetReading } from '../../domain/damageSets'
import { damageSetAsk } from '../../domain/damageSetAsk'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest } from '../requestPlan'

/**
 * Door-end damage (ticket #35): the door set, sent with the survey and the side set in the route's own
 * wire format. Its questions are the door damage family's (domain/damageFamilies.ts, from the registry).
 * Its reading is folded in beside the side set's; the face the survey detects chooses which one the
 * record shows (domain/damageSets.ts).
 */
const ASK = damageSetAsk(DOOR_DAMAGE_REQUEST, 'doorDamage')

export const doorDamage: PlanRequest<DamageSetReading> = {
  id: DOOR_DAMAGE_REQUEST,
  purpose: 'Checking the door end for damage',
  stages: ['damage'],
  send: (ctx) => askDecisions(ctx, ASK),
  replay: (raw, plan) => ASK.map(raw, plan.route),
  apply: (record, outcome) =>
    outcome.status === 'answered' ? ASK.apply(record, outcome.answer) : record,
}
