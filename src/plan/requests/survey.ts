import { questionFamilies } from '../../domain/questionRegistry'
import { questionSetOf } from '../../domain/providers'
import { questionSetAsk } from '../../domain/questionSetAsk'
import {
  applySurvey,
  readSurvey,
  surveyQuestionSet,
  type SurveyAnswer,
  type SurveyAsk,
} from '../../domain/survey'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest, RunRoute } from '../requestPlan'

/** What the survey asks on this route: the maker's ID set, with the box where the catalogue allows it. */
export function surveyAskOf(route: RunRoute): SurveyAsk {
  return { questionSet: questionSetOf(route.entry), box: route.entry.box }
}

/** The survey's questions on a route, and how its reply is read. Families default to the registry's. */
function surveyDecisions(ask: SurveyAsk, idOnly = false) {
  const families = idOnly ? questionFamilies().filter((f) => f.key === 'id') : undefined
  return questionSetAsk(surveyQuestionSet(ask, families), (reply) =>
    readSurvey(reply.answers, ask, families),
  )
}

/**
 * The survey (spec #27, A): one request that reads the container ID and the container details from the
 * whole photo, on the run's route. Its questions are the registry's survey families
 * (src/domain/questionRegistry.ts); its answer lands the ID and each family's fields at once.
 */
export const survey: PlanRequest<SurveyAnswer> = {
  id: 'read',
  purpose: 'Reading markings',
  stages: ['id', 'details'],
  send: (ctx) => askDecisions(ctx, surveyDecisions(surveyAskOf(ctx.route))),
  // A recording from before the survey existed asked only the ID: nothing else was asked, so nothing else is read.
  replay: (raw, plan, { asked }) =>
    surveyDecisions(surveyAskOf(plan.route), asked === 'id-only').map(raw, plan.route),
  apply: (record, outcome) =>
    outcome.status === 'answered' ? applySurvey(record, outcome.answer) : record,
}
