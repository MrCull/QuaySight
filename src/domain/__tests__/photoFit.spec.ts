import { describe, it, expect } from 'vitest'
import { fitPhoto, largestWithin, unfitPhotoMessage } from '../photoFit'
import type { PhotoLimits } from '../providers'

/** Jev's documented limits (TypeSafe docs, checked 16 Oct 2026). */
const JEV: PhotoLimits = { maxSide: 1568, minSide: 256, maxPixels: 2_458_624, minPixels: 78_400 }
/** Luna: 2,048 px on the long side, no documented minimum. */
const LUNA: PhotoLimits = { maxSide: 2048, minSide: 0, maxPixels: null, minPixels: 0 }

describe('fitPhoto', () => {
  it('leaves a photo within the limits at its own size', () => {
    expect(fitPhoto({ width: 600, height: 900 }, JEV)).toEqual({
      fits: true,
      width: 600,
      height: 900,
      resized: false,
    })
  })

  it('shrinks a photo whose long side is over the limit, keeping its aspect ratio', () => {
    // The bundled APHU sample on Jev.
    expect(fitPhoto({ width: 1536, height: 2048 }, JEV)).toEqual({
      fits: true,
      width: 1176,
      height: 1568,
      resized: true,
    })
    // A 12 MP phone photo on Luna.
    expect(fitPhoto({ width: 4032, height: 3024 }, LUNA)).toEqual({
      fits: true,
      width: 2048,
      height: 1536,
      resized: true,
    })
  })

  it('never rounds a side up past the limit', () => {
    const fit = fitPhoto({ width: 3001, height: 2000 }, JEV)
    expect(fit).toEqual({ fits: true, width: 1568, height: 1044, resized: true })
  })

  it('shrinks a photo whose total pixels are over the limit, even when each side fits', () => {
    const limits: PhotoLimits = { maxSide: 4000, minSide: 0, maxPixels: 1_000_000, minPixels: 0 }
    // 2000 × 1000 is 2 MP; the largest 2:1 photo within 1 MP is 1414 × 707.
    expect(fitPhoto({ width: 2000, height: 1000 }, limits)).toEqual({
      fits: true,
      width: 1414,
      height: 707,
      resized: true,
    })
  })

  it('rejects a photo with a side below the minimum', () => {
    expect(fitPhoto({ width: 200, height: 900 }, JEV)).toEqual({ fits: false, reason: 'too-small' })
  })

  it('rejects a photo below the minimum total pixels', () => {
    const limits: PhotoLimits = { maxSide: 4000, minSide: 100, maxPixels: null, minPixels: 50_000 }
    expect(fitPhoto({ width: 200, height: 200 }, limits)).toEqual({
      fits: false,
      reason: 'too-small',
    })
  })

  it('names the total-pixel minimum when each side is long enough but the photo is still too small', () => {
    // 260 × 260 has both sides over 256 px but only 67,600 pixels, under Jev's 78,400.
    expect(fitPhoto({ width: 260, height: 260 }, JEV)).toEqual({ fits: false, reason: 'too-small' })
    expect(unfitPhotoMessage({ width: 260, height: 260 }, JEV, 'too-small', 'Jev')).toBe(
      'This photo is 260 × 260 px. Jev needs at least 78,400 pixels in total. Choose a larger photo.',
    )
  })

  it('rejects a photo so long and narrow that shrinking it to fit would take it below the minimum', () => {
    // 6000 × 400 fits only at 1568 × 104, below Jev's 256 px minimum side.
    expect(fitPhoto({ width: 6000, height: 400 }, JEV)).toEqual({
      fits: false,
      reason: 'out-of-proportion',
    })
  })
})

describe('largestWithin', () => {
  it("enlarges a size to the model's long-side limit, keeping its aspect ratio", () => {
    expect(largestWithin({ width: 1079, height: 1080 }, LUNA)).toEqual({
      width: 2046,
      height: 2048,
    })
    expect(largestWithin({ width: 900, height: 600 }, LUNA)).toEqual({ width: 2048, height: 1365 })
  })

  it('leaves a photo already at the limit at its own size, and shrinks one over it', () => {
    expect(largestWithin({ width: 1536, height: 2048 }, LUNA)).toEqual({
      width: 1536,
      height: 2048,
    })
    expect(largestWithin({ width: 4032, height: 3024 }, LUNA)).toEqual({
      width: 2048,
      height: 1536,
    })
  })

  it('stops at the pixel total when that is reached before the side limit', () => {
    // 1568 x 1568 is exactly Jev's 2,458,624 px; a lower total caps the side first.
    expect(largestWithin({ width: 500, height: 500 }, JEV)).toEqual({ width: 1568, height: 1568 })
    expect(largestWithin({ width: 1020, height: 1020 }, { ...JEV, maxPixels: 2_000_000 })).toEqual({
      width: 1414,
      height: 1414,
    })
  })

  it('has no size for a shape too long and narrow to meet the minimum side', () => {
    expect(largestWithin({ width: 2000, height: 100 }, JEV)).toBeNull()
  })
})
