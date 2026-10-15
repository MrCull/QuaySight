import { recordedFixtures } from '../fixtures/recorded'
import { calculateCheckDigit, checkDigitMatches } from './iso6346'
import { INSPECTION_SCHEMA_VERSION, type InspectionRecord, type ProviderId } from './inspection'

/** 'unidentified' replays a sample whose container ID could not be read (opens the manifest retry). */
export type SampleScenario = 'identified' | 'unidentified'

export interface RecordedRunOptions {
  /** Pause before the record lands, so the arrival choreography can show. Tests pass 0. */
  delayMs?: number
  /** Stable id for the run. Defaults to a fresh id. */
  id?: string
  scenario?: SampleScenario
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
  const calculated = calculateCheckDigit(printed.slice(0, 10))
  const value =
    fixture.observedCheckDigit === null ? printed : `${printed}${fixture.observedCheckDigit}`

  counter += 1
  const unidentified = options.scenario === 'unidentified'
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id: options.id ?? `recorded-${providerId}-${counter}`,
    provider: providerId,
    model: fixture.model,
    source: 'recorded',
    status: 'complete',
    photo: null,
    containerId: unidentified
      ? null
      : {
          value,
          observedCheckDigit: fixture.observedCheckDigit,
          calculatedCheckDigit: calculated,
          checkDigitValid: checkDigitMatches(value),
          certainty: fixture.certainty,
          provenance: 'printed',
        },
  }
}
