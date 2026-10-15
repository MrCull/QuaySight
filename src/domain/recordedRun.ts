import { recordedFixtures } from '../fixtures/recorded'
import { buildContainerIdReading } from './containerId'
import { decodeSizeCode } from './isoSizeCode'
import { INSPECTION_SCHEMA_VERSION, type InspectionRecord, type ProviderId } from './inspection'
import { checkWeights } from './weights'

export interface RecordedRunOptions {
  /** Pause before the record lands, so the arrival choreography can show. Tests pass 0. */
  delayMs?: number
  /** Stable id for the run. Defaults to a fresh id. */
  id?: string
}

let counter = 0

/** Replays the recorded fixture for a provider through the shared inspection record. */
export async function runRecordedInspection(
  providerId: ProviderId,
  options: RecordedRunOptions = {},
): Promise<InspectionRecord> {
  const fixture = recordedFixtures[providerId]
  if (!fixture) throw new Error(`No recorded fixture for ${providerId}`)

  const delayMs = options.delayMs ?? 0
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))

  const printed = fixture.containerNumber.replace(/\s+/g, '').toUpperCase()
  const characters =
    fixture.observedCheckDigit === null ? printed : `${printed}${fixture.observedCheckDigit}`

  counter += 1
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id: options.id ?? `recorded-${providerId}-${counter}`,
    provider: providerId,
    model: fixture.model,
    source: 'recorded',
    status: 'complete',
    photo: null,
    containerId: buildContainerIdReading({
      printed: characters,
      certainty: fixture.certainty,
    }),
    sizeCode: decodeSizeCode(fixture.sizeCode, fixture.detailCertainty),
    weights: checkWeights({
      maxGrossKg: fixture.maxGrossKg,
      tareKg: fixture.tareKg,
      printedNetKg: fixture.printedNetKg,
      certainty: fixture.detailCertainty,
    }),
  }
}
