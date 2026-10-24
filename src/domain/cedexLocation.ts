// CEDEX (ISO 9897) location codes for damage findings. Pure.
//
// A location code is four characters:
//   1. the face: D door end, F front end, L left side, R right side, T top (roof), B base (floor),
//      U understructure;
//   2. the part of that face: T top half, B bottom half, X both halves (full height), H the upper structural
//      member (top side rail, door header, front top rail), G the lower one (bottom side rail, door sill,
//      front bottom rail);
//   3–4. the section, or the first and last section of a range. A single section is followed by N. Section
//      10 is written 0.
//
// The long sides are split into 5 sections (20 ft) or 10 (40 and 45 ft), numbered from the door end
// (sideSections.ts). Each end is split into 4 positions across its width, numbered 1 to 4 from left to right
// as you stand outside facing that end, so a photo of an end gives its positions directly: photo-left is
// position 1. Standing outside the door end, the container's left side is on your left, so the door corner
// posts are D…1 (left side) and D…4 (right side); at the front end it is the other way round.
//
// A code is only given where the photos say which face it is on and which way that face runs. Every code is
// an approximate area from a photo, never a measured or surveyed location.
import type { DamageAssessment, DamageFinding, FindingZone } from './damage'
import { sectionCount, sectionsOfZone } from './sideSections'

/**
 * How far a location code can be trusted:
 * - 'placed': the photos show which face and which end it is, and the face fills the photo; still approximate;
 * - 'estimated': a code is given, but part of the face is out of the photo, so the sections are read off the
 *   visible part as if it were the whole face;
 * - 'unknown': no code, because the photos do not settle the face, its orientation, the nominal length (for
 *   side sections) or which part it is (spec 6: codes only when these can be established).
 */
export type CedexLocationBasis = 'placed' | 'estimated' | 'unknown'

export interface CedexLocation {
  /** The four-character code, e.g. RB2N; null when it is unknown. */
  code: string | null
  basis: CedexLocationBasis
  /** The code read out, e.g. ["Right side", "Bottom half", "Section 2"]. Partial when the code is unknown. */
  parts: string[]
  /** Why the code is estimated or unknown. Absent when placed. */
  reason?: string
}

const FACE_NAME: Record<string, string> = {
  D: 'Door end',
  F: 'Front end',
  L: 'Left side',
  R: 'Right side',
  T: 'Roof',
  B: 'Floor',
  U: 'Understructure',
}

/** Character 2, read out. Side and end faces name their structural members differently. */
function portionName(face: string, portion: string): string {
  const side = face === 'L' || face === 'R'
  switch (portion) {
    case 'T':
      return 'Top half'
    case 'B':
      return 'Bottom half'
    case 'X':
      return 'Full height'
    case 'H':
      return side ? 'Top side rail' : face === 'D' ? 'Door header' : 'Top end rail'
    case 'G':
      return side ? 'Bottom side rail' : face === 'D' ? 'Door sill' : 'Bottom end rail'
    default:
      return portion
  }
}

const sectionChar = (n: number) => String(n % 10)

/** Characters 3 and 4 for a run of sections or positions. */
function sectionChars(first: number, last: number): string {
  return first === last ? `${sectionChar(first)}N` : `${sectionChar(first)}${sectionChar(last)}`
}

function sectionWords(face: string, first: number, last: number, of: number): string {
  const noun = face === 'D' || face === 'F' ? 'Position' : 'Section'
  return first === last ? `${noun} ${first} of ${of}` : `${noun}s ${first} to ${last} of ${of}`
}

/** The face letter and the first and last section (or end position) a code covers, numbered as the code is. */
export function cedexSpan(code: string): { face: string; first: number; last: number } {
  const [face = '', , a = '', b = ''] = code
  const first = a === '0' ? 10 : Number(a)
  const last = b === 'N' ? first : b === '0' ? 10 : Number(b)
  return { face, first, last }
}

/** Reads a four-character code out in words, e.g. RB2N → Right side · Bottom half · Section 2 of 10. */
export function describeCedexCode(code: string, sections: number): string[] {
  const portion = code[1] ?? ''
  const { face, first, last } = cedexSpan(code)
  const of = face === 'D' || face === 'F' ? 4 : sections
  return [FACE_NAME[face] ?? face, portionName(face, portion), sectionWords(face, first, last, of)]
}

// A zone edge a hair inside a boundary does not claim the next band.
const EDGE = 1e-6

/** The portion (character 2) a zone covers on a side panel: the top half, bottom half or both. */
function halfOf(zone: FindingZone): 'T' | 'B' | 'X' {
  const top = zone.v0 < 0.5 - EDGE
  const bottom = zone.v1 > 0.5 + EDGE
  return top && bottom ? 'X' : top ? 'T' : 'B'
}

/**
 * The 1–4 positions across an end face a zone covers; u runs from photo left, which is position 1. A part
 * narrower than one position (a locking bar, a hinge) is placed by its centre.
 */
