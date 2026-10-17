import { describe, expect, it } from 'vitest'
import { loupeLens, placeLoupe } from '../loupe'

/** Ticket #94: the hover loupe shows the region under the pointer at about 3×, never past the original's pixels. */
describe('loupeLens', () => {
  // A 500 × 320 frame showing a photo of the same shape: no letterbox bars.
  const frame = { left: 100, top: 50, width: 500, height: 320 }

  it('magnifies 3× when the original has the pixels for it', () => {
    const lens = loupeLens({ x: 350, y: 210 }, frame, { width: 4000, height: 2560 }, 220)
    expect(lens?.zoom).toBe(3)
    // The displayed 500 × 320 photo drawn at 3×.
    expect(lens?.imageWidth).toBe(1500)
    expect(lens?.imageHeight).toBe(960)
  })

  it('caps the zoom at the original resolution, so a small original is never upscaled', () => {
    // 1000 px original shown 500 px wide: one original pixel per loupe pixel at 2×.
    const lens = loupeLens({ x: 350, y: 210 }, frame, { width: 1000, height: 640 }, 220)
    expect(lens?.zoom).toBe(2)
    expect(lens?.imageWidth).toBe(1000)
  })

  it('does not shrink a photo shown larger than its original', () => {
    const lens = loupeLens({ x: 350, y: 210 }, frame, { width: 250, height: 160 }, 220)
    expect(lens?.zoom).toBe(1)
  })

  it('centres the loupe on the spot under the pointer', () => {
    // Pointer at the middle of the photo: (250, 160) on the displayed photo, (750, 480) at 3×.
    const lens = loupeLens({ x: 350, y: 210 }, frame, { width: 4000, height: 2560 }, 220)
    expect(lens?.offsetX).toBe(-(750 - 110))
    expect(lens?.offsetY).toBe(-(480 - 110))
  })

  it('is null on the letterbox bars of a contain-fitted photo', () => {
    // A square photo in the 500 × 320 frame: drawn 320 × 320, bars 90 px wide either side.
    const square = { width: 3200, height: 3200 }
    expect(loupeLens({ x: 100 + 40, y: 210 }, frame, square, 220)).toBeNull()
    expect(loupeLens({ x: 100 + 470, y: 210 }, frame, square, 220)).toBeNull()
    expect(loupeLens({ x: 100 + 250, y: 210 }, frame, square, 220)).not.toBeNull()
  })

  it('is null until the original has loaded and its size is known', () => {
    expect(loupeLens({ x: 350, y: 210 }, frame, { width: 0, height: 0 }, 220)).toBeNull()
  })
})

describe('placeLoupe', () => {
  const viewport = { width: 1280, height: 800 }

  it('sits below and to the right of the pointer, clear of it', () => {
    expect(placeLoupe({ x: 400, y: 300 }, 220, 24, viewport)).toEqual({ left: 424, top: 324 })
  })

  it('flips to the left near the right edge', () => {
    expect(placeLoupe({ x: 1150, y: 300 }, 220, 24, viewport)).toEqual({
      left: 1150 - 24 - 220,
      top: 324,
    })
  })

  it('flips above near the bottom edge', () => {
    expect(placeLoupe({ x: 400, y: 700 }, 220, 24, viewport)).toEqual({
      left: 424,
      top: 700 - 24 - 220,
    })
  })

  it('never covers the pointer, flipping both ways in a corner', () => {
    const at = { x: 1200, y: 760 }
    const box = placeLoupe(at, 220, 24, viewport)
    expect(box.left + 220).toBeLessThan(at.x)
    expect(box.top + 220).toBeLessThan(at.y)
  })
})
