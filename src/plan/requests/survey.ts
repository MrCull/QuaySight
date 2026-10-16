import { questionSetOf } from '../../domain/providers'
import { questionSetAsk } from '../../domain/questionSetAsk'
import {
  applySurvey,
  readSurvey,
  SURVEY_PARTS,
  surveyQuestionSet,
  type SurveyAnswer,
  type SurveyAsk,
  type SurveyPart,
} from '../../domain/survey'
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest, RunRoute } from '../requestPlan'

/** What the survey asks on this route: the maker's ID set, with the box where the catalogue allows it. */
export function surveyAskOf(route: RunRoute): SurveyAsk {
  return { questionSet: questionSetOf(route.entry), box: route.entry.box }
}

/** The survey's questions on a route, and how its reply is read. */
function surveyDecisions(ask: SurveyAsk, parts: readonly SurveyPart[] = SURVEY_PARTS) {
  return questionSetAsk(surveyQuestionSet(ask, parts), (reply) =>
    readSurvey(reply.answers, ask, parts),
  )
}

/**
 * The survey (spec #27, A): one request that reads the container ID and the container details from the
 * whole photo, on the run's route. Its questions are the ID set plus every survey part
 * (src/domain/survey.ts); its answer lands the ID and each part's fields at once.
 */
export const survey: PlanRequest<SurveyAnswer> = {
  id: 'read',
  purpose: 'Reading markings',
  stages: ['id', 'details'],
  send: (ctx) => askDecisions(ctx, surveyDecisions(surveyAskOf(ctx.route))),
  // A recording from before the survey existed asked only the ID: nothing else was asked, so nothing else is read.
  replay: (raw, plan, { asked }) =>
    surveyDecisions(surveyAskOf(plan.route), asked === 'id-only' ? [] : SURVEY_PARTS).map(
      raw,
      plan.route,
    ),
  apply: (record, outcome) =>
    outcome.status === 'answered' ? applySurvey(record, outcome.answer) : record,
}
