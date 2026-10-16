// Which damage set's findings an inspection shows (spec #27, ticket #33). Pure.
//
// A live run asks every damage set at once (long side, door end), each as its own
// request, while the survey asks which face the photo shows. The damage shown comes from the set
// written for the detected face. A set whose own coverage check says its face is not inspectable
// contributes nothing. A face no set covers (roof, close-up, unknown, front end) is "not assessed for
// this view", with the reason. The requests land in any order: whichever lands, the record's damage is
// worked out again from the face and every reading so far (withPhotoFace, withDamageReading).
//
// Adding a set (see notes/damage-sets.md): a reading mapper for its answers (like readSideDamage), a
// plan request that folds its reading in with withDamageReading, and its face in DAMAGE_SET_FACES.
import type {
  DamageAssessment,
  DamageFace,
  DamageFinding,
  FaceCoverage,
  ImageQuality,
  SideInference,
  ZoneCoverage,
} from './damage'
import type { InspectionRecord } from './inspection'
import type { FaceReading, PhotoFace } from './photoFace'

declare module './inspection' {
  interface InspectionRecord {
    /** The face the survey says the photo shows. Absent until the survey answers; null when it gave none. */
    photoFace?: FaceReading | null
    /** Every damage set's reading of the photo, one per face, before the face chooses among them. */
    damageReadings?: DamageSetReading[]
  }
}

/** One damage set's reading of one photo: what it found on its own face, and its own checks. */
export interface DamageSetReading {
  /** The face the set is written for. */
  face: PhotoFace
  /** False when the set's own coverage check says its face is not inspectable in this photo. */
  inspectable: boolean
  findings: DamageFinding[]
  zones: ZoneCoverage[]
  imageQuality: ImageQuality | null
  coverage: FaceCoverage | null
  /** Probability of "potentially significant damage, closer inspection advised", or null when unread. */
  significantProbability: number | null
  doorEnd: 'image-left' | 'image-right' | null
  /** The raw response the reading came from. */
  passId?: string
}

/** The faces a damage set is written for, and the schematic face their findings are drawn on. */
export const DAMAGE_SET_FACES: Partial<Record<PhotoFace, DamageFace>> = {
  'long-side': 'long-side',
  'rear-doors': 'rear',
}

const FACE_NAME: Record<PhotoFace, string> = {
  'rear-doors': 'door end',
  'long-side': 'long side',
  'front-end': 'front end',
  roof: 'roof',
  'close-up': 'close-up',
  unknown: 'unknown view',
}

const UNIDENTIFIED = 'The face of the container this photo shows could not be identified.'

function notAssessed(reason: string): DamageAssessment {
  return { source: 'live', photos: [], findings: [], notAssessed: { reason } }
}

/**
 * The side a long-side photo shows, from where the doors are in it. Photo-left is drawn as the face's
 * start and photo-right as its end on both fixed views (the end face drawn beside the side is the rear
 * on the right side and the front on the left side), so a photo whose doors are at photo-left lines up
 * with the left side's door end and one with doors at photo-right with the right side's: no mirroring.
 */
function sideFor(doorEnd: DamageSetReading['doorEnd']): SideInference {
  if (doorEnd === 'image-left') return { side: 'left', basis: 'inferred' }
  if (doorEnd === 'image-right') return { side: 'right', basis: 'inferred' }
  return { side: 'right', basis: 'defaulted' }
}

/** Photo-relative wording in the long side's texts, in the container's own terms once the doors settle the side. */
function inContainerTerms(
  text: string,
  inference: SideInference,
  doorEnd: DamageSetReading['doorEnd'],
): string {
  if (inference.basis === 'defaulted' || !doorEnd) return text
  const leftName = doorEnd === 'image-left' ? 'the door end' : 'the front end'
  const rightName = doorEnd === 'image-left' ? 'the front end' : 'the door end'
  return text
    .replace(/from the left/g, `from ${leftName}`)
    .replace(/at photo left/g, `at ${leftName}`)
    .replace(/at photo right/g, `at ${rightName}`)
}

