import { describe, it, expect } from 'vitest'
import { recordedSideDamage } from '../../fixtures/recordedDamage'
import {
  VIEWS,
  faceStatus,
  findingsInView,
  imageRelativeFindings,
  SEVERITY_LEVELS,
  severityOfLevel,
  sortFindings,
  viewHasPhotos,
  type DamageAssessment,
  type DamageFinding,
} from '../damage'

const withPhotos = (photos: DamageAssessment['photos'], findings: DamageFinding[] = []) => ({
  ...recordedSideDamage,
  photos,
  findings,
})

describe('face coverage', () => {
  it('marks faces that were not photographed as not seen, never as clear', () => {
    expect(faceStatus(recordedSideDamage, 'rear')).toBe('not-seen')
    expect(faceStatus(recordedSideDamage, 'front')).toBe('not-seen')
    expect(faceStatus(recordedSideDamage, 'roof')).toBe('not-seen')
  })

  it("marks both long sides as can't tell when the photo does not establish which side it is", () => {
    expect(faceStatus(recordedSideDamage, 'left')).toBe('side-unknown')
    expect(faceStatus(recordedSideDamage, 'right')).toBe('side-unknown')
  })

  it('marks only the named side as photographed when the side is established', () => {
    const a = withPhotos([{ photo: 'right.jpg', face: 'right' }])
    expect(faceStatus(a, 'right')).toBe('photographed')
    expect(faceStatus(a, 'left')).toBe('not-seen')
  })
})

describe('the two fixed views', () => {
  it('pairs the rear with the right side and the front with the left side', () => {
    expect(VIEWS['rear-right']).toMatchObject({ end: 'rear', side: 'right' })
    expect(VIEWS['front-left']).toMatchObject({ end: 'front', side: 'left' })
  })

  it('says a view has no photos when none of its faces was photographed', () => {
    expect(viewHasPhotos(recordedSideDamage, 'rear-right')).toBe(false)
    expect(viewHasPhotos(recordedSideDamage, 'front-left')).toBe(false)
  })

  it('draws a finding only in the view that holds its face', () => {
    const [base] = recordedSideDamage.findings
    const rightFinding = { ...base!, id: 9, face: 'right' as const }
    const a = withPhotos([{ photo: 'right.jpg', face: 'right' }], [rightFinding])
    expect(findingsInView(a, 'rear-right').map((f) => f.id)).toEqual([9])
    expect(findingsInView(a, 'front-left')).toEqual([])
    expect(viewHasPhotos(a, 'rear-right')).toBe(true)
  })

  it('keeps a long-side finding out of both views, in the image-relative group', () => {
    expect(findingsInView(recordedSideDamage, 'rear-right')).toEqual([])
    expect(findingsInView(recordedSideDamage, 'front-left')).toEqual([])
    expect(imageRelativeFindings(recordedSideDamage).map((f) => f.id)).toEqual([1])
  })
})

describe('finding order', () => {
  it('lists confident findings before uncertain ones, and more serious before minor', () => {
    const [base] = recordedSideDamage.findings
    const make = (
      id: number,
      certainty: DamageFinding['certainty'],
      severity: DamageFinding['severity'],
    ) => ({ ...base!, id, certainty, severity })
    const sorted = sortFindings([
      make(1, 'Uncertain', 'major'),
      make(2, 'Confident', 'minor'),
      make(3, 'Confident', 'major'),
    ])
    expect(sorted.map((f) => f.id)).toEqual([3, 2, 1])
  })

  it('puts cosmetic findings after minor ones, and findings with no severity rating last', () => {
    const [base] = recordedSideDamage.findings
    const make = (id: number, severity: DamageFinding['severity']) => ({
      ...base!,
      id,
      certainty: 'Likely' as const,
      severity,
    })
    const sorted = sortFindings([make(1, null), make(2, 'cosmetic'), make(3, 'minor')])
    expect(sorted.map((f) => f.id)).toEqual([3, 2, 1])
  })
})

describe('severity scale', () => {
  it('has five levels, lowest first; none is not a finding severity', () => {
    expect(SEVERITY_LEVELS).toEqual(['none', 'cosmetic', 'minor', 'moderate', 'major'])
    expect(severityOfLevel('none')).toBeNull()
    expect(severityOfLevel('cosmetic')).toBe('cosmetic')
    expect(severityOfLevel('Moderate')).toBe('moderate')
    expect(severityOfLevel('severe')).toBeNull()
  })
})

describe('recorded side-damage fixture', () => {
  it('is based on the single side photo in samples, with no provider probability invented', () => {
    expect(recordedSideDamage.photos).toEqual([
      { photo: 'side-dented-grey.jpg', face: 'long-side' },
    ])
    expect(recordedSideDamage.findings).toHaveLength(1)
    const [finding] = recordedSideDamage.findings
    expect(finding!.types.map((t) => t.code)).toEqual(['DT'])
    expect(finding!.types.every((t) => t.probability === null)).toBe(true)
    expect(finding!.certainty).toBe('Likely')
    expect(finding!.severity).toBe('minor')
  })
})
