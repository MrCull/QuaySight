import { expect, it } from 'vitest'
import { mapCropBox } from '../cropCoordinates'
import { cropRegion } from '../cropRead'
import { findModel } from '../providers'

it('maps all crop-relative edges to upright original coordinates despite output scaling', () => {
  // A 400x200 crop at (200,100) on a 1000x500 original, sent at any resolution.
  expect(
    mapCropBox(
      { width: 1000, height: 500 },
      { x: 200, y: 100, width: 400, height: 200 },
      { left: 0.25, right: 0.75, top: 0.1, bottom: 0.9 },
    ),
  ).toEqual({ left: 0.3, right: 0.5, top: 0.24, bottom: 0.56 })
})

it('round trips an edge target through the actual padded crop geometry', () => {
  const original = { width: 1000, height: 500 }
  const target = { left: 0, right: 0.2, top: 0, bottom: 0.2, confidence: 0.9 }
  const crop = cropRegion(
    original,
    target,
    findModel('openrouter', 'typesafe/jev-1.14')!.photoLimits,
    0.35,
  )!
  // 200x100 target, 70px padding, clipped to the upper-left image edge.
  expect([crop.x, crop.y, crop.width, crop.height]).toEqual([0, 0, 270, 170])
  const mapped = mapCropBox(original, crop, {
    left: 0,
    right: 200 / 270,
    top: 0,
    bottom: 100 / 170,
  })!
  expect(mapped.left).toBe(0)
  expect(mapped.right).toBeCloseTo(0.2)
  expect(mapped.top).toBe(0)
  expect(mapped.bottom).toBeCloseTo(0.2)
})

it('rejects nonfinite, reversed, empty and out-of-image mappings instead of clamping them', () => {
  const photo = { width: 1000, height: 500 }
  const crop = { x: 200, y: 100, width: 400, height: 200 }
  const box = { left: 0.2, right: 0.8, top: 0.1, bottom: 0.9 }
  for (const invalid of [
    { ...box, left: NaN },
    { ...box, right: 0.2 },
    { ...box, bottom: 1.1 },
    { ...box, top: 0.95 },
  ]) {
    expect(mapCropBox(photo, crop, invalid)).toBeNull()
  }
  expect(mapCropBox(photo, { ...crop, x: 900 }, box)).toBeNull()
  expect(mapCropBox(photo, { ...crop, width: 0 }, box)).toBeNull()
  expect(mapCropBox({ ...photo, height: 0 }, crop, box)).toBeNull()
  expect(mapCropBox(photo, crop, { left: 0.2 } as typeof box)).toBeNull()
})
