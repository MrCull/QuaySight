import { describe, it, expect } from 'vitest'
import { spendCaps } from '../../domain/rates'
import { providers } from '../../domain/providers'
import { OPENROUTER_ENDPOINT_ID } from '../../domain/openrouter'
import { LUNA_ENDPOINT_ID } from '../../domain/luna'
import { planFor, type RunRoute } from '../requestPlan'
import { planRequests } from '../registry'

// The per-inspection request cap spans a whole run: every planned request, and the manifest check a
// presenter can still offer afterwards. A request added to the plan (the weights second look, ticket
// #34, among them) must leave room for that check on every route, or the cap would block it.
describe('the per-inspection request cap', () => {
  it('leaves room for every request the plan can make on any route, and the manifest check', () => {
    for (const provider of providers) {
      for (const entry of provider.models) {
        if (
          entry.wireFormat !== 'openai-decisions' &&
          entry.wireFormat !== 'openrouter-decisions'
        ) {
          continue
        }
        const route: RunRoute = {
          provider: provider.id,
          model: entry.id,
          entry,
          endpoint:
            entry.wireFormat === 'openrouter-decisions' ? OPENROUTER_ENDPOINT_ID : LUNA_ENDPOINT_ID,
          describe: { name: entry.id, maxSide: entry.photoLimits.maxSide },
        }
        const planned = planFor(planRequests(), route).length
        expect(planned + 1, `${provider.id} ${entry.id}`).toBeLessThanOrEqual(
          spendCaps.maxRequestsPerInspection,
        )
      }
    }
  })
})
