// Test support only: a live record whose survey read the container details, hand-written for the 22G1
// COYU door photo: a general-purpose box, no special equipment, no markings, no DG placard.
import type { CheckReading, ContainerDetailsReading } from '../domain/containerDetails'
import type { InspectionRecord } from '../domain/inspection'
import { decodeSizeCode } from '../domain/isoSizeCode'
import { recordedInspection } from './recordedInspection'

const no = (certainty: CheckReading['certainty'] = 'Confident'): CheckReading => ({
  answer: 'no',
  certainty,
  source: 'observed',
  conflict: null,
})

export function coyuDetails(): ContainerDetailsReading {
  return {
    sizeCode: {
      state: 'read',
      code: '22G1',
      certainty: 'Confident',
      source: 'printed',
      alternative: null,
      decoded: decodeSizeCode('22G1', 'Confident'),
    },
    equipment: { reefer: no(), openTop: no(), tank: no(), flatRack: no() },
    markings: {
      superHeavy: no('Not seen'),
      highContainer: no('Not seen'),
      overwidth: no('Not seen'),
      fumigation: no('Not seen'),
      marinePollutant: no('Not seen'),
    },
    dgPlacard: { answer: 'none', dgClass: null, symbol: null, certainty: 'Not seen' },
  }
}

/** A live record with the COYU details and no weights (not asked yet). */
export async function liveDetailsRecord(): Promise<InspectionRecord> {
  const base = await recordedInspection('luna', { delayMs: 0 })
  const details = coyuDetails()
  return {
    ...base,
    source: 'live',
    sizeCode: details.sizeCode.decoded,
    weights: null,
    details,
  }
}
