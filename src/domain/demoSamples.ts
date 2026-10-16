import aphuPhoto from '../../samples/rear-door-aphu-45g1.jpg'
import sidePhoto from '../../samples/side-dented-grey.jpg'
import chsuPhoto from '../../samples/rear-door-chsu-22g1.jpg'
import { SHIPPED_RECORDINGS } from '../fixtures/demoRecordings'
import { replayRecording } from '../plan/replay'
import type { PlanRecording } from '../plan/recording'
import { ManifestRetryError, needsManifest } from './manifest'
import type { ContainerIdReading, InspectionRecord, ProviderId } from './inspection'

/**
 * Demo mode's sample picker (spec #16, spec 13; spec #27, ticket #37): the bundled containers, each
 * replaying the recording of that photo and no other. A recording is what a model really answered on the
 * sample's own photo (src/plan/recording.ts, src/fixtures/demoRecordings.ts), replayed through the same
 * answer mappers a live run uses. Nothing here makes a network call or needs a key, and nothing here is
 * hand-written: a sample whose photo has no recording yet is not offered (see pendingDemoRecordings).
 */
export type DemoSampleId = 'rear-aphu' | 'side-dented' | 'rear-chsu'

/** The models the demo is recorded on, in the order a sample prefers them. */
const LUNA = { provider: 'luna', model: 'gpt-6-luna' } as const
const JEV = { provider: 'openrouter', model: '~typesafe/jev-latest' } as const
type DemoRoute = { provider: ProviderId; model: string }

export interface DemoSample {
  id: DemoSampleId
  /** Tile title: what the photo shows. */
  title: string
  /** One line on the photo, not on what a result will show. */
  hint: string
  photo: { name: string; url: string; orientation: 'landscape' | 'portrait' | 'square' }
  /** Who answered the recording this sample replays. */
  provider: ProviderId
  model: string
}

/** A sample's photo and which recordings of it may be replayed. */
interface SampleDefinition {
  id: DemoSampleId
  title: string
  hint: string
  photo: DemoSample['photo']
  /** The photo as the recordings name it. */
  photoPath: string
  /** The routes it may replay, preferred first. */
  routes: readonly DemoRoute[]
}

const DEFINITIONS: readonly SampleDefinition[] = [
  {
    id: 'rear-aphu',
    title: 'Rear doors with markings',
    hint: 'A clear door end with the ID and door plate printed',
    photo: { name: 'rear-door-aphu-45g1.jpg', url: aphuPhoto, orientation: 'landscape' },
    photoPath: 'samples/rear-door-aphu-45g1.jpg',
    routes: [LUNA, JEV],
  },
  {
    id: 'side-dented',
    title: 'Damaged grey side',
    hint: 'Dents in the side panel; no ID in view',
    photo: { name: 'side-dented-grey.jpg', url: sidePhoto, orientation: 'landscape' },
    photoPath: 'samples/side-dented-grey.jpg',
    routes: [LUNA, JEV],
  },
  {
    id: 'rear-chsu',
    title: 'Clean grey rear doors',
    hint: 'Grey doors; some ID digits are hard to read',
    photo: { name: 'rear-door-chsu-22g1.jpg', url: chsuPhoto, orientation: 'landscape' },
    photoPath: 'samples/rear-door-chsu-22g1.jpg',
    routes: [JEV, LUNA],
  },
]

/** Recordings added by a test (see registerDemoRecording); the shipped ones are always there. */
const registered: PlanRecording[] = []

/** Test seam: makes a recording available to the demo, as if it were shipped. Returns its removal. */
export function registerDemoRecording(recording: PlanRecording): () => void {
  registered.push(recording)
  return () => {
    const at = registered.indexOf(recording)
    if (at >= 0) registered.splice(at, 1)
  }
}

const sameRoute = (a: DemoRoute, b: DemoRoute) => a.provider === b.provider && a.model === b.model
const askedWholePlan = (r: PlanRecording) => !r.entries.some((e) => e.asked === 'id-only')

/**
 * The recording a sample replays: of its own photo only, on one of its routes. One that asked the whole
 * plan beats one that asked only the ID; then the sample's preferred route; then the newest.
 */
function recordingOf(definition: SampleDefinition): PlanRecording | null {
  const candidates = [...SHIPPED_RECORDINGS, ...registered]
    .filter((r) => r.photo === definition.photoPath)
    .filter((r) => definition.routes.some((route) => sameRoute(route, r)))
  candidates.sort(
    (a, b) =>
      Number(askedWholePlan(b)) - Number(askedWholePlan(a)) ||
      definition.routes.findIndex((r) => sameRoute(r, a)) -
        definition.routes.findIndex((r) => sameRoute(r, b)) ||
      b.recordedAt.localeCompare(a.recordedAt),
  )
  return candidates[0] ?? null
}

