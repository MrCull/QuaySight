import { describe, it, expect } from 'vitest'
import { sectionCount, sectionsOfZone } from '../sideSections'

// Photo columns 1..5 are fifths of the face from photo left (the start of the face on both views).
const column = (c: number) => ({ u0: (c - 1) / 5, u1: c / 5, v0: 0, v1: 0.5 })

describe('CEDEX/IICL long-side sections', () => {
  it('has 5 sections for 20 ft and 10 for 40 and 45 ft', () => {
    expect(sectionCount(20)).toBe(5)
    expect(sectionCount(40)).toBe(10)
    expect(sectionCount(45)).toBe(10)
  })

  it('maps one photo zone to one section at 20 ft, numbered from the door end', () => {
    // Left side: doors at the face start, so photo column 1 is section 1.
    expect([1, 2, 3, 4, 5].map((c) => sectionsOfZone(column(c), 20, 'left'))).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
    ])
    // Right side: doors at the face end, so photo column 5 is section 1.
    expect([1, 2, 3, 4, 5].map((c) => sectionsOfZone(column(c), 20, 'right'))).toEqual([
      [5],
      [4],
      [3],
      [2],
      [1],
    ])
  })

  it('maps one photo zone to two sections at 40 and 45 ft', () => {
    for (const ft of [40, 45] as const) {
      expect(sectionsOfZone(column(1), ft, 'left')).toEqual([1, 2])
      expect(sectionsOfZone(column(5), ft, 'left')).toEqual([9, 10])
      expect(sectionsOfZone(column(5), ft, 'right')).toEqual([1, 2])
      expect(sectionsOfZone(column(1), ft, 'right')).toEqual([9, 10])
      expect(sectionsOfZone(column(3), ft, 'right')).toEqual([5, 6])
    }
  })

  it('maps a span across zones, and a corner post to the end section only', () => {
    expect(sectionsOfZone({ u0: 0.27, u1: 0.7, v0: 0.6, v1: 0.8 }, 40, 'left')).toEqual([
      3, 4, 5, 6, 7,
    ])
    expect(sectionsOfZone({ u0: 0, u1: 0.04, v0: 0, v1: 1 }, 40, 'left')).toEqual([1])
    expect(sectionsOfZone({ u0: 0.96, u1: 1, v0: 0, v1: 1 }, 40, 'right')).toEqual([1])
  })
})
