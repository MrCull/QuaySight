import { describe, it, expect } from 'vitest'
import { combineIdReadings, cropRegion, usableIdBox } from '../cropRead'
import type { ChoiceReading } from '../idQuestions'
import type { PhotoLimits } from '../providers'

// Expected values are worked by hand. COYU 266813 0 is the spec's live example: on 16 Oct 2026 Jev read
// one wrong digit on the full photo (COYU2661130) and COYU2668130 at about 1.0 from the crop.

const read = (
  value: string,
  certainty: ChoiceReading['certainty'],
  probability?: number,
  runnerUp: string | null = null,
): ChoiceReading => ({
  value,
  certainty,
  runnerUp,
  ...(probability === undefined ? {} : { probability }),
})
const unread = (): ChoiceReading => ({ value: null, certainty: "Can't tell", runnerUp: null })

const confidently = (id: string) => id.split('').map((c) => read(c, 'Confident', 0.99))

describe('combineIdReadings', () => {
  it('keeps the more confident reading of a character both readings agree on, and notes no disagreement', () => {
    const full = confidently('COYU2668130')
    full[2] = read('Y', 'Likely', 0.71, 'U')
    const crop = confidently('COYU2668130')

    const combined = combineIdReadings(full, crop)

    expect(combined.readings[2]).toEqual(read('Y', 'Confident', 0.99))
    expect(combined.disagreements).toEqual([])
  })

  it('keeps the agreed character when the full photo is the more confident one', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    crop[0] = read('C', 'Uncertain', 0.4)

    expect(combineIdReadings(full, crop).readings[0]).toEqual(read('C', 'Confident', 0.99))
  })

  it('on a disagreement keeps the more confident character, offers the other as the alternative and records it', () => {
    const full = confidently('COYU2661130')
    full[7] = read('1', 'Likely', 0.62, '8')
    const crop = confidently('COYU2668130')

    const combined = combineIdReadings(full, crop)

    expect(combined.readings.map((r) => r.value).join('')).toBe('COYU2668130')
    expect(combined.readings[7]).toEqual(read('8', 'Confident', 0.99, '1'))
    expect(combined.disagreements).toEqual([
      {
        position: 8,
        full: { value: '1', certainty: 'Likely' },
        crop: { value: '8', certainty: 'Confident' },
        kept: 'crop',
      },
    ])
  })

  it('keeps the full photo character on a disagreement where it is the more confident one', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    crop[4] = read('7', 'Uncertain', 0.45)

    const combined = combineIdReadings(full, crop)

    expect(combined.readings[4]).toEqual(read('2', 'Confident', 0.99, '7'))
    expect(combined.disagreements[0]).toMatchObject({ position: 5, kept: 'full' })
  })

  it('lowers the certainty of a disagreement whose two readings are close, as the margin rule does', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    full[5] = read('6', 'Likely', 0.7)
    crop[5] = read('5', 'Likely', 0.75)

    const combined = combineIdReadings(full, crop)

    // 0.75 against 0.70 is within the 0.10 margin: Likely drops one level.
    expect(combined.readings[5]).toEqual(read('5', 'Uncertain', 0.75, '6'))
  })

  it('leaves a close disagreement between two weak readings unread rather than picking one', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    full[9] = read('3', 'Uncertain', 0.4)
    crop[9] = read('8', 'Uncertain', 0.42)

    const combined = combineIdReadings(full, crop)

    expect(combined.readings[9]).toEqual(unread())
    expect(combined.disagreements[0]).toMatchObject({ position: 10 })
  })

  it('compares certainty words when a reading carries no probability, and prefers the crop on a tie', () => {
    const full = 'COYU2668130'.split('').map((c) => read(c, 'Confident'))
    const crop = 'COYU2668130'.split('').map((c) => read(c, 'Confident'))
    full[6] = read('6', 'Likely')
    crop[6] = read('8', 'Likely')
    full[7] = read('8', 'Confident')
    crop[7] = read('3', 'Likely')

    const combined = combineIdReadings(full, crop)

    // A tie with no probabilities: the crop's character, one level lower.
    expect(combined.readings[6]).toMatchObject({
      value: '8',
      certainty: 'Uncertain',
      runnerUp: '6',
    })
    expect(combined.readings[7]).toMatchObject({
      value: '8',
      certainty: 'Confident',
      runnerUp: '3',
    })
  })

  it('takes the reading that exists when the other side left the character unread', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    full[3] = unread()
    crop[10] = unread()

    const combined = combineIdReadings(full, crop)

    expect(combined.readings[3]).toEqual(read('U', 'Confident', 0.99))
    expect(combined.readings[10]).toEqual(read('0', 'Confident', 0.99))
    expect(combined.disagreements).toEqual([])
  })

  it('leaves a character unread when neither reading has it', () => {
    const full = confidently('COYU2668130')
    const crop = confidently('COYU2668130')
    full[8] = unread()
    crop[8] = unread()

    expect(combineIdReadings(full, crop).readings[8]).toEqual(unread())
  })
})