function sampleOf(definition: SampleDefinition, recording: PlanRecording): DemoSample {
  return {
    id: definition.id,
    title: definition.title,
    hint: definition.hint,
    photo: definition.photo,
    provider: recording.provider,
    model: recording.model,
  }
}

/** The samples that have a recording, in picker order. */
export function demoSamples(): readonly DemoSample[] {
  return DEFINITIONS.flatMap((definition) => {
    const recording = recordingOf(definition)
    return recording ? [sampleOf(definition, recording)] : []
  })
}

function definitionOf(id: DemoSampleId): SampleDefinition {
  const definition = DEFINITIONS.find((d) => d.id === id)
  if (!definition) throw new Error(`No demo sample ${id}`)
  return definition
}

/** A sample offered by the picker. Throws for one with no recording. */
export function findSample(id: DemoSampleId): DemoSample {
  const definition = definitionOf(id)
  const recording = recordingOf(definition)
  if (!recording) throw new Error(`No recording for demo sample ${id}`)
  return sampleOf(definition, recording)
}

/** A recording still to be made: a sample's photo on one of the demo's models. */
export interface PendingRecording {
  sample: DemoSampleId
  photo: string
  route: DemoRoute
  /** What the demo has for this slot today: nothing, or a run that asked only the container ID. */
  covers: 'nothing' | 'id-only'
}

/**
 * Every slot the demo still needs a full-plan recording for, so nothing waits unseen: a sample on a route
 * with no recording of the whole plan. Record them with the opt-in spec (docs/research/live-api-findings-2026-10-16.md, last section).
 */
export function pendingDemoRecordings(): PendingRecording[] {
  const all = [...SHIPPED_RECORDINGS, ...registered]
  return DEFINITIONS.flatMap((definition) =>
    definition.routes.flatMap((route) => {
      const own = all.filter((r) => r.photo === definition.photoPath && sameRoute(route, r))
      if (own.some(askedWholePlan)) return []
      return [
        {
          sample: definition.id,
          photo: definition.photoPath,
          route: { ...route },
          covers: own.length > 0 ? ('id-only' as const) : ('nothing' as const),
        },
      ]
    }),
  )
}

async function pause(delayMs: number | undefined) {
  if (delayMs && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
}

let counter = 0

/** Replays a sample's recording against its own photo. */
export async function runDemoSample(
  id: DemoSampleId,
  options: { delayMs?: number } = {},
): Promise<InspectionRecord> {
  const sample = findSample(id)
  const recording = recordingOf(definitionOf(id))!
  await pause(options.delayMs)
  counter += 1
  return replayRecording(recording, {
    id: `demo-${id}-${counter}`,
    photo: { name: sample.photo.name, orientation: sample.photo.orientation },
  })
}

/**
 * A provider failure for the manifest check, played when a test or the sample option asks for one. Nothing
 * was recorded for it: it is the wording each route's errors use, so the failure path can be seen.
 */
const SIMULATED_FAILURE: Record<ProviderId, string> = {
  luna: 'Rate limit reached for requests. Please try again in 20s.',
  openrouter: 'Service is busy. Please try again in 20s.',
}

/**
 * Replays a sample's manifest check (spec 3.2): no network, no key, no ledger entry. The manifest check
 * itself was not recorded; what the recording read of the ID is compared with the pasted entries. Resolves
 * with the reading when an entry is what the recording read, null when no entry matches what the photo
 * shows (spec 12: never substitute a near-match), and always null where the recording left a position
 * of the ID unread. Rejects with a simulated provider failure when `fail` is set.
 */
export async function runDemoManifestRetry(
  id: DemoSampleId,
  entries: string[],
  options: { delayMs?: number; fail?: boolean } = {},
): Promise<ContainerIdReading | null> {
  const recording = recordingOf(definitionOf(id))
  if (!recording) throw new Error(`No recording for demo sample ${id}`)
  await pause(options.delayMs)
  if (options.fail) throw new ManifestRetryError(SIMULATED_FAILURE[recording.provider])
  const reading = replayRecording(recording, { id: `demo-${id}-check`, photo: null }).containerId
  // A reading with a position unread cannot equal any entry: nothing the photo showed matches.
  if (!reading || needsManifest(reading)) return null
  const matched = entries.some((entry) => entry.replace(/\s+/g, '').toUpperCase() === reading.value)
  return { ...reading, provenance: matched ? 'manifest' : 'printed', manifestChecked: true }
}
