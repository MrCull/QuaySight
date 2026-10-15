// Damage assessment for the neutral schematic (spec 6.2, 6.3, 6.5). Provider-independent: every
// adapter normalises face, zone, severity and certainty into these shapes. Positions are approximate
// fractions of a face, never measurements, and never CEDEX location codes.

import type { CertaintyLabel } from './inspection'

/**
 * A photographed face. 'long-side' means a long side was photographed but the photo does not
 * establish whether it is the left or the right side of the container.
 */
export type DamageFace = 'rear' | 'front' | 'left' | 'right' | 'roof' | 'long-side'

export type ViewId = 'rear-right' | 'front-left'
export type FaceStatus = 'photographed' | 'side-unknown' | 'not-seen'
export type Severity = 'minor' | 'moderate' | 'major'
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
  zone: FindingZone
  /** Plain-language approximate location, for example "lower middle of the long side". */
  location: string
  title: string
  description: string
  bestInterpretation: string
  uncertainty: string
  types: DamageType[]
  severity: Severity
  certainty: FindingCertainty
  caveats: string[]
}

export interface PhotoCoverage {
  photo: string
  face: DamageFace
}

export interface DamageAssessment {
  source: 'recorded' | 'live'
  photos: PhotoCoverage[]
  findings: DamageFinding[]
}

export interface ViewSpec {
  id: ViewId
  label: string
  end: 'rear' | 'front'
  side: 'right' | 'left'
}

/** Two fixed views (spec 6.5): rear and right side, front and left side. Roof is greyed in both. */
export const VIEWS: Record<ViewId, ViewSpec> = {
  'rear-right': { id: 'rear-right', label: 'Rear and right side', end: 'rear', side: 'right' },
  'front-left': { id: 'front-left', label: 'Front and left side', end: 'front', side: 'left' },
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

export function imageRelativeFindings(assessment: DamageAssessment): DamageFinding[] {
  return assessment.findings.filter((f) => f.face === 'long-side')
}

const CERTAINTY_RANK: Record<FindingCertainty, number> = { Confident: 0, Likely: 1, Uncertain: 2 }
const SEVERITY_RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2 }

/** Confident before Likely before Uncertain; within that, more serious first. */
export function sortFindings(findings: DamageFinding[]): DamageFinding[] {
  return [...findings].sort(
    (a, b) =>
      CERTAINTY_RANK[a.certainty] - CERTAINTY_RANK[b.certainty] ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.id - b.id,
  )
}
