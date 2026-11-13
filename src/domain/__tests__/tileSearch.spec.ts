import { describe, expect, it } from 'vitest'
import { bands, cut, editDistance, grown, isoFits, narrowed, sealFits } from '../tileSearch'
import type { SealReading } from '../sealFamily'

const WHOLE = { left: 0, top: 0, right: 1, bottom: 1, confidence: 1 }

describe('cutting a photo into parts', () => {
  it('makes three overlapping bands across the area', () => {
    expect(bands(WHOLE).map((b) => [b.top, b.bottom])).toEqual([
      [0, 0.4],
      [0.3, 0.7],
      [0.6, 1],
    ])
  })

  it('cuts one side back by a quarter, and keeps every cut that still holds the reading', () => {
    const area = { left: 0.4, top: 0, right: 1, bottom: 0.6, confidence: 1 }
    expect(cut(area, 'left').left).toBeCloseTo(0.55)
    const next = narrowed(area, { left: true, right: true, top: true, bottom: true })
    expect([next.left, next.top, next.right, next.bottom].map((n) => +n.toFixed(3))).toEqual([
      0.55, 0.15, 0.85, 0.45,
    ])
    expect(narrowed(area, { left: false })).toEqual(area)
  })

  it('grows an area by a margin of its long side, inside the photo', () => {
    const g = grown({ left: 0.6, top: 0.1, right: 0.8, bottom: 0.2, confidence: 1 }, 0.25)
    expect([g.left, g.top, g.right, g.bottom].map((n) => +n.toFixed(2))).toEqual([
      0.55, 0.05, 0.85, 0.25,
    ])
  })
})

describe('whether a part holds the whole reading', () => {
  const seal = (value: string, certainty: SealReading['certainty'] = 'Confident'): SealReading => ({
    visible: true,
    characters: [],
    value,
    certainty,
  })

  it('takes a seal number within one character, read with some certainty', () => {
    expect(editDistance('01546220', '0154620')).toBe(1)
    expect(sealFits(seal('01546220'), '0154620')).toBe(true)
    expect(sealFits(seal('0154620', 'Likely'), '0154620')).toBe(true)
    expect(sealFits(seal('015462?'), '0154620')).toBe(false)
    expect(sealFits(seal('154?20'), '0154620')).toBe(false)
    expect(sealFits(seal('0154620', 'Uncertain'), '0154620')).toBe(false)
    expect(sealFits(seal('546620'), '0154620')).toBe(false)
  })

  it('takes the ISO code only when it is the same code', () => {
    const read = { state: 'read', code: '25G1', certainty: 'Confident' } as never
    expect(isoFits(read, '25G1')).toBe(true)
    expect(isoFits(read, '22G1')).toBe(false)
    expect(
      isoFits({ state: 'not-visible', code: null, certainty: 'Not seen' } as never, '25G1'),
    ).toBe(false)
  })
})
