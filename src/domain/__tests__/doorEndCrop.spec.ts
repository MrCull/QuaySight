import { describe, it, expect } from 'vitest'
import { doorEndBox } from '../doorEndCrop'
import type { FaceReading } from '../photoFace'
import type { RegionsReading } from '../regionMarks'

const corner: FaceReading = {
  face: 'rear-doors',
  probability: 0.9,
  certainty: 'Confident',
  shown: ['rear-doors', 'long-side'],
}

function located(left: number, right: number): RegionsReading {
  return {
    id: null,
    seal: null,
    weights: null,
    iso: null,
    hazards: [],
    doorEnd: { top: 0, bottom: 1, left, right },
  }
}

describe('the door end cut out on its own', () => {
  it('is the located columns when the photo shows the doors beside a long side', () => {
    expect(doorEndBox(corner, located(0, 0.5))).toEqual({
      top: 0,
      bottom: 1,
      left: 0,
      right: 0.5,
      confidence: 1,
    })
  })

  it('is also cut when the doors are the photo’s only face but fill part of its width', () => {
    const doors: FaceReading = { ...corner, shown: ['rear-doors'] }
    expect(doorEndBox(doors, located(0.25, 0.75))).not.toBeNull()
  })

  it('is not cut when the door end spans the whole photo, is not located or is not shown', () => {
    expect(doorEndBox(corner, located(0, 1))).toBeNull()
    expect(doorEndBox(corner, { ...located(0, 0.5), doorEnd: null })).toBeNull()
    expect(doorEndBox(corner, null)).toBeNull()
    const side: FaceReading = { ...corner, face: 'long-side', shown: ['long-side'] }
    expect(doorEndBox(side, located(0, 0.5))).toBeNull()
    expect(doorEndBox(null, located(0, 0.5))).toBeNull()
  })
})