function placeOnSide(reading: DamageSetReading, inference: SideInference) {
  const words = (t: string) => inContainerTerms(t, inference, reading.doorEnd)
  return {
    findings: reading.findings.map((f) => ({
      ...f,
      face: inference.side,
      title: words(f.title),
      location: words(f.location),
      description: words(f.description),
      bestInterpretation: words(f.bestInterpretation),
      uncertainty: words(f.uncertainty),
      caveats: f.caveats.map(words),
    })),
    zones: reading.zones.map((z) => ({ ...z, face: inference.side, label: words(z.label) })),
  }
}

function fromReading(reading: DamageSetReading, photo: string | null): DamageAssessment {
  const face = DAMAGE_SET_FACES[reading.face]
  if (!reading.inspectable || !face) {
    return notAssessed(`The ${FACE_NAME[reading.face]} is not inspectable in this photo.`)
  }
  if (face === 'long-side') {
    const sideInference = sideFor(reading.doorEnd)
    return {
      source: 'live',
      photos: photo ? [{ photo, face: sideInference.side }] : [],
      ...placeOnSide(reading, sideInference),
      imageQuality: reading.imageQuality,
      coverage: reading.coverage,
      significantProbability: reading.significantProbability,
      doorEnd: reading.doorEnd,
      sideInference,
      ...(reading.passId ? { passId: reading.passId } : {}),
    }
  }
  return {
    source: 'live',
    photos: photo ? [{ photo, face }] : [],
    findings: reading.findings,
    zones: reading.zones,
    imageQuality: reading.imageQuality,
    coverage: reading.coverage,
    significantProbability: reading.significantProbability,
    doorEnd: reading.doorEnd,
    ...(reading.passId ? { passId: reading.passId } : {}),
  }
}

/**
 * The damage to show, from the detected face and the damage sets' readings so far. Null while the
 * reading it needs has not arrived (or never did: its request failed, and the run says so).
 *
 * - A face a set covers: that set's reading; nothing when its own coverage says not inspectable.
 * - A face no set covers (roof, close-up, unknown, front end): not assessed for this view, with why.
 * - No detected face (the survey has not answered, or gave none): the one set whose own coverage says
 *   its face is inspectable; when none or several do, the face could not be identified.
 */
export function assessDamage(
  face: FaceReading | null | undefined,
  readings: readonly DamageSetReading[],
  photo: string | null,
): DamageAssessment | null {
  if (face) {
    if (face.face === 'unknown') return notAssessed(UNIDENTIFIED)
    if (face.face === 'close-up') {
      return notAssessed('The photo is a close-up, so the face it shows could not be placed.')
    }
    if (!DAMAGE_SET_FACES[face.face]) {
      return notAssessed(
        `The photo shows the ${FACE_NAME[face.face]}, which this inspection does not assess for damage.`,
      )
    }
    const reading = readings.find((r) => r.face === face.face)
    return reading ? fromReading(reading, photo) : null
  }
  if (readings.length === 0) return null
  const inspectable = readings.filter((r) => r.inspectable && DAMAGE_SET_FACES[r.face])
  return inspectable.length === 1 ? fromReading(inspectable[0]!, photo) : notAssessed(UNIDENTIFIED)
}

function reassess(record: InspectionRecord): InspectionRecord {
  return {
    ...record,
    damage: assessDamage(record.photoFace, record.damageReadings ?? [], record.photo?.name ?? null),
  }
}

/** The survey's face folded in: the damage is chosen again. */
export function withPhotoFace(
  record: InspectionRecord,
  face: FaceReading | null,
): InspectionRecord {
  return reassess({ ...record, photoFace: face })
}

/** A damage set's reading folded in (replacing any earlier one for its face): the damage is chosen again. */
export function withDamageReading(
  record: InspectionRecord,
  reading: DamageSetReading,
): InspectionRecord {
  const others = (record.damageReadings ?? []).filter((r) => r.face !== reading.face)
  return reassess({ ...record, damageReadings: [...others, reading] })
}
