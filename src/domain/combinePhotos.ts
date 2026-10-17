// One inspection record from the records of several photos of one container (spec #51, ticket #70). Pure.
//
// Each photo is read on its own (its own survey and requests, folded into its own record as they land).
// This builds the combined record the screen and the exports show: the container ID combined character by
// character, details and weights by the most certain reading after the agreement rule (combineReadings.ts),
// and a summary of each photo: its face, and which readings came from it. Length, seal and placards are combined in
// combineLengthSealPlacards.ts. Damage is not combined here: the record carries the first container photo's.
import {
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  type CheckReading,
  type ContainerDetailsReading,
  type DgPlacardReading,
  type SizeCodeReading,
} from './containerDetailTypes'
import { withCodeConflict } from './containerDetails'
import { agree, combineContainerIds, weakerOf, type Candidate } from './combineReadings'
import { combineLengthSealPlacards } from './combineLengthSealPlacards'
import { decodeSizeCode } from './isoSizeCode'
import type { CertaintyLabel, ContainerIdReading, InspectionRecord } from './inspection'
import type { FaceReading } from './photoFace'
import type { CapacityRow, WeightChecks, WeightRow } from './weights'

/** Which readings of the combined result came from one photo (1-based id positions; field names). */
export interface PhotoContribution {
  containerId: number[]
  details: string[]
  weights: string[]
}

/** One photo of the inspection, for the chips and the export. */
export interface PhotoSummary {
  /** 1-based, in the order the photos were given. */
  index: number
  name: string
  /** The face the survey says the photo shows; null when it gave none. */
  face: FaceReading | null
  /** Which long side, when the doors in the photo settled it. */
  side: 'left' | 'right' | null
  /** True when the photo does not show a container: nothing more was sent for it and nothing from it is used. */
  dropped: boolean
  /** The ID this photo gave on its own, as read. */
  containerId: ContainerIdReading | null
  contributed: PhotoContribution
  /** The raw responses (`rawResponses[].passId`) that came from this photo. */
  passIds: string[]
}

/** One photo's own record, as its requests have folded in so far. */
export interface PhotoRun {
  index: number
  name: string
  record: InspectionRecord
}

export function droppedPhotoMessage(index: number): string {
  return `Photo ${index} doesn't show a container`
}

export const DIFFERENT_CONTAINERS_MESSAGE = 'These photos may be of different containers'

const NO_CONTRIBUTION = (): PhotoContribution => ({ containerId: [], details: [], weights: [] })

const isDropped = (run: PhotoRun) => run.record.photoFace?.face === 'not-container'

function sideOf(record: InspectionRecord): 'left' | 'right' | null {
  const inference = record.damage?.sideInference
  return inference?.basis === 'inferred' ? inference.side : null
}

// ---------------------------------------------------------------------------------------------------
// Details

function candidatesOf<T>(
  runs: readonly { photo: number; value: T | null; certainty: CertaintyLabel }[],
): Candidate<T>[] {
  return runs.flatMap((r) => (r.value === null ? [] : [{ ...r, value: r.value }]))
}

/** One yes/no check across photos. `absence`: a "no" is only that the marking is not on that photo's face. */
function combineCheck(
  readings: { photo: number; reading: CheckReading }[],
  absence: boolean,
): { reading: CheckReading; from: number[] } {
  let candidates = candidatesOf(
    readings.map((r) => ({
      photo: r.photo,
      value: r.reading.answer,
      certainty: r.reading.certainty,
    })),
  )
  if (absence && candidates.some((c) => c.value === 'yes')) {
    candidates = candidates.filter((c) => c.value === 'yes')
  }
  const agreed = agree(candidates)
  if (!agreed) return { reading: readings[0]!.reading, from: [] }
  const source = readings.find(
    (r) => agreed.from.includes(r.photo) && r.reading.answer === agreed.value,
  )!
  const conflict = source.reading.conflict
  return {
    reading: {
      ...source.reading,
      answer: agreed.value,
      certainty: conflict ? weakerOf(agreed.certainty, 'Uncertain') : agreed.certainty,
    },
    from: agreed.from,
  }
}

function combineSizeCode(readings: { photo: number; reading: SizeCodeReading }[]): {
  reading: SizeCodeReading
  from: number[]
} {
  const read = readings.filter((r) => r.reading.state === 'read' && r.reading.code !== null)
  const agreed = agree(
    read.map((r) => ({ photo: r.photo, value: r.reading.code!, certainty: r.reading.certainty })),
  )
  if (!agreed) {
    // Nothing read: the photo that says most (a printed code that cannot be read beats not visible).
    const order = ['other', 'unreadable', 'unclear', 'not-visible']
    const best = [...readings].sort(
      (a, b) => order.indexOf(a.reading.state) - order.indexOf(b.reading.state),
    )[0]!
    return { reading: best.reading, from: [] }
  }
  const source = read.find((r) => r.reading.code === agreed.value)!.reading
  return {
    reading: {
      ...source,
      code: agreed.value,
      certainty: agreed.certainty,
      alternative: agreed.alternative ?? source.alternative,
      decoded: decodeSizeCode(agreed.value, agreed.certainty),
    },
    from: agreed.from,
  }
}