function positionsOfZone(zone: FindingZone): [number, number] {
  if (zone.u1 - zone.u0 < 0.25) {
    const centre = Math.min(4, Math.floor(((zone.u0 + zone.u1) / 2) * 4) + 1)
    return [centre, centre]
  }
  const first = Math.max(1, Math.floor(zone.u0 * 4 + EDGE) + 1)
  const last = Math.min(4, Math.ceil(zone.u1 * 4 - EDGE))
  return [first, Math.max(first, last)]
}

function located(code: string, basis: 'placed' | 'estimated', sections: number, reason?: string) {
  return {
    code,
    basis,
    parts: describeCedexCode(code, sections),
    ...(reason ? { reason } : {}),
  }
}

function unknown(reason: string, parts: string[] = []): CedexLocation {
  return { code: null, basis: 'unknown', parts, reason }
}

const LENGTH_UNKNOWN =
  'The container length was not read, so whether the side has 5 or 10 sections is not established.'
const COVERAGE_REASON =
  'Part of the face is outside the photo, so the code assumes the visible part spans the whole face.'

/** Why a code that is otherwise placed is only estimated, or undefined when nothing is assumed. */
function assumption(assessment: DamageAssessment): string | undefined {
  return assessment.coverage && assessment.coverage !== 'full' ? COVERAGE_REASON : undefined
}

function onEnd(finding: DamageFinding, assessment: DamageAssessment): CedexLocation {
  const face = finding.face === 'rear' ? 'D' : 'F'
  const zone = finding.zone
  if (!zone) {
    return unknown(`Which ${componentNoun(finding)} is not established from the photo.`, [
      FACE_NAME[face]!,
    ])
  }
  let portion: string
  if (finding.component === 'header') portion = 'H'
  else if (finding.component === 'sill') portion = 'G'
  else if (finding.component === 'panel') portion = halfOf(zone)
  else portion = 'X'
  const [first, last] = positionsOfZone(zone)
  const reason = assumption(assessment)
  return located(
    `${face}${portion}${sectionChars(first, last)}`,
    reason ? 'estimated' : 'placed',
    4,
    reason,
  )
}

function onSide(finding: DamageFinding, assessment: DamageAssessment): CedexLocation {
  const inference = assessment.sideInference
  if (!inference || inference.basis !== 'inferred' || finding.face === 'long-side') {
    return unknown(
      'The photos do not show which end is the door end, so which side this is and where its sections start are not established.',
      ['Long side, which one not established'],
    )
  }
  const zone = finding.zone
  const side = finding.face === 'left' ? 'L' : 'R'
  if (!zone) {
    return unknown(`Which ${componentNoun(finding)} is not established from the photo.`, [
      FACE_NAME[side]!,
    ])
  }
  const lengthFt = assessment.lengthFt ?? 40
  const count = sectionCount(lengthFt)
  // A corner post on a side photo belongs to the end it stands at: the end, a full-height position at the
  // edge of that end nearest this side.
  if (finding.component === 'corner-post') {
    const atPhotoLeft = zone.u0 < 0.5
    const doorsAtPhotoLeft = inference.side === 'right'
    const end = atPhotoLeft === doorsAtPhotoLeft ? 'D' : 'F'
    // Facing the door end the left side is on your left (position 1); facing the front end, on your right.
    const position = (end === 'D') === (inference.side === 'left') ? 1 : 4
    const reason = assumption(assessment)
    return located(`${end}X${position}N`, reason ? 'estimated' : 'placed', 4, reason)
  }
  // Sections depend on the nominal length: with no length read, no section is given.
  if (assessment.lengthAssumed) return unknown(LENGTH_UNKNOWN, [FACE_NAME[side]!])
  const portion = finding.component === 'rail' ? (zone.v0 < 0.5 ? 'H' : 'G') : halfOf(zone)
  const sections = sectionsOfZone(zone, lengthFt, inference.side)
  const first = sections[0]!
  const last = sections[sections.length - 1]!
  const reason = assumption(assessment)
  return located(
    `${side}${portion}${sectionChars(first, last)}`,
    reason ? 'estimated' : 'placed',
    count,
    reason,
  )
}

function componentNoun(finding: DamageFinding): string {
  switch (finding.component) {
    case 'casting':
      return 'corner casting'
    case 'cam':
      return 'locking cam'
    case 'gasket':
      return 'gasket section'
    default:
      return 'part'
  }
}

/**
 * The CEDEX location of a finding within its assessment. A finding listed under "a face we couldn't identify"
 * is passed with `unplaced` and is always unknown.
 */
export function cedexLocation(
  finding: DamageFinding,
  assessment: DamageAssessment,
  unplaced = false,
): CedexLocation {
  if (unplaced) return unknown('The face of the container in this photo could not be identified.')
  switch (finding.face) {
    case 'rear':
    case 'front':
      return onEnd(finding, assessment)
    case 'left':
    case 'right':
    case 'long-side':
      return onSide(finding, assessment)
    default:
      return unknown('Which way the roof runs is not established from the photo.', ['Roof'])
  }
}

/** The words each basis is shown with. Never a certified or surveyed location. */
export const CEDEX_BASIS_WORDS: Record<CedexLocationBasis, string> = {
  placed: 'Placed from the photos',
  estimated: 'Estimated',
  unknown: 'Not established',
}
