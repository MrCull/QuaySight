import { describe, it, expect } from 'vitest'
import { enlargedCrop, type ReadingBox } from '../enlargedCrop'

// Expected values are worked by hand. Photo 2000 x 1000; the box is 400 px wide and 100 px tall, so its
// long side is 400 px and the padding (0.8 of the long side) is 320 px on every side.
const photo = { width: 2000, height: 1000 }
const box = (over: Partial<ReadingBox> = {}): ReadingBox => ({
  left: 0.4,
  right: 0.6,
  top: 0.45,
  bottom: 0.55,
  confidence: 0.9,
  ...over,
})

describe('enlargedCrop', () => {
  it('pads the box well beyond its edges on every side', () => {
    // Box: x 800..1200, y 450..550. Padded: x 480..1520, y 130..870.
    expect(enlargedCrop(photo, box())).toEqual({ x: 480, y: 130, width: 1040, height: 740 })
  })

  it('keeps the crop inside the photo and its size when the box is near an edge', () => {
    // Box: x 0..400, y 0..100. Padded would run past the top-left; it shifts in instead of shrinking.
    const region = enlargedCrop(photo, box({ left: 0, right: 0.2, top: 0, bottom: 0.1 }))
    expect(region).toEqual({ x: 0, y: 0, width: 1040, height: 740 })
  })

  it('takes the whole photo when the padded crop is larger than the photo', () => {
    const region = enlargedCrop(photo, box({ left: 0.05, right: 0.95, top: 0.2, bottom: 0.8 }))
    expect(region).toEqual({ x: 0, y: 0, width: 2000, height: 1000 })
  })

  it('makes no crop when the model is not sure of the box', () => {
    expect(enlargedCrop(photo, box({ confidence: 0.2 }))).toBeNull()
  })

  it('makes no crop when there is no box or the box is a sliver', () => {
    expect(enlargedCrop(photo, null)).toBeNull()
    expect(enlargedCrop(photo, undefined)).toBeNull()
    expect(enlargedCrop(photo, box({ left: 0.5, right: 0.5 }))).toBeNull()
  })

  it('makes no crop for a photo of no size', () => {
    expect(enlargedCrop({ width: 0, height: 0 }, box())).toBeNull()
  })
})
