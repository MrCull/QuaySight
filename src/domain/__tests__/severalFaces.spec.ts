import { describe, it, expect } from 'vitest'
import { faceChipLabel, faceOf, facesShown, facePart, type FaceReading } from '../photoFace'
import { assessDamage, type DamageSetReading } from '../damageSets'
import type { SharedAnswer } from '../questionSet'

const choice = (value: string, p = 0.96): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p },
  confidence: p,
})
const yes = (probability: number): SharedAnswer => ({ type: 'predicate', probability })

describe('several faces in one photo', () => {
  it('asks one yes/no question per face beside the main face', () => {
    const names = facePart.questions({ questionSet: 'luna', box: false }).map((q) => q.name)
    expect(names).toEqual(['photo_face', 'shows_rear_doors', 'shows_long_side', 'shows_front_end'])
  })

  it('lists the main face first, then each other face above even odds', () => {
    const face = faceOf({
      photo_face: choice('rear_doors'),
      shows_rear_doors: yes(0.99),
      shows_long_side: yes(0.8),
      shows_front_end: yes(0.1),
    })
    expect(face?.face).toBe('rear-doors')
    expect(face?.shown).toEqual(['rear-doors', 'long-side'])
  })

  it('keeps the main face even when the model says no to its own question', () => {
    const face = faceOf({ photo_face: choice('long_side'), shows_long_side: yes(0.3) })
    expect(face?.shown).toEqual(['long-side'])
  })

  it('leaves `shown` out when no shows question was answered, and a photo then shows its main face', () => {
    const face = faceOf({ photo_face: choice('long_side') })
    expect(face).not.toHaveProperty('shown')
    expect(facesShown(face)).toEqual(['long-side'])
    expect(facesShown(null)).toEqual([])
  })

  it('a close-up or a non-container shows only itself', () => {
    const face = faceOf({ photo_face: choice('close_up_seal'), shows_long_side: yes(0.9) })
    expect(facesShown(face)).toEqual(['close-up'])
  })

  it('names the main face and the others on the chip, the long side by its settled side', () => {
    expect(faceChipLabel('rear-doors', 'right', null, ['rear-doors', 'long-side'])).toBe(
      'Doors · Right side',
    )
    expect(faceChipLabel('long-side', 'left', null, ['long-side', 'rear-doors'])).toBe(
      'Left side · Doors',
    )
    expect(faceChipLabel('long-side', null, null, ['long-side'])).toBe('Long side')
    expect(faceChipLabel('rear-doors')).toBe('Doors')
  })
})

function reading(face: 'rear-doors' | 'long-side', doorEnd: DamageSetReading['doorEnd']) {
  return {
    face,
    inspectable: true,
    findings: [],
    zones: [],
    imageQuality: 'good',
    coverage: 'most',
    significantProbability: face === 'long-side' ? 0.7 : 0.2,
    doorEnd,
  } as DamageSetReading
}

describe('damage of a photo that shows doors and a long side', () => {
  const face: FaceReading = {
    face: 'rear-doors',
    probability: 0.9,
    certainty: 'Confident',
    shown: ['rear-doors', 'long-side'],
  }

  it('draws both faces, with the long side named by where the doors sit', () => {
    const damage = assessDamage(
      face,
      [reading('rear-doors', null), reading('long-side', 'image-left')],
      'p.jpg',
    )
    expect(damage?.photos.map((p) => p.face).sort()).toEqual(['rear', 'right'])
    expect(damage?.sideInference).toEqual({ side: 'right', basis: 'inferred' })
    expect(damage?.significantProbability).toBe(0.7)
  })

  it('shows the main face alone while the other face has not answered', () => {
    const damage = assessDamage(face, [reading('rear-doors', null)], 'p.jpg')
    expect(damage?.photos.map((p) => p.face)).toEqual(['rear'])
  })

  it('waits for the main face', () => {
    expect(assessDamage(face, [reading('long-side', 'image-left')], 'p.jpg')).toBeNull()
  })

  it('does not add a face the other set found not inspectable', () => {
    const none = { ...reading('long-side', null), inspectable: false }
    const damage = assessDamage(face, [reading('rear-doors', null), none], 'p.jpg')
    expect(damage?.photos.map((p) => p.face)).toEqual(['rear'])
  })
})
