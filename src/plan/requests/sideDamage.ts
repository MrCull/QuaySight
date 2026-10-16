import { withDamageReading, type DamageSetReading } from '../../domain/damageSets'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { SIDE_DAMAGE_SET, readSideDamage } from '../../domain/sideDamage'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest } from '../requestPlan'

/**
 * Long-side damage (B, ticket #33): the side set, sent with the survey and in the route's own wire
 * format. Its reading is folded in beside any other damage set's; the face the survey detects chooses
 * which one the record shows (domain/damageSets.ts).
 */
export const sideDamage: PlanRequest<DamageSetReading> = {
  id: 'side-damage',
  purpose: 'Checking the long side for damage',
  stages: ['damage'],
  send: (ctx) =>
    askDecisions(
      ctx,
      questionSetAsk(SIDE_DAMAGE_SET, (reply) => readSideDamage(reply.answers)),
    ),
  apply: (record, outcome) =>
    outcome.status === 'answered'
      ? withDamageReading(record, { ...outcome.answer, passId: `${record.id}-${sideDamage.id}` })
      : record,
}
