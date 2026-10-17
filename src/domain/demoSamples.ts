import aphuPhoto from '../../samples/rear-door-aphu-45g1.jpg'
import sidePhoto from '../../samples/side-dented-grey.jpg'
import chsuPhoto from '../../samples/rear-door-chsu-22g1.jpg'
import coyuPhoto from '../../samples/rear-door-coyu-22g1.jpg'
import coyuSealPhoto from '../../samples/seal-closeup-coyu-0154620.jpg'
import jdlu1Photo from '../../samples/jdlu-200690-1-rear-doors.jpg'
import jdlu2Photo from '../../samples/jdlu-200690-2-corner-doors-left.jpg'
import jdlu3Photo from '../../samples/jdlu-200690-3-corner-doors-right.jpg'
import jdlu4Photo from '../../samples/jdlu-200690-4-long-side.jpg'
import { SHIPPED_RECORDINGS } from '../fixtures/demoRecordings'
import { combinePhotoRuns } from './combinePhotos'
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
export type DemoSampleId = 'rear-aphu' | 'side-dented' | 'rear-chsu' | 'coyu-seal' | 'jdlu-four'

/** The models the demo is recorded on, in the order a sample prefers them. */
const LUNA = { provider: 'luna', model: 'gpt-6-luna' } as const
const JEV = { provider: 'openrouter', model: '~typesafe/jev-latest' } as const
type DemoRoute = { provider: ProviderId; model: string }

export interface SamplePhoto {
  name: string
  url: string
  orientation: 'landscape' | 'portrait' | 'square'
}

export interface DemoSample {
  id: DemoSampleId
  /** Tile title: what the photo shows. */
  title: string
  /** One line on the photo, not on what a result will show. */
  hint: string
  photo: SamplePhoto
  /** Every photo of the sample in order, the first being `photo`. Several for a several-photo inspection. */
  photos: readonly SamplePhoto[]
  /** Who answered the recording this sample replays. */
  provider: ProviderId
  model: string
}

/** A sample's photo and which recordings of it may be replayed. */
interface SampleDefinition {
  id: DemoSampleId
  title: string
  hint: string
  photo: SamplePhoto
  /** The photo as the recordings name it. */
  photoPath: string
  /** The photos after the first, for a several-photo inspection, each with the path its recordings name. */
  more?: readonly { photo: SamplePhoto; photoPath: string }[]
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
  // The presenter's real containers (spec #75, ticket #73). Each photo is replayed from its own recording
  // and the photos are combined as a live run combines them. Jev first: on both containers its recording
  // reads the ID right today, which Luna's does not on COYU.
  {
    id: 'coyu-seal',
    title: 'Blue doors with a bolt seal',
    hint: 'Two photos of one container: the door end and a seal close-up',
    photo: { name: 'rear-door-coyu-22g1.jpg', url: coyuPhoto, orientation: 'square' },
    photoPath: 'samples/rear-door-coyu-22g1.jpg',
    more: [
      {
        photo: {
          name: 'seal-closeup-coyu-0154620.jpg',
          url: coyuSealPhoto,
          orientation: 'portrait',
        },
        photoPath: 'samples/seal-closeup-coyu-0154620.jpg',
      },
    ],
    routes: [JEV, LUNA],
  },
  {
    id: 'jdlu-four',
    title: 'Dusty blue container, four photos',
    hint: 'One container from the doors, both corners and the long side',
    photo: { name: 'jdlu-200690-1-rear-doors.jpg', url: jdlu1Photo, orientation: 'portrait' },
    photoPath: 'samples/jdlu-200690-1-rear-doors.jpg',
    more: [
      {
        photo: {
          name: 'jdlu-200690-2-corner-doors-left.jpg',
          url: jdlu2Photo,
          orientation: 'portrait',
        },
        photoPath: 'samples/jdlu-200690-2-corner-doors-left.jpg',
      },
      {
        photo: {
          name: 'jdlu-200690-3-corner-doors-right.jpg',
          url: jdlu3Photo,
          orientation: 'portrait',
        },
        photoPath: 'samples/jdlu-200690-3-corner-doors-right.jpg',
      },
      {
        photo: { name: 'jdlu-200690-4-long-side.jpg', url: jdlu4Photo, orientation: 'portrait' },
        photoPath: 'samples/jdlu-200690-4-long-side.jpg',
      },
    ],
    routes: [JEV, LUNA],
  },
]