const JEV: PhotoLimits = { maxSide: 1568, minSide: 256, maxPixels: 2_458_624, minPixels: 78_400 }
// The box Jev latest gave for COYU 266813 0 on the 1079 x 1080 photo, 16 Oct 2026.
const COYU_BOX = { top: 0.1, bottom: 0.14, left: 0.61, right: 0.79, confidence: 0.77 }

describe('usableIdBox', () => {
  it('accepts a box that encloses some of the photo with reasonable confidence', () => {
    expect(usableIdBox(COYU_BOX)).toEqual(COYU_BOX)
  })

  it.each([
    ['no box', null],
    ['a low-confidence box', { ...COYU_BOX, confidence: 0.3 }],
    ['a box with no width', { ...COYU_BOX, right: 0.61 }],
    ['a box a sliver high', { ...COYU_BOX, bottom: 0.102 }],
    ['crossed edges', { ...COYU_BOX, top: 0.2, bottom: 0.1 }],
  ])('refuses %s', (_case, box) => {
    expect(usableIdBox(box)).toBeNull()
  })
})

describe('cropRegion', () => {
  it('crops around the COYU box with a margin and scales it up to the model limits', () => {
    // Box: x 658.2..852.4 (194.2 px), y 108..151.2 (43.2 px). Margin 0.35 of the long side, 68 px each way.
    const region = cropRegion({ width: 1079, height: 1080 }, COYU_BOX, JEV)!

    expect(region).toEqual({
      x: 590,
      y: 40,
      width: 331,
      height: 180,
      outWidth: 1568,
      outHeight: 852,
    })
  })

  it('keeps the whole printed ID inside the crop when the box is drawn too tight', () => {
    // The COYU number is printed from about x 620 to 915 and y 105 to 160 (hand-measured).
    const r = cropRegion({ width: 1079, height: 1080 }, COYU_BOX, JEV)!
    expect(r.x).toBeLessThanOrEqual(620)
    expect(r.x + r.width).toBeGreaterThanOrEqual(915)
    expect(r.y).toBeLessThanOrEqual(105)
    expect(r.y + r.height).toBeGreaterThanOrEqual(160)
  })

  it('stays inside the photo for a box at its edge', () => {
    const region = cropRegion(
      { width: 1000, height: 800 },
      { top: 0, bottom: 0.1, left: 0.8, right: 1, confidence: 0.9 },
      JEV,
    )!

    expect(region.x + region.width).toBeLessThanOrEqual(1000)
    expect(region.y).toBe(0)
    expect(region.x).toBe(730) // 800 - 0.35 * 200
    expect(region.outWidth).toBe(1568)
  })

  it('widens a long thin crop so its short side still meets the minimum once scaled', () => {
    // A 600 x 1 px box pads to 1020 x 421 px; a 1000 px minimum side needs the short side widened.
    const region = cropRegion(
      { width: 1500, height: 1000 },
      { top: 0.5, bottom: 0.501, left: 0.2, right: 0.6, confidence: 0.9 },
      { ...JEV, minSide: 1000 },
    )!

    expect(Math.min(region.outWidth, region.outHeight)).toBeGreaterThanOrEqual(1000)
    expect(Math.max(region.outWidth, region.outHeight)).toBeLessThanOrEqual(1568)
  })

  it('keeps within the pixel total as well as the side limit', () => {
    const region = cropRegion(
      { width: 1500, height: 1500 },
      { top: 0.2, bottom: 0.6, left: 0.2, right: 0.6, confidence: 0.9 },
      { ...JEV, maxPixels: 2_000_000 },
    )!

    // 1020 x 1020 px scaled to 1568 a side would be 2,458,624 px: the total caps it at 1414 a side.
    expect(region.outWidth).toBe(1414)
    expect(region.outWidth * region.outHeight).toBeLessThanOrEqual(2_000_000)
    expect(region.outWidth).toBeLessThanOrEqual(1568)
    expect(region.outHeight).toBeLessThanOrEqual(1568)
  })
})