function combineDgPlacard(readings: { photo: number; reading: DgPlacardReading }[]): {
  reading: DgPlacardReading
  from: number[]
} {
  // A placard seen in any photo is a placard: "none visible" only says it is not on that photo's face.
  const seen = readings.filter((r) => r.reading.answer === 'placard')
  const pool = seen.length > 0 ? seen : readings.filter((r) => r.reading.answer === 'none')
  const agreed = agree(
    pool.map((r) => ({
      photo: r.photo,
      value: `${r.reading.answer}:${r.reading.dgClass}`,
      certainty: r.reading.certainty,
    })),
  )
  if (!agreed) return { reading: readings[0]!.reading, from: [] }
  const source = pool.find((r) => `${r.reading.answer}:${r.reading.dgClass}` === agreed.value)!
  return { reading: { ...source.reading, certainty: agreed.certainty }, from: agreed.from }
}

export function combineDetails(
  runs: readonly { photo: number; details: ContainerDetailsReading }[],
): { details: ContainerDetailsReading; from: Record<string, number[]> } {
  const from: Record<string, number[]> = {}
  const size = combineSizeCode(runs.map((r) => ({ photo: r.photo, reading: r.details.sizeCode })))
  from.sizeCode = size.from
  const equipment = {} as ContainerDetailsReading['equipment']
  for (const key of EQUIPMENT_CHECKS) {
    const one = combineCheck(
      runs.map((r) => ({ photo: r.photo, reading: r.details.equipment[key] })),
      false,
    )
    equipment[key] = withCodeConflictKept(key, one.reading, size.reading)
    from[key] = one.from
  }
  const markings = {} as ContainerDetailsReading['markings']
  for (const key of MARKING_CHECKS) {
    const one = combineCheck(
      runs.map((r) => ({ photo: r.photo, reading: r.details.markings[key] })),
      true,
    )
    markings[key] = one.reading
    from[key] = one.from
  }
  const dg = combineDgPlacard(runs.map((r) => ({ photo: r.photo, reading: r.details.dgPlacard })))
  from.dgPlacard = dg.from
  return { details: { sizeCode: size.reading, equipment, markings, dgPlacard: dg.reading }, from }
}

/** A check's conflict with the code is weighed against the combined code, unless it carries its own note. */
function withCodeConflictKept(
  key: (typeof EQUIPMENT_CHECKS)[number],
  reading: CheckReading,
  code: SizeCodeReading,
): CheckReading {
  return reading.conflict ? reading : withCodeConflict(key, reading, code)
}

// ---------------------------------------------------------------------------------------------------
// Weights

type RowKey = 'maxGross' | 'tare' | 'payload' | 'printedPayload'

/** Two weights are the same reading when they agree to within a half of one percent. */
const sameKg = (a: number, b: number) => Math.abs(a - b) <= 0.005 * Math.max(a, b)

const kgText = (value: number) => `${value.toLocaleString('en-GB')} kg`

export function combineWeights(runs: readonly { photo: number; weights: WeightChecks }[]): {
  weights: WeightChecks
  from: Record<string, number[]>
} {
  const from: Record<string, number[]> = {}
  const rowsKnown = (w: WeightChecks) =>
    (['maxGross', 'tare', 'payload', 'printedPayload', 'capacity'] as const).filter((k) => w[k])
      .length
  const base = [...runs].sort((a, b) => rowsKnown(b.weights) - rowsKnown(a.weights))[0]!
  const combined: WeightChecks = { ...base.weights, unread: { ...base.weights.unread } }
  const notes: string[] = []

  const rowOf = (w: WeightChecks, key: RowKey) => w[key] ?? null
  for (const key of ['maxGross', 'tare', 'payload', 'printedPayload'] as const) {
    const candidates = runs.flatMap((r): Candidate<WeightRow>[] => {
      const row = rowOf(r.weights, key)
      return row ? [{ photo: r.photo, value: row, certainty: row.certainty }] : []
    })
    const agreed = agree(candidates, (a, b) => sameKg(a.valueKg, b.valueKg))
    if (!agreed) continue
    combined[key] = { ...agreed.value, certainty: agreed.certainty }
    from[key] = agreed.from
    if (key !== 'printedPayload') delete combined.unread?.[key as 'maxGross' | 'tare']
    if (key === 'printedPayload') delete combined.unread?.printedPayload
    if (agreed.alternative) {
      notes.push(
        `Photos read the ${LABEL[key]} as ${kgText(agreed.value.valueKg)} and ${kgText(agreed.alternative.valueKg)}.`,
      )
    }
  }
  const capacities = runs.flatMap((r): Candidate<CapacityRow>[] =>
    r.weights.capacity
      ? [{ photo: r.photo, value: r.weights.capacity, certainty: r.weights.capacity.certainty }]
      : [],
  )
  const capacity = agree(capacities, (a, b) => sameKg(a.valueM3, b.valueM3))
  if (capacity) {
    combined.capacity = { ...capacity.value, certainty: capacity.certainty }
    from.capacity = capacity.from
    delete combined.unread?.capacity
  }
  if (notes.length > 0) {
    combined.conflict = [combined.conflict, ...notes].filter(Boolean).join(' ')
  }
  return { weights: combined, from }
}

