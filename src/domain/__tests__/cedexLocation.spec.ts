import { describe, expect, it } from 'vitest'
import { cedexLocation, describeCedexCode } from '../cedexLocation'
import type { DamageAssessment, DamageFinding, FindingZone } from '../damage'

function finding(
  face: DamageFinding['face'],
  zone: FindingZone | null,
  extra: Partial<DamageFinding> = {},
): DamageFinding {
  return {
    id: 1,
    face,
    zone,
    component: 'panel',
    visibility: 'clear',
    location: 'somewhere',
    title: 'Dent',
    description: '',
    bestInterpretation: '',
    uncertainty: '',
    types: [],
    severity: 'minor',
    certainty: 'Likely',
    caveats: [],
    ...extra,
  }
}

const side = (
  which: 'left' | 'right',
  extra: Partial<DamageAssessment> = {},
): DamageAssessment => ({
  source: 'live',
  photos: [{ photo: 'p.jpg', face: which }],
  findings: [],
  coverage: 'full',
  lengthFt: 40,
  sideInference: { side: which, basis: 'inferred' },
  ...extra,
})

const doors: DamageAssessment = {
  source: 'live',
  photos: [{ photo: 'd.jpg', face: 'rear' }],
  findings: [],
  coverage: 'full',
}

describe('CEDEX location codes on a long side', () => {
  it('codes a single section with N: right side, bottom half, section 2', () => {
    const loc = cedexLocation(finding('right', { u0: 0.1, u1: 0.2, v0: 0.5, v1: 1 }), side('right'))
    expect(loc).toMatchObject({ code: 'RB2N', basis: 'placed' })
    expect(loc.parts).toEqual(['Right side', 'Bottom half', 'Section 2 of 10'])
  })

  it('numbers sections from the door end, which is at the far end of a left side photo', () => {
    // A left side photo has the doors at photo right, so photo column 1 holds sections 9 and 10.
    const loc = cedexLocation(finding('left', { u0: 0, u1: 0.2, v0: 0, v1: 0.5 }), side('left'))
    expect(loc.code).toBe('LT90')
    expect(loc.parts).toEqual(['Left side', 'Top half', 'Sections 9 to 10 of 10'])
  })

  it('uses five sections on a 20 ft container', () => {
    const loc = cedexLocation(
      finding('right', { u0: 0.4, u1: 0.6, v0: 0.2, v1: 0.8 }),
      side('right', { lengthFt: 20 }),
    )
    expect(loc.code).toBe('RX3N')
    expect(loc.parts[2]).toBe('Section 3 of 5')
  })

  it('codes the rails as the upper and lower structural members along their whole length', () => {
    const rail = (v0: number, v1: number) =>
      cedexLocation(
        finding('right', { u0: 0, u1: 1, v0, v1 }, { component: 'rail' }),
        side('right'),
      )
    expect(rail(0.93, 1).code).toBe('RG10')
    expect(rail(0.93, 1).parts).toEqual([
      'Right side',
      'Bottom side rail',
      'Sections 1 to 10 of 10',
    ])
    expect(rail(0, 0.07).code).toBe('RH10')
  })

  it('codes a corner post on the end it stands at', () => {
    const post = (which: 'left' | 'right', u0: number) =>
      cedexLocation(
        finding(which, { u0, u1: u0 + 0.04, v0: 0, v1: 1 }, { component: 'corner-post' }),
        side(which),
      ).code
    // Right side: doors at photo left. Facing the doors, the right side is on your right (position 4).
    expect(post('right', 0)).toBe('DX4N')
    expect(post('right', 0.96)).toBe('FX1N')
    // Left side: doors at photo right.
    expect(post('left', 0.96)).toBe('DX1N')
    expect(post('left', 0)).toBe('FX4N')
  })

  it('estimates the code when part of the side is out of the photo', () => {
    const zone = { u0: 0.1, u1: 0.2, v0: 0.5, v1: 1 }
    const partial = cedexLocation(finding('right', zone), side('right', { coverage: 'most' }))
    expect(partial).toMatchObject({ code: 'RB2N', basis: 'estimated' })
    expect(partial.reason).toContain('outside the photo')
  })

  it('gives no side section when the container length was not read', () => {
    const zone = { u0: 0.1, u1: 0.2, v0: 0.5, v1: 1 }
    const loc = cedexLocation(finding('right', zone), side('right', { lengthAssumed: true }))
    expect(loc).toMatchObject({ code: null, basis: 'unknown', parts: ['Right side'] })
    expect(loc.reason).toContain('length was not read')
  })

  it('gives no code when the doors do not show which side it is', () => {
    const loc = cedexLocation(
      finding('right', { u0: 0.1, u1: 0.2, v0: 0.5, v1: 1 }),
      side('right', { sideInference: { side: 'right', basis: 'defaulted' } }),
    )
    expect(loc).toMatchObject({ code: null, basis: 'unknown' })
    expect(loc.reason).toContain('door end')
  })

  it('gives no code for a part whose place is not said, or a face that was not identified', () => {
    const casting = finding('right', null, { component: 'casting' })
    expect(cedexLocation(casting, side('right'))).toMatchObject({ code: null, basis: 'unknown' })
    expect(cedexLocation(casting, side('right')).reason).toContain('corner casting')
    expect(
      cedexLocation(finding('right', { u0: 0, u1: 0.2, v0: 0, v1: 1 }), side('right'), true),
    ).toMatchObject({
      code: null,
      basis: 'unknown',
    })
  })
})

describe('CEDEX location codes on the door end', () => {
  it('numbers four positions across the end from photo left, rows from header to sill', () => {
    const at = (zone: FindingZone, component: DamageFinding['component'] = 'panel') =>
      cedexLocation(finding('rear', zone, { component }), doors).code
    expect(at({ u0: 0.05, u1: 0.5, v0: 0.06, v1: 0.353 })).toBe('DT12')
    expect(at({ u0: 0.5, u1: 0.95, v0: 0.353, v1: 0.647 })).toBe('DX34')
    expect(at({ u0: 0.5, u1: 0.95, v0: 0.647, v1: 0.94 })).toBe('DB34')
    expect(at({ u0: 0.05, u1: 0.95, v0: 0, v1: 0.06 }, 'header')).toBe('DH14')
    expect(at({ u0: 0.05, u1: 0.95, v0: 0.94, v1: 1 }, 'sill')).toBe('DG14')
    expect(at({ u0: 0.74, u1: 0.8, v0: 0.06, v1: 0.94 }, 'locking-bar')).toBe('DX4N')
  })

  it('reads the end codes out as positions', () => {
    expect(describeCedexCode('DH14', 4)).toEqual([
      'Door end',
      'Door header',
      'Positions 1 to 4 of 4',
    ])
    expect(describeCedexCode('FG2N', 10)).toEqual([
      'Front end',
      'Bottom end rail',
      'Position 2 of 4',
    ])
  })
})
