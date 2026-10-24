// The container's length, seal and placards combined across the photos that show them (spec #51, ticket #72).
// Pure. Each is combined by the agreement rule (combineReadings.ts); combinePhotos.ts calls this once.
//
// - Length from shape: from side photos (or a photo whose face could not be told); a Confident ISO code still
//   wins in chosenLength.ts, which weighs it against the combined shape.
// - Seal: character by character across the photos that show it and agree on how many characters it has. A photo that shows no seal only says there
//   is none on that face. The crop comes from the photo that gave most of the characters used.
// - Placards: the same class and UN number are one placard, with every face it was seen on.
import { oneStepUp, weakerOf, agree, type Candidate } from './combineReadings'
import type { ContainerLengthFt, LengthReading } from './chosenLength'
import type { CertaintyLabel, InspectionRecord } from './inspection'
import type { PhotoFace } from './photoFace'
import type { MarkReading, PlacardReading, PlacardsReading } from './placards'
import type { SealCharacter, SealReading } from './sealFamily'

export interface PhotoRecord {
  /** 1-based photo number. */
  photo: number
  record: InspectionRecord
}

export interface CombinedLengthSealPlacards {
  /** Fields to put on the combined record. A field no photo gave is left out. */
  fields: Pick<InspectionRecord, 'shapeLength' | 'seal' | 'placards'>
  /** Which photos each combined reading came from, by contribution name. */
  from: { shapeLength: number[]; seal: number[]; placards: number[] }
}

const RANK: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]
const rank = (c: CertaintyLabel) => RANK.indexOf(c)
const bestOf = (labels: CertaintyLabel[]) => labels.reduce((a, c) => (rank(c) < rank(a) ? c : a))

// A face that says the photo shows no long side: a shape length read from it is not used.
const NOT_A_SIDE: readonly PhotoFace[] = [
  'rear-doors',
  'front-end',
  'roof',
  'close-up',
  'not-container',
]

const faceOf = (r: PhotoRecord): PhotoFace | null => r.record.photoFace?.face ?? null

// ---------------------------------------------------------------------------------------------------
// Length from shape

function combineShapeLength(runs: PhotoRecord[]): {
  reading: LengthReading | null
  from: number[]
} {
  const sides = runs.filter((r) => {
    const face = faceOf(r)
    return face === null || !NOT_A_SIDE.includes(face)
  })
  const candidates: Candidate<ContainerLengthFt>[] = sides.flatMap((r) =>
    r.record.shapeLength
      ? [
          {
            photo: r.photo,
            value: r.record.shapeLength.feet,
            certainty: r.record.shapeLength.certainty,
          },
        ]
      : [],
  )
  const agreed = agree(candidates)
  if (!agreed) return { reading: null, from: [] }
  const source = sides.find(
    (r) => agreed.from.includes(r.photo) && r.record.shapeLength?.feet === agreed.value,
  )!.record.shapeLength!
  return {
    reading: { ...source, certainty: agreed.certainty },
    from: agreed.from,
  }
}

// ---------------------------------------------------------------------------------------------------
// Seal

function combineSeal(runs: PhotoRecord[]): { reading: SealReading | null; from: number[] } {
  const withSeal = runs.filter((r) => r.record.seal)
  if (withSeal.length === 0) return { reading: null, from: [] }
  const visible = withSeal.filter((r) => r.record.seal!.visible)
  if (visible.length === 0) return { reading: withSeal[0]!.record.seal!, from: [] }

  // Photos that counted the number differently read different strings: lining them up place by place
  // would splice them (an extra character in one shifts every one after it). The count is agreed first,
  // a zoomed read being a vote of its own, and only the photos with that count are combined.
  const counts = visible.flatMap((r) => {
    const seal = r.record.seal!
    if (!seal.characters.some((c) => c.value !== null)) return []
    const vote = { photo: r.photo, value: seal.characters.length, certainty: seal.certainty }
    return r.record.sealZoomRead?.outcome === 'combined' ? [vote, vote] : [vote]
  })
  const counted = agree(counts)
  const same = counted ? visible.filter((r) => counted.from.includes(r.photo)) : visible
  const length = Math.max(...same.map((r) => r.record.seal!.characters.length))
  const characters: SealCharacter[] = []
  const taken = new Map<number, number>()
  for (let i = 0; i < length; i++) {
    const candidates: Candidate<string>[] = same.flatMap((r) => {
      const c = r.record.seal!.characters[i]
      return c?.value ? [{ photo: r.photo, value: c.value, certainty: c.certainty }] : []
    })
    const agreed = agree(candidates)
    if (!agreed) {
      characters.push({ value: null, certainty: "Can't tell" })
      continue
    }
    characters.push({ value: agreed.value, certainty: agreed.certainty })
    for (const photo of agreed.from) taken.set(photo, (taken.get(photo) ?? 0) + 1)
  }

  const read = characters.filter((c) => c.value !== null)
  const certainty: CertaintyLabel =
    read.length === 0
      ? "Can't tell"
      : read.reduce<CertaintyLabel>(
          (w, c) => weakerOf(w, c.certainty),
          read.length < characters.length ? 'Uncertain' : 'Confident',
        )
  // Another photo counted a different number of characters: the number is in doubt as a whole.
  const doubted = counted?.alternative != null ? weakerOf(certainty, counted.certainty) : certainty
  const reading: SealReading = {
    visible: true,
    characters: read.length === 0 ? [] : characters,
    value: read.length === 0 ? '' : characters.map((c) => c.value ?? '?').join(''),
    certainty: doubted,
  }

  // The crop: the photo that gave most of the characters used, among those where the seal was located
  // (the model's own box, or the area the regions or the zoomed read found; combinePhotos adds the area).
  const located = (r: PhotoRecord) =>
    Boolean(r.record.seal!.box ?? r.record.sealZoomRead?.box ?? r.record.regions?.found?.seal?.box)
  const boxed = same
    .filter(located)
    .sort((a, b) => (taken.get(b.photo) ?? 0) - (taken.get(a.photo) ?? 0) || a.photo - b.photo)[0]
  if (boxed) {
    if (boxed.record.seal!.box) reading.box = boxed.record.seal!.box
    reading.photo = boxed.photo
  }
  return { reading, from: [...taken.keys()].sort((a, b) => a - b) }
}

