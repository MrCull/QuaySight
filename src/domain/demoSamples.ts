import aphuPhoto from '../../samples/rear-door-aphu-45g1.jpg'
import sidePhoto from '../../samples/side-dented-grey.jpg'
import chsuPhoto from '../../samples/rear-door-chsu-22g1.jpg'
import jevSmoke from '../fixtures/live/openrouter-jev-smoke.json'
import { recordedFixtures } from '../fixtures/recorded'
import { recordedSideDamage } from '../fixtures/recordedDamage'
import { buildContainerIdReading } from './containerId'
import { decodeSizeCode } from './isoSizeCode'
import { ManifestRetryError } from './manifest'
import { mapOpenRouterJevResponse } from './openrouter'
import { checkWeights } from './weights'
import {
  INSPECTION_SCHEMA_VERSION,
  type ContainerIdReading,
  type InspectionRecord,
  type ProviderId,
} from './inspection'

/**
 * Demo mode's sample picker (spec #16, spec 13): the three bundled containers, each with the result
 * recorded for that photo and no other. Nothing here makes a network call or needs a key.
 */
export type DemoSampleId = 'rear-aphu' | 'side-dented' | 'rear-chsu'

export interface DemoSample {
  id: DemoSampleId
  /** Tile title: what the photo shows. */
  title: string
  /** One line on what the audience will see. */
  hint: string
  photo: { name: string; url: string; orientation: 'landscape' | 'portrait' | 'square' }
  /** Who answered when this result was recorded. */
  provider: ProviderId
  model: string
}

/** What one sample replays: the reading and findings recorded from its own photo. */
interface SampleRecording {
  resolvedVersion: string
  containerId: ContainerIdReading | null
  sizeCode: InspectionRecord['sizeCode']
  weights: InspectionRecord['weights']
  damage: InspectionRecord['damage']
  /** Saved body kept in the record's raw responses and the JSON export. */
  body: unknown
  /** Provider message replayed when the presenter makes the manifest check fail. */
  retryFailureMessage: string
}

const luna = recordedFixtures.luna

export const DEMO_SAMPLES: readonly DemoSample[] = [
  {
    id: 'rear-aphu',
    title: 'Rear doors with markings',
    hint: 'ID, size code and weights read from the door',
    photo: { name: 'rear-door-aphu-45g1.jpg', url: aphuPhoto, orientation: 'landscape' },
    provider: 'luna',
    model: luna.model,
  },
  {
    id: 'side-dented',
    title: 'Damaged grey side',
    hint: 'Dents in the side panel; no ID in view',
    photo: { name: 'side-dented-grey.jpg', url: sidePhoto, orientation: 'landscape' },
    provider: 'luna',
    model: luna.model,
  },
  {
    id: 'rear-chsu',
    title: 'Clean grey rear doors',
    hint: 'Some ID digits hard to read, with alternatives',
    photo: { name: 'rear-door-chsu-22g1.jpg', url: chsuPhoto, orientation: 'landscape' },
    provider: 'openrouter',
    model: jevSmoke.requestedModel,
  },
]

export function findSample(id: DemoSampleId): DemoSample {
  const sample = DEMO_SAMPLES.find((s) => s.id === id)
  if (!sample) throw new Error(`No demo sample ${id}`)
  return sample
}

function recordingFor(id: DemoSampleId): SampleRecording {
  switch (id) {
    // The fuller Luna reading of the APHU rear door. Its side damage belongs to the side photo, so none here.
    case 'rear-aphu': {
      const body = {
        ...structuredClone(luna),
        damage: null,
        photo: 'samples/rear-door-aphu-45g1.jpg',
      }
      return {
        resolvedVersion: luna.model,
        containerId: buildContainerIdReading({
          printed: `${luna.containerNumber}${luna.observedCheckDigit ?? ''}`,
          certainty: luna.certainty,
        }),
        sizeCode: decodeSizeCode(luna.sizeCode, luna.detailCertainty),
        weights: checkWeights({
          maxGrossKg: luna.maxGrossKg,
          tareKg: luna.tareKg,
          printedNetKg: luna.printedNetKg,
          certainty: luna.detailCertainty,
        }),
        damage: null,
        body,
        retryFailureMessage: luna.retryFailureMessage,
      }
    }
    // The side photo shows no readable ID (a narrow vertical strip at the far end), so the manifest offer opens.
    case 'side-dented':
      return {
        resolvedVersion: luna.model,
        containerId: null,
        sizeCode: null,
        weights: null,
        damage: structuredClone(recordedSideDamage),
        body: {
          provider: 'luna',
          model: luna.model,
          photo: 'samples/side-dented-grey.jpg',
          containerNumber: null,
          damage: structuredClone(recordedSideDamage),
        },
        retryFailureMessage: luna.retryFailureMessage,
      }
    // The real Jev latest response through OpenRouter for this photo (live smoke, 16 Oct 2026).
    case 'rear-chsu': {
      const mapped = mapOpenRouterJevResponse(jevSmoke.response, jevSmoke.requestedModel)
      return {
        resolvedVersion: mapped.resolvedModel,
        containerId: mapped.containerId,
        sizeCode: null,
        weights: null,
        damage: null,
        body: structuredClone(jevSmoke.response),
        retryFailureMessage: recordedFixtures.openrouter.retryFailureMessage,
      }
    }
  }
}

async function pause(delayMs: number | undefined) {
  if (delayMs && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
}

let counter = 0

/** Replays a sample's recorded result against its own photo. */
export async function runDemoSample(
  id: DemoSampleId,
  options: { delayMs?: number } = {},
): Promise<InspectionRecord> {
  const sample = findSample(id)
  const recording = recordingFor(id)
  await pause(options.delayMs)
  counter += 1
  const recordId = `demo-${id}-${counter}`
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id: recordId,
    provider: sample.provider,
    model: sample.model,
    resolvedVersion: recording.resolvedVersion,
    rawResponses: [
      {
        passId: recordId,
        provider: sample.provider,
        model: sample.model,
        capturedFrom: 'recorded-fixture',
        body: recording.body,
      },
    ],
    source: 'recorded',
    status: 'complete',
    photo: { name: sample.photo.name, orientation: sample.photo.orientation },
    containerId: recording.containerId,
    sizeCode: recording.sizeCode,
    weights: recording.weights,
    damage: recording.damage,
  }
}

/**
 * Replays a sample's recorded manifest check (spec 3.2): no network, no key, no ledger entry.
 * Resolves with the replacement reading, or null when no manifest entry matched what the photo shows
 * (the model's "not listed" answer; spec 12: never substitute a near-match). Rejects with the
 * recorded provider failure when `fail` is set.
 */
export async function runDemoManifestRetry(
  id: DemoSampleId,
  entries: string[],
  options: { delayMs?: number; fail?: boolean } = {},
): Promise<ContainerIdReading | null> {
  const recording = recordingFor(id)
  await pause(options.delayMs)
  if (options.fail) throw new ManifestRetryError(recording.retryFailureMessage)
  const reading = recording.containerId
  if (!reading) return null
  const matched = entries.some((entry) => entry.replace(/\s+/g, '').toUpperCase() === reading.value)
  return { ...reading, provenance: matched ? 'manifest' : 'printed', manifestChecked: true }
}