const LABEL: Record<RowKey, string> = {
  maxGross: 'maximum gross weight',
  tare: 'tare weight',
  payload: 'payload',
  printedPayload: 'printed payload',
}

// ---------------------------------------------------------------------------------------------------
// The record

/**
 * The combined record of several photos. One photo (not dropped) gives that photo's own record with
 * its summary added. With none that shows a container, the combined record has nothing to show.
 */
export function combinePhotoRuns(
  runs: readonly PhotoRun[],
  options: { id: string },
): InspectionRecord {
  const kept = runs.filter((r) => !isDropped(r))
  const primary =
    kept.find((r) => r.record.damage && !r.record.damage.notAssessed) ?? kept[0] ?? runs[0]!
  const contributions = new Map(runs.map((r) => [r.index, NO_CONTRIBUTION()]))
  const add = (photo: number, field: 'details' | 'weights', names: string[]) =>
    contributions.get(photo)![field].push(...names)

  const idSources = kept.flatMap((r) =>
    r.record.containerId ? [{ photo: r.index, reading: r.record.containerId }] : [],
  )
  const idResult = combineContainerIds(idSources)
  const different = idResult?.kind === 'different'

  let containerId: ContainerIdReading | null = null
  if (idResult?.kind === 'combined') {
    containerId = idResult.reading
    for (const [photo, positions] of Object.entries(idResult.taken)) {
      contributions.get(Number(photo))!.containerId = [...positions].sort((a, b) => a - b)
    }
  }

  let details: InspectionRecord['details']
  let weights: InspectionRecord['weights'] = null
  if (!different) {
    const withDetails = kept.flatMap((r) =>
      r.record.details ? [{ photo: r.index, details: r.record.details }] : [],
    )
    if (withDetails.length === 1) {
      details = withDetails[0]!.details
      add(withDetails[0]!.photo, 'details', ['all'])
    } else if (withDetails.length > 1) {
      const combined = combineDetails(withDetails)
      details = combined.details
      for (const [field, photos] of Object.entries(combined.from)) {
        for (const photo of photos) add(photo, 'details', [field])
      }
    }
    const withWeights = kept.flatMap((r) =>
      r.record.weights ? [{ photo: r.index, weights: r.record.weights }] : [],
    )
    if (withWeights.length === 1) {
      weights = withWeights[0]!.weights
      add(withWeights[0]!.photo, 'weights', ['all'])
    } else if (withWeights.length > 1) {
      const combined = combineWeights(withWeights)
      weights = combined.weights
      for (const [field, photos] of Object.entries(combined.from)) {
        for (const photo of photos) add(photo, 'weights', [field])
      }
    }
  }

  // Length from shape, seal and placards (ticket #72, combineLengthSealPlacards.ts).
  const merged = combineLengthSealPlacards(
    kept.map((r) => ({ photo: r.index, record: r.record })),
    different,
  )
  for (const [field, from] of Object.entries(merged.from)) {
    for (const photo of from) add(photo, 'details', [field])
  }

  const photos: PhotoSummary[] = runs.map((r) => ({
    index: r.index,
    name: r.name,
    face: r.record.photoFace ?? null,
    side: sideOf(r.record),
    dropped: isDropped(r),
    containerId: r.record.containerId,
    contributed: contributions.get(r.index)!,
    passIds: r.record.rawResponses.map((raw) => raw.passId),
  }))

  const records = runs.map((r) => r.record)
  const base = primary.record
  return {
    ...base,
    ...merged.fields,
    id: options.id,
    resolvedVersion: records.map((r) => r.resolvedVersion).find(Boolean) ?? '',
    rawResponses: records.flatMap((r) => r.rawResponses),
    rechecks: records.flatMap((r) => r.rechecks ?? []),
    failures: records.flatMap((r) => r.failures ?? []),
    containerId,
    details,
    sizeCode: different ? null : (details?.sizeCode.decoded ?? base.sizeCode),
    weights,
    // The photo of the record is the first one given; the face and damage are the primary photo's (see above).
    photo: runs[0]!.record.photo,
    damage: different ? null : base.damage,
    differentContainers: different,
    photos,
  }
}
