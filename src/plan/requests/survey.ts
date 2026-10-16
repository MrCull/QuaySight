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

/**
 * The survey (spec #27, A): one request that reads the container ID and the container details from the
 * whole photo, on the run's route. Its questions are the ID set plus every survey part
 * (src/domain/survey.ts); its answer lands the ID and each part's fields at once.
 */
export const survey: PlanRequest<SurveyAnswer> = {
  id: 'read',
  purpose: 'Reading markings',
  stages: ['id', 'details'],
  send: (ctx) => {
    const ask = surveyAskOf(ctx.route)
    return askDecisions(
      ctx,
      questionSetAsk(surveyQuestionSet(ask), (reply) => readSurvey(reply.answers, ask)),
    )
  },
  apply: (record, outcome) =>
    outcome.status === 'answered' ? applySurvey(record, outcome.answer) : record,
}
