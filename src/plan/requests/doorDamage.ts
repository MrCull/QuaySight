import { withDamageReading, type DamageSetReading } from '../../domain/damageSets'
import { DOOR_DAMAGE_SET, readDoorDamage } from '../../domain/doorDamage'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest } from '../requestPlan'

/**
 * Door-end damage (ticket #35): the door set, sent with the survey and the side set in the route's own
 * wire format. Its reading is folded in beside the side set's; the face the survey detects chooses which
 * one the record shows (domain/damageSets.ts).
 */
const ASK = questionSetAsk(DOOR_DAMAGE_SET, (reply) => readDoorDamage(reply.answers))

export const doorDamage: PlanRequest<DamageSetReading> = {
  id: 'door-damage',
  purpose: 'Checking the door end for damage',
  stages: ['damage'],
  send: (ctx) => askDecisions(ctx, ASK),
  replay: (raw, plan) => ASK.map(raw, plan.route),
  apply: (record, outcome) =>
    outcome.status === 'answered'
      ? withDamageReading(record, { ...outcome.answer, passId: `${record.id}-${doorDamage.id}` })
      : record,
}
