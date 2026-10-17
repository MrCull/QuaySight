import { describe, it, expect } from 'vitest'
import type { DamageFinding } from '../damage'
import {
  assessDamage,
  withDamageReading,
  withPhotoFace,
  type DamageSetReading,
} from '../damageSets'
import type { FaceReading, PhotoFace } from '../photoFace'
import type { InspectionRecord } from '../inspection'

const dent: DamageFinding = {
  id: 1,
  face: 'long-side',
  zone: { u0: 0.2, u1: 0.4, v0: 0.5, v1: 1 },
  component: 'panel',
  visibility: 'clear',
  location: 'Photo column 2 of 5 from the left, lower half of the side sheet',
  title: 'Dent in the side sheet',
  description: '',
  bestInterpretation: '',
  uncertainty: '',
  types: [{ code: 'DT', name: 'Dent', probability: 0.92 }],
  severity: 'moderate',
  certainty: 'Confident',
  caveats: [],
}

function sideReading(overrides: Partial<DamageSetReading> = {}): DamageSetReading {
  return {
    face: 'long-side',
    inspectable: true,
    findings: [dent],
    zones: [],
    imageQuality: 'good',
    coverage: 'most',
    significantProbability: 0.8,
    doorEnd: null,
    passId: 'live-1-side',
    ...overrides,
  }
}

const placedDent = {
  ...dent,
  face: 'right' as const,
  location: 'Sections 3 and 4 of 10 from the assumed door end, lower half of the side sheet',
}

const seen = (face: PhotoFace): FaceReading => ({ face, probability: 0.95, certainty: 'Confident' })

describe('choosing the damage for the face the photo shows', () => {
  it('takes the findings from the set written for the detected face', () => {
    const damage = assessDamage(seen('long-side'), [sideReading()], 'side.jpg')
    expect(damage).toMatchObject({
      source: 'live',
      photos: [{ photo: 'side.jpg', face: 'right' }],
      findings: [placedDent],
      sideInference: { side: 'right', basis: 'defaulted' },
      imageQuality: 'good',
      coverage: 'most',
      significantProbability: 0.8,
      passId: 'live-1-side',
    })
    expect(damage?.notAssessed).toBeUndefined()
  })

  it.each([
    [20, 'Section 2 of 5 from the door end'],
    [40, 'Sections 3 and 4 of 10 from the door end'],
  ] as const)(
    'words a side card in the drawing’s sections for a %s ft container, never photo columns',
    (lengthFt, words) => {
      const damage = assessDamage(
        seen('long-side'),
        [sideReading({ doorEnd: 'image-left' })],
        'side.jpg',
        lengthFt,
      )
      const finding = damage!.findings[0]!
      expect(finding.location).toBe(`${words}, lower half of the side sheet`)
      expect(JSON.stringify(damage)).not.toMatch(/photo column/i)
    },
  )

  it.each([[null], ['image-left'], ['image-right']] as const)(
    'never words a side card or zone in photo columns, with the door end %s',
    (doorEnd) => {
      const reading = sideReading({
        doorEnd,
        zones: [
          {
            id: 'Z2B',
            face: 'long-side',
            zone: dent.zone!,
            label: 'photo column 2 of 5 from the left, lower half of the side sheet',
            visibility: 'clear',
          },
        ],
      })
      const damage = assessDamage(seen('long-side'), [reading], 'side.jpg')
      expect(JSON.stringify(damage)).not.toMatch(/photo column/i)
      expect(damage?.findings[0]?.location).toMatch(/door end, lower half/)
    },
  )

  it('takes nothing from a set whose own coverage says its face is not inspectable', () => {
    const damage = assessDamage(
      seen('long-side'),
      [sideReading({ inspectable: false, coverage: 'not-inspectable' })],
      'side.jpg',
    )
    expect(damage?.findings).toEqual([])
    expect(damage?.photos).toEqual([])
    expect(damage?.notAssessed?.reason).toMatch(/not inspectable/)
  })

  it.each([
    ['roof', /roof/],
    ['close-up', /close-up/],
    ['unknown', /could not be identified/],
    ['front-end', /front end/],
  ] as const)('says a %s photo is not assessed for this view, with the reason', (face, reason) => {
    const damage = assessDamage(seen(face), [sideReading()], 'p.jpg')
    expect(damage?.findings).toEqual([])
    expect(damage?.notAssessed?.reason).toMatch(reason)
  })

  it('never shows another face’s findings: a door photo waits for the door set, not the side set', () => {
    expect(assessDamage(seen('rear-doors'), [sideReading()], 'doors.jpg')).toBeNull()
    const doors = sideReading({ face: 'rear-doors', findings: [] })
    const damage = assessDamage(seen('rear-doors'), [sideReading(), doors], 'doors.jpg')
    expect(damage?.findings).toEqual([])
    expect(damage?.photos).toEqual([{ photo: 'doors.jpg', face: 'rear' }])
  })

  it('waits (null) while the set for the detected face has not answered', () => {
    expect(assessDamage(seen('long-side'), [], 'side.jpg')).toBeNull()
  })

  it('without a detected face, uses the one set whose own coverage says its face is inspectable', () => {
    expect(assessDamage(undefined, [sideReading()], 'side.jpg')?.findings).toEqual([placedDent])
    expect(
      assessDamage(undefined, [sideReading({ inspectable: false })], 'side.jpg')?.notAssessed
        ?.reason,
    ).toMatch(/could not be identified/)
    expect(assessDamage(undefined, [], 'side.jpg')).toBeNull()
  })
})

describe('folding into the record, whichever request answers first', () => {
  const record = {
    id: 'live-1',
    photo: { name: 'side.jpg', orientation: 'landscape' },
    damage: null,
  } as unknown as InspectionRecord

  it('gives the same damage when the face lands before or after the set', () => {
    const faceFirst = withDamageReading(withPhotoFace(record, seen('long-side')), sideReading())
    const setFirst = withPhotoFace(withDamageReading(record, sideReading()), seen('long-side'))
    expect(faceFirst.damage?.findings).toEqual([placedDent])
    expect(setFirst.damage).toEqual(faceFirst.damage)
    expect(setFirst.photoFace).toEqual(seen('long-side'))
  })

  it('switches to not assessed when the face lands and is not the set’s face', () => {
    const next = withPhotoFace(withDamageReading(record, sideReading()), seen('roof'))
    expect(next.damage?.findings).toEqual([])
    expect(next.damage?.notAssessed).toBeDefined()
  })

  it('keeps one reading per face', () => {
    const twice = withDamageReading(
      withDamageReading(record, sideReading()),
      sideReading({ findings: [] }),
    )
    expect(twice.damageReadings).toHaveLength(1)
    expect(twice.damage?.findings).toEqual([])
  })
})
