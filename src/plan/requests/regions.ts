import { readRegions, regionsQuestionSet, type RegionsReading } from '../../domain/regionMarks'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { askDecisions } from '../../services/askDecisions'
import { markPhoto } from '../../services/scalePhoto'
import type { PlanRequest } from '../requestPlan'

const REGIONS_ASK = questionSetAsk(regionsQuestionSet(), ({ answers }) => readRegions(answers))

/**
 * Numbered regions (ticket #84): one request per photo, on every route. A copy of the prepared photo is
 * drawn with numbered, overlapping regions and the model names the mark or marks that hold the ID, the
 * seal, the weights panel, the ISO code and each hazard sticker. It asks for no coordinates. It starts
 * with the survey, not after it; the zoomed reads that follow cut from the area it names. A refinement:
 * its failure leaves the whole-photo readings as they are.
 */
export const regions: PlanRequest<RegionsReading> = {
  id: 'regions',
  purpose: 'Locating the markings',
  stages: ['id'],
  optional: true,
  async send(ctx) {
    const marked = await markPhoto(ctx.photo)
    return askDecisions({ ...ctx, photo: marked }, REGIONS_ASK)
  },
  replay: (raw, plan) => REGIONS_ASK.map(raw, plan.route),
  apply(record, outcome) {
    switch (outcome.status) {
      case 'answered':
        return {
          ...record,
          regions: {
            outcome: 'located',
            found: outcome.answer,
            resolvedVersion: outcome.resolvedModel,
          },
        }
      case 'blocked':
        return {
          ...record,
          regions: { outcome: 'skipped-cap', found: null, resolvedVersion: null },
        }
      case 'cancelled':
        return { ...record, regions: { outcome: 'cancelled', found: null, resolvedVersion: null } }
      default:
        return { ...record, regions: { outcome: 'failed', found: null, resolvedVersion: null } }
    }
  },
}
