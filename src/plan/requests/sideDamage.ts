import { SIDE_DAMAGE_REQUEST } from '../../domain/damageFamilies'
import type { DamageSetReading } from '../../domain/damageSets'
import { damageSetAsk } from '../../domain/damageSetAsk'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest } from '../requestPlan'

/**
 * Long-side damage (B, ticket #33): the side set, sent with the survey and in the route's own wire
 * format. Its questions are the side damage family's (domain/damageFamilies.ts, from the registry). Its
 * reading is folded in beside any other damage set's; the face the survey detects chooses which one the
 * record shows (domain/damageSets.ts).
 */
const ASK = damageSetAsk(SIDE_DAMAGE_REQUEST, 'sideDamage')

export const sideDamage: PlanRequest<DamageSetReading> = {
  id: SIDE_DAMAGE_REQUEST,
  purpose: 'Checking the long side for damage',
  stages: ['damage'],
  send: (ctx) => askDecisions(ctx, ASK),
  replay: (raw, plan) => ASK.map(raw, plan.route),
  apply: (record, outcome) =>
    outcome.status === 'answered' ? ASK.apply(record, outcome.answer) : record,
}