/** A sample's photos with the path their recordings name, the first photo first. */
const photosOf = (definition: SampleDefinition) => [
  { photo: definition.photo, photoPath: definition.photoPath },
  ...(definition.more ?? []),
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
  return recordingsOf(definition)?.[0] ?? null
}

/**
 * The recording of each photo of the sample, in order, all on one route: the first route (in the sample's
 * preference) that has every photo, whole-plan recordings first. Null when no route has them all.
 */
function recordingsOf(definition: SampleDefinition): PlanRecording[] | null {
  const all = [...SHIPPED_RECORDINGS, ...registered]
  const photos = photosOf(definition)
  const first = all
    .filter((r) => r.photo === definition.photoPath)
    .filter((r) => definition.routes.some((route) => sameRoute(route, r)))
  first.sort(
    (a, b) =>
      Number(askedWholePlan(b)) - Number(askedWholePlan(a)) ||
      definition.routes.findIndex((r) => sameRoute(r, a)) -
        definition.routes.findIndex((r) => sameRoute(r, b)) ||
      b.recordedAt.localeCompare(a.recordedAt),
  )
  // A several-photo sample stays on one route: a candidate for the first photo that every other photo
  // has a recording for on the same route.
  for (const head of first) {
    const rest = photos
      .slice(1)
      .map(
        ({ photoPath }) =>
          all
            .filter((r) => r.photo === photoPath && sameRoute(head, r))
            .sort(
              (a, b) =>
                Number(askedWholePlan(b)) - Number(askedWholePlan(a)) ||
                b.recordedAt.localeCompare(a.recordedAt),
            )[0],
      )
    if (rest.every((r) => r !== undefined)) return [head, ...(rest as PlanRecording[])]
  }
  return null
}

function sampleOf(definition: SampleDefinition, recording: PlanRecording): DemoSample {
  return {
    id: definition.id,
    title: definition.title,
    hint: definition.hint,
    photo: definition.photo,
    photos: photosOf(definition).map((p) => p.photo),
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
      return photosOf(definition).flatMap(({ photoPath }) => {
        const own = all.filter((r) => r.photo === photoPath && sameRoute(route, r))
        if (own.some(askedWholePlan)) return []
        return [
          {
            sample: definition.id,
            photo: photoPath,
            route: { ...route },
            covers: own.length > 0 ? ('id-only' as const) : ('nothing' as const),
          },
        ]
      })
    }),
  )
}

async function pause(delayMs: number | undefined) {
  if (delayMs && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
}

let counter = 0

/** A sample's recordings replayed against its own photos: one photo's own record, or the photos combined. */
function replaySample(id: DemoSampleId, recordId: string): InspectionRecord {
  const sample = findSample(id)
  const recordings = recordingsOf(definitionOf(id))!
  if (recordings.length === 1) {
    return replayRecording(recordings[0]!, {
      id: recordId,
      photo: { name: sample.photo.name, orientation: sample.photo.orientation },
    })
  }
  // Several photos: each from its own recording, then combined as a live run combines them.
  return combinePhotoRuns(
    recordings.map((recording, n) => ({
      index: n + 1,
      name: sample.photos[n]!.name,
      record: replayRecording(recording, {
        id: `${recordId}-p${n + 1}`,
        photo: { name: sample.photos[n]!.name, orientation: sample.photos[n]!.orientation },
      }),
    })),
    { id: recordId },
  )
}

/** Replays a sample's recordings against its own photos. */
export async function runDemoSample(
  id: DemoSampleId,
  options: { delayMs?: number } = {},
): Promise<InspectionRecord> {
  findSample(id)
  await pause(options.delayMs)
  counter += 1
  return replaySample(id, `demo-${id}-${counter}`)
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
  const reading = replaySample(id, `demo-${id}-check`).containerId
  // A reading with a position unread cannot equal any entry: nothing the photo showed matches.
  if (!reading || needsManifest(reading)) return null
  const matched = entries.some((entry) => entry.replace(/\s+/g, '').toUpperCase() === reading.value)
  return { ...reading, provenance: matched ? 'manifest' : 'printed', manifestChecked: true }
}
