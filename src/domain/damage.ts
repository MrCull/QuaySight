// Damage assessment for the neutral schematic (spec 6.2, 6.3, 6.5). Provider-independent: every
// adapter normalises face, zone, severity and certainty into these shapes. Positions are approximate
// fractions of a face, never measurements. CEDEX location codes are derived from them for display
// (cedexLocation.ts), only where the photos settle the face and its orientation.

import type { ContainerLengthFt } from './chosenLength'
import type { CertaintyLabel } from './inspection'

/**
 * A photographed face. 'long-side' means a long side was photographed but the photo does not
 * establish whether it is the left or the right side of the container.
 */
export type DamageFace = 'rear' | 'front' | 'left' | 'right' | 'roof' | 'long-side'

export interface SideInference {
  side: 'left' | 'right'
  basis: 'inferred' | 'defaulted'
}

export type ViewId = 'rear-right' | 'front-left'
export type FaceStatus = 'photographed' | 'side-unknown' | 'not-seen'

/** The five-level apparent visual severity scale, lowest first. 'none' is never a finding. */
export const SEVERITY_LEVELS = ['none', 'cosmetic', 'minor', 'moderate', 'major'] as const
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]
/** A finding's apparent visual severity. Cosmetic is the lightest; there is no 'none' finding. */
export type Severity = Exclude<SeverityLevel, 'none'>

/** The finding severity a level label names (any case), or null for 'none' and anything else. */
export function severityOfLevel(label: string): Severity | null {
  const level = label.trim().toLowerCase()
  return level !== 'none' && (SEVERITY_LEVELS as readonly string[]).includes(level)
    ? (level as Severity)
    : null
}

/**
 * The part of the container a finding is on: a photo-relative zone of a panel, or a structural
 * component reported on its own. The door-end set's parts are the locking bar, cam, hinge, gasket, header and sill.
 */
export type DamageComponent =
  | 'panel'
  | 'rail'
  | 'corner-post'
  | 'casting'
  | 'locking-bar'
  | 'cam'
  | 'hinge'
  | 'gasket'
  | 'header'
  | 'sill'

/** How well a zone could be seen. 'not-visible' is shown as Not seen, never as clean. */
export type ZoneVisibility = 'clear' | 'partial' | 'not-visible'
export type FindingCertainty = Extract<CertaintyLabel, 'Confident' | 'Likely' | 'Uncertain'>

/** Approximate area on a face. u runs along the face's length (or width for an end), v down from its top. */
export interface FindingZone {
  u0: number
  u1: number
  v0: number
  v1: number
}

export interface DamageType {
  /** CEDEX damage-type code, for example DT. Not a location code. */
  code: string
  name: string
  /** Provider probability, or null when none was recorded. Never shown as 0 or 100%. */
  probability: number | null
}

export interface DamageFinding {
  id: number
  face: DamageFace
  /** Approximate area on the face; null when the set does not say where (e.g. "one of the castings"). */
  zone: FindingZone | null
  component: DamageComponent
  /** How well the zone could be seen, or null when the set did not say (components, recordings). */
  visibility: ZoneVisibility | null
  /** Plain-language approximate location, for example "lower middle of the long side". */
  location: string
  title: string
  description: string
  bestInterpretation: string
  uncertainty: string
  types: DamageType[]
  /** Apparent visual severity; null when the set gives the part no severity rating (components). */
  severity: Severity | null
  /** Probability per SEVERITY_LEVELS entry, when the model gave one. Kept for the export. */
  severityProbabilities?: number[]
  certainty: FindingCertainty
  caveats: string[]
  /**
   * Rust or paint wear: the lowest-severity class. Listed after real findings and never raises the
   * closer-inspection banner.
   */
  surfaceWear?: boolean
  /** The photos (1-based) the damage was seen in, when the inspection has several photos. */
  photos?: number[]
  /** Independent photo observations grouped for presentation; not a physical-defect identity claim. */
  observations?: DamageObservation[]
}

/** Classification evidence in its original photo-relative region, before cross-photo agreement. */
export interface DamageObservation {
  /** Stable within a photo's region/component, independent of card ordering and run id. */
  id: string
  findingId: number
  /** Null when the source photograph was not supplied; never guessed from another finding. */
  photo: { name: string; index?: number } | null
  passId: string | null
  evidence: Omit<DamageFinding, 'observations' | 'photos'>
}

/** One photo-relative zone a damage set judged, with how well it could be seen. */
export interface ZoneCoverage {
  /** The set's own zone id, e.g. Z2B. An application zone, never a CEDEX location code. */
  id: string
  face: DamageFace
  zone: FindingZone
  /** Plain words, e.g. "photo column 2 of 5, lower half". */
  label: string
  visibility: ZoneVisibility | null
}

export type ImageQuality = 'good' | 'limited' | 'poor'
export type FaceCoverage = 'full' | 'most' | 'partial' | 'not-inspectable'

