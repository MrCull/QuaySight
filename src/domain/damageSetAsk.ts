// A damage set's request, assembled from the registry (spec #51, ticket #59). Pure. The set is the
// request's families, joined when it is built, so a family registered later is asked too; the damage
// families ignore the route (their questions are authored as data), so the ask is the same on every one.
import type { DamageSetReading } from './damageSets'
import type { InspectionRecord } from './inspection'
import { applyFindings, readRequest, requestSet } from './questionRegistry'
import { questionSetAsk, type QuestionSetAsk } from './questionSetAsk'
import type { SurveyAsk, SurveyFindings } from './survey'

const NO_ROUTE_DEPENDENCE: SurveyAsk = { questionSet: 'luna', box: false }

export interface DamageSetAsk extends QuestionSetAsk<DamageSetReading> {
  /** Folds an answered reading into the record, as the family says. */
  apply(record: InspectionRecord, reading: DamageSetReading): InspectionRecord
}

export function damageSetAsk(request: string, key: 'sideDamage' | 'doorDamage'): DamageSetAsk {
  const ask = () =>
    questionSetAsk(
      requestSet(request, NO_ROUTE_DEPENDENCE),
      (reply) => readRequest(request, reply.answers, NO_ROUTE_DEPENDENCE)[key]!,
    )
  return {
    build: (input) => ask().build(input),
    map: (raw, route) => ask().map(raw, route),
    apply: (record, reading) =>
      applyFindings(record, { [key]: reading } as Partial<SurveyFindings>, {
        passId: `${record.id}-${request}`,
      }),
  }
}
