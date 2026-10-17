// The CEDEX/IICL location sections of the long side (spec 4.3, ticket #47). Pure.
//
// The standard splits the long side into 5 sections for a 20 ft container and 10 for a 40 ft one (a 45 ft
// one uses 10 as well), numbered from the door end. A face's u runs from photo left to photo right and is
// not mirrored: doors at photo left mean the right side (section 1 at the left), doors at photo right
// the left side (section 1 at the right).
import type { ContainerLengthFt } from './chosenLength'
import type { DamageAssessment, FindingZone } from './damage'

export type LongSide = 'left' | 'right'

export function sectionCount(lengthFt: ContainerLengthFt): 5 | 10 {
  return lengthFt === 20 ? 5 : 10
}

// A zone edge a hair inside a section boundary does not claim the next section.
const EDGE = 1e-6

/** The sections (ascending, from the door end) a zone along the long side covers. */
export function sectionsOfZone(
  zone: FindingZone,
  lengthFt: ContainerLengthFt,
  side: LongSide,
): number[] {
  const n = sectionCount(lengthFt)
  const first = Math.max(0, Math.floor(zone.u0 * n + EDGE))
  const last = Math.min(n - 1, Math.ceil(zone.u1 * n - EDGE) - 1)
  const sections: number[] = []
  for (let i = first; i <= last; i++) sections.push(side === 'right' ? i + 1 : n - i)
  return sections.sort((a, b) => a - b)
}

/**
 * The section scheme a long-side assessment is drawn with: the side (the inferred or defaulted one) and
 * the length it follows; null for an assessment that is not of a long side. A defaulted side still
 * follows the length.
 */
export function sectionScheme(
  assessment: Pick<DamageAssessment, 'sideInference' | 'lengthFt'>,
): { side: LongSide; lengthFt: ContainerLengthFt; count: number } | null {
  if (!assessment.sideInference) return null
  const lengthFt = assessment.lengthFt ?? 40
  return { side: assessment.sideInference.side, lengthFt, count: sectionCount(lengthFt) }
}

/**
 * A zone's place on the long side in the drawing's own words, e.g. "Section 3 of 10 from the door end".
 * The door end is "assumed" when the photo did not show the doors and the side was defaulted.
 */
export function sectionWords(
  zone: FindingZone,
  lengthFt: ContainerLengthFt,
  side: LongSide,
  basis: 'inferred' | 'defaulted',
): string {
  const sections = sectionsOfZone(zone, lengthFt, side)
  const first = sections[0]!
  const last = sections[sections.length - 1]!
  const which =
    sections.length === 1
      ? `Section ${first}`
      : sections.length === 2
        ? `Sections ${first} and ${last}`
        : `Sections ${first} to ${last}`
  return `${which} of ${sectionCount(lengthFt)} from the ${basis === 'defaulted' ? 'assumed ' : ''}door end`
}
