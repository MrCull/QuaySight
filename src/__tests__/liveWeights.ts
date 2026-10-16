// Test support only: a live record whose survey read the weights, hand-written for the COYU 22G1 door
// (MAX GROSS 30,480 KG 67,200 LB, TARE 2,180 KG 4,810 LB, NET 28,300 KG 62,390 LB, CU. CAP. 33.2 M3
// 1,173 CU.FT.), and the figures a reading is made of.
import type { InspectionRecord } from '../domain/inspection'
import { evaluateWeights, type Figure, type WeightsReading } from '../domain/weights'
import { liveDetailsRecord } from './liveDetails'

export const read = (value: number, certainty: Figure['certainty'] = 'Likely'): Figure => ({
  state: 'read',
  value,
  certainty,
})
export const UNCLEAR: Figure = { state: 'unclear', value: null, certainty: "Can't tell" }
export const NOT_VISIBLE: Figure = { state: 'not-visible', value: null, certainty: 'Not seen' }

export function coyuReading(overrides: WeightsReading = {}): WeightsReading {
  return {
    maxGross: { metric: read(30480), imperial: read(67200) },
    tare: { metric: read(2180), imperial: read(4810) },
    payload: { metric: read(28300), imperial: read(62390) },
    capacity: { metric: read(33.2), imperial: read(1173) },
    ...overrides,
  }
}

/** A live record with the COYU details and these weights as the survey read them. */
export async function liveWeightsRecord(
  reading: WeightsReading = coyuReading(),
): Promise<InspectionRecord> {
  return { ...(await liveDetailsRecord()), weights: evaluateWeights(reading) }
}
