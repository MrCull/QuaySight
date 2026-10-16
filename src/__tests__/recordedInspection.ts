// Test support only: a complete recorded InspectionRecord for a provider, built from the recorded
// fixtures. The app replays recorded results through domain/demoSamples; nothing in src uses this.
import { recordedFixtures } from './handWrittenRecord'
import { buildContainerIdReading } from '../domain/containerId'
import { decodeSizeCode } from '../domain/isoSizeCode'
import {
  INSPECTION_SCHEMA_VERSION,
  type InspectionRecord,
  type ProviderId,
} from '../domain/inspection'
import { checkWeights } from '../domain/weights'

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
export async function recordedInspection(
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
  const id = options.id ?? `recorded-${providerId}-${counter}`
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id,
    provider: providerId,
    model: fixture.model,
    resolvedVersion: fixture.model,
    rawResponses: [
      {
        passId: id,
        provider: providerId,
        model: fixture.model,
        capturedFrom: 'recorded-fixture',
        body: structuredClone(fixture),
      },
    ],
    source: 'recorded',
    status: 'complete',
    photo: null,
    containerId:
      options.scenario === 'unidentified'
        ? null
        : buildContainerIdReading({
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
    damage: fixture.damage,
  }
}
