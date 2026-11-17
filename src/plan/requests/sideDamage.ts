import { SIDE_DAMAGE_REQUEST } from '../../domain/damageFamilies'
import { withDamageReading, type DamageSetReading } from '../../domain/damageSets'
import { damageSetAsk } from '../../domain/damageSetAsk'
import { readSideDamage, SIDE_DAMAGE_SET } from '../../domain/sideDamage'
import { splitQuestionSet, type SharedAnswer } from '../../domain/questionSet'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest, RunRoute } from '../requestPlan'

/**
 * Long-side damage (B, ticket #33): the side set, sent with the survey and in the route's own wire
 * format. Its questions are the side damage family's (domain/damageFamilies.ts, from the registry). Its
 * reading is folded in beside any other damage set's; the face the survey detects chooses which one the
 * record shows (domain/damageSets.ts).
 */
const ASK = damageSetAsk(SIDE_DAMAGE_REQUEST, 'sideDamage')

/** The side set cut to the route's question limit: one part unless the model's own limit is below its size. */
function partsOn(route: RunRoute) {
  const wire =
    route.entry.wireFormat === 'openai-decisions' ? 'openai-decisions' : 'openrouter-decisions'
  return splitQuestionSet(SIDE_DAMAGE_SET, wire, route.entry.maxQuestions)
}

const whole = (route: RunRoute) => partsOn(route).length === 1

export const sideDamage: PlanRequest<DamageSetReading> = {
  id: SIDE_DAMAGE_REQUEST,
  purpose: 'Checking the long side for damage',
  stages: ['damage'],
  appliesTo: whole,
  send: (ctx) => askDecisions(ctx, ASK),
  replay: (raw, plan) => ASK.map(raw, plan.route),
  apply: (record, outcome) =>
    outcome.status === 'answered' ? ASK.apply(record, outcome.answer) : record,
}

// A model that takes fewer questions in one request than the side set holds (Liquid d1.2-ultra takes 128;
// the set has 132) is asked it in two requests with the same photo and instructions, each half of the
// questions. The second starts when the first has settled and folds both halves' answers into the one
// reading, so the record never shows half a damage check. If one half failed, the other's answers still
// stand and the failed half's questions stay unread (never "no damage").

type Answers = Record<string, SharedAnswer>

const half = (index: number) => (route: RunRoute) =>
  questionSetAsk(partsOn(route)[index]!, (reply): Answers => reply.answers)
const firstHalf = half(0)
const secondHalf = half(1)

export const sideDamageFirstHalf: PlanRequest<Answers> = {
  id: `${SIDE_DAMAGE_REQUEST}-a`,
  purpose: 'Checking the long side for damage',
  stages: ['damage'],
  appliesTo: (route) => partsOn(route).length === 2,
  send: (ctx) => askDecisions(ctx, firstHalf(ctx.route)),
  replay: (raw, plan) => firstHalf(plan.route).map(raw, plan.route),
  // Folded in with the second half, which always settles after it.
  apply: (record) => record,
}

export const sideDamageSecondHalf: PlanRequest<Answers> = {
  id: `${SIDE_DAMAGE_REQUEST}-b`,
  purpose: 'Checking the long side for damage',
  stages: ['damage'],
  appliesTo: (route) => partsOn(route).length === 2,
  settledAfter: [sideDamageFirstHalf],
  send: (ctx) => askDecisions(ctx, secondHalf(ctx.route)),
  replay: (raw, plan) => secondHalf(plan.route).map(raw, plan.route),
  apply(record, outcome, plan) {
    const first = plan.answer(sideDamageFirstHalf)
    const second = outcome.status === 'answered' ? outcome.answer : undefined
    if (!first && !second) return record
    const reading = readSideDamage({ ...first, ...second })
    return withDamageReading(record, { ...reading, passId: `${record.id}-${SIDE_DAMAGE_REQUEST}` })
  },
}