export interface PhotoCoverage {
  photo: string
  face: DamageFace
  /** 1-based photo number, when the inspection has several photos. */
  index?: number
}

export interface DamageAssessment {
  source: 'recorded' | 'live'
  photos: PhotoCoverage[]
  findings: DamageFinding[]
  /** Findings from a photo whose face could not be identified: listed, never drawn. Several photos only. */
  unplaced?: DamageFinding[]
  /** The zones the set judged, with their visibility. Absent when the assessment has no zone grid. */
  zones?: ZoneCoverage[]
  /** Whether the photo is good enough to judge obvious damage, as the set's own check says. */
  imageQuality?: ImageQuality | null
  /** How much of the face is visible, as the set's own coverage check says. */
  coverage?: FaceCoverage | null
  /**
   * Probability of "potentially significant damage, closer inspection advised". Never a repair
   * verdict. Null when unread.
   */
  significantProbability?: number | null
  /** Which edge of the photo the door end is at, only when the photo shows it directly. */
  doorEnd?: 'image-left' | 'image-right' | null
  /**
   * Which long side a long-side photo shows. 'inferred' when the doors are visible at one edge of the
   * photo (doors at photo-left: left side; at photo-right: right side); 'defaulted' to the right side
   * when the doors do not settle it. Absent for any other face.
   */
  sideInference?: SideInference
  /** The container length the schematic is drawn to (20, 40 or 45 ft); 40 when absent. */
  lengthFt?: ContainerLengthFt
  /** True when no length was read and lengthFt is the 40 ft default: no CEDEX side section is then given. */
  lengthAssumed?: boolean
  /** Set when no face in the photo could be assessed: "Damage not assessed for this view", and why. */
  notAssessed?: { reason: string }
  /** The raw response the assessment came from (live), for the export. */
  passId?: string
}

/** At or above this probability the assessment says "potentially significant damage, closer inspection advised". */
export const SIGNIFICANT_MIN = 0.5

export function potentiallySignificant(assessment: DamageAssessment): boolean {
  const { findings } = assessment
  if (findings.length > 0 && findings.every((f) => f.surfaceWear)) return false
  return (assessment.significantProbability ?? 0) >= SIGNIFICANT_MIN
}

export interface ViewSpec {
  id: ViewId
  label: string
  end: 'rear' | 'front'
  side: 'right' | 'left'
}

/** Two fixed views (spec 6.5): rear and right side, front and left side. Roof is greyed in both. */
export const VIEWS: Record<ViewId, ViewSpec> = {
  'rear-right': { id: 'rear-right', label: 'Door end and right side', end: 'rear', side: 'right' },
  'front-left': {
    id: 'front-left',
    label: 'Blank end (no doors) and left side',
    end: 'front',
    side: 'left',
  },
}

type FixedFace = Exclude<DamageFace, 'long-side'>

export function faceStatus(assessment: DamageAssessment, face: FixedFace): FaceStatus {
  if (assessment.photos.some((p) => p.face === face)) return 'photographed'
  const isLongSide = face === 'left' || face === 'right'
  if (isLongSide && assessment.photos.some((p) => p.face === 'long-side')) return 'side-unknown'
  return 'not-seen'
}

export function viewHasPhotos(assessment: DamageAssessment, view: ViewId): boolean {
  const spec = VIEWS[view]
  return [spec.end, spec.side].some((face) => faceStatus(assessment, face) === 'photographed')
}

export function findingsInView(assessment: DamageAssessment, view: ViewId): DamageFinding[] {
  const spec = VIEWS[view]
  return assessment.findings.filter((f) => f.face === spec.end || f.face === spec.side)
}

const CERTAINTY_RANK: Record<FindingCertainty, number> = { Confident: 0, Likely: 1, Uncertain: 2 }
const SEVERITY_RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2, cosmetic: 3 }
const UNRATED_RANK = 4

/** Real findings first, surface wear after them; each group keeps its order. */
export function surfaceWearLast<T extends { surfaceWear?: boolean }>(findings: T[]): T[] {
  return [...findings.filter((f) => !f.surfaceWear), ...findings.filter((f) => f.surfaceWear)]
}

/** Real findings first, surface wear last. Within each: Confident before Likely before Uncertain, then more serious first. */
export function sortFindings(findings: DamageFinding[]): DamageFinding[] {
  return [...findings].sort(
    (a, b) =>
      Number(!!a.surfaceWear) - Number(!!b.surfaceWear) ||
      CERTAINTY_RANK[a.certainty] - CERTAINTY_RANK[b.certainty] ||
      (a.severity ? SEVERITY_RANK[a.severity] : UNRATED_RANK) -
        (b.severity ? SEVERITY_RANK[b.severity] : UNRATED_RANK) ||
      a.id - b.id,
  )
}