// ---------------------------------------------------------------------------------------------------
// Placards

interface Seen {
  photo: number
  face: PhotoFace | null
  placard: PlacardReading
}

/** Two UN numbers are the same when every place both read is the same (an unread place is "?"). */
const compatibleUn = (a: string | null, b: string | null) =>
  a !== null && b !== null && [...a].every((ch, i) => ch === '?' || b[i] === '?' || b[i] === ch)

const samePlacard = (a: PlacardReading, b: PlacardReading) =>
  a.dgClass !== null && a.dgClass === b.dgClass && compatibleUn(a.unNumber, b.unNumber)

function mergePlacard(group: Seen[]): PlacardReading {
  // The most certain reading first; its digits are filled from the others where it did not read them.
  const ordered = [...group].sort(
    (a, b) => rank(a.placard.certainty) - rank(b.placard.certainty) || a.photo - b.photo,
  )
  const top = ordered[0]!.placard
  const unNumber =
    top.unNumber === null
      ? null
      : [...top.unNumber]
          .map((ch, i) =>
            ch !== '?'
              ? ch
              : (ordered.map((s) => s.placard.unNumber![i]).find((c) => c !== '?') ?? '?'),
          )
          .join('')
  const certainty = group.length > 1 ? oneStepUp(top.certainty) : top.certainty
  const boxed = ordered.find((s) => s.placard.box)
  const faces = [...new Set(group.map((s) => s.face))].filter(
    (f): f is PhotoFace => f !== null && f !== 'unknown' && f !== 'not-container',
  )
  const merged: PlacardReading = { dgClass: top.dgClass, unNumber, certainty, faces }
  if (boxed) {
    merged.box = boxed.placard.box
    merged.photo = boxed.photo
  }
  return merged
}

function combineMark(readings: { photo: number; mark: MarkReading }[]): MarkReading {
  // A mark seen in any photo is on the container: "no" only says it is not on that photo's face.
  const given = readings.filter((r) => r.mark.answer !== null)
  const pool = given.some((r) => r.mark.answer === 'yes')
    ? given.filter((r) => r.mark.answer === 'yes')
    : given
  const agreed = agree(
    pool.map((r) => ({ photo: r.photo, value: r.mark.answer, certainty: r.mark.certainty })),
  )
  if (!agreed) return readings[0]!.mark
  return { answer: agreed.value, certainty: agreed.certainty }
}

function combinePlacards(runs: PhotoRecord[]): { reading: PlacardsReading | null; from: number[] } {
  const withPlacards = runs.filter((r) => r.record.placards)
  if (withPlacards.length === 0) return { reading: null, from: [] }
  const readings = withPlacards.map((r) => ({
    photo: r.photo,
    face: faceOf(r),
    p: r.record.placards!,
  }))

  const groups: Seen[][] = []
  for (const r of readings) {
    for (const placard of r.p.placards) {
      const seen: Seen = { photo: r.photo, face: r.face, placard }
      const group = groups.find((g) => g.some((s) => samePlacard(s.placard, placard)))
      if (group) group.push(seen)
      else groups.push([seen])
    }
  }

  const presentPhotos = readings.filter((r) => r.p.answer === 'present')
  const nonePhotos = readings.filter((r) => r.p.answer === 'none')
  let answer: PlacardsReading['answer']
  let certainty: CertaintyLabel
  let from: number[]
  if (presentPhotos.length > 0) {
    answer = 'present'
    const best = bestOf(presentPhotos.map((r) => r.p.certainty))
    certainty = presentPhotos.length > 1 ? oneStepUp(best) : best
    from = presentPhotos.map((r) => r.photo)
  } else if (nonePhotos.length > 0) {
    answer = 'none'
    certainty = 'Not seen'
    from = nonePhotos.map((r) => r.photo)
  } else {
    answer = 'unclear'
    certainty = "Can't tell"
    from = []
  }
  return {
    reading: {
      answer,
      certainty,
      placards: groups.map(mergePlacard),
      marinePollutant: combineMark(
        readings.map((r) => ({ photo: r.photo, mark: r.p.marinePollutant })),
      ),
      limitedQuantity: combineMark(
        readings.map((r) => ({ photo: r.photo, mark: r.p.limitedQuantity })),
      ),
    },
    from,
  }
}

// ---------------------------------------------------------------------------------------------------

/** The length, seal and placards of the photos that show a container. `different`: nothing is combined. */
export function combineLengthSealPlacards(
  photos: readonly PhotoRecord[],
  different = false,
): CombinedLengthSealPlacards {
  if (different) {
    return {
      fields: { shapeLength: null, seal: undefined, placards: undefined },
      from: { shapeLength: [], seal: [], placards: [] },
    }
  }
  const runs = [...photos]
  const length = combineShapeLength(runs)
  const seal = combineSeal(runs)
  const placards = combinePlacards(runs)
  const fields: CombinedLengthSealPlacards['fields'] = {}
  if (runs.some((r) => r.record.shapeLength !== undefined)) fields.shapeLength = length.reading
  if (seal.reading) fields.seal = seal.reading
  if (placards.reading) fields.placards = placards.reading
  return {
    fields,
    from: { shapeLength: length.from, seal: seal.from, placards: placards.from },
  }
}
