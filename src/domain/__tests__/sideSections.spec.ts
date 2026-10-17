import { describe, it, expect } from 'vitest'
import { sectionCount, sectionsOfZone, sectionWords } from '../sideSections'

// Photo columns 1..5 are fifths of the face from photo left. Doors at photo left mean the right side.
const column = (c: number) => ({ u0: (c - 1) / 5, u1: c / 5, v0: 0, v1: 0.5 })

describe('sectionWords', () => {
  const zone = (u0: number, u1: number) => ({ u0, u1, v0: 0, v1: 0.5 })
  it('words a 40 ft side in tenths, from the door end', () => {
    expect(sectionWords(zone(0.2, 0.4), 40, 'right', 'inferred')).toBe(
      'Sections 3 and 4 of 10 from the door end',
    )
    expect(sectionWords(zone(0.2, 0.3), 40, 'right', 'inferred')).toBe(
      'Section 3 of 10 from the door end',
    )
  })
  it('words a 20 ft side in fifths, counting from the door end on the left side', () => {
    expect(sectionWords(zone(0.2, 0.4), 20, 'right', 'inferred')).toBe(
      'Section 2 of 5 from the door end',
    )
    expect(sectionWords(zone(0, 0.2), 20, 'left', 'inferred')).toBe(
      'Section 5 of 5 from the door end',
    )
  })
  it('says the door end is assumed when the photo did not show the doors', () => {
    expect(sectionWords(zone(0.2, 0.3), 40, 'right', 'defaulted')).toBe(
      'Section 3 of 10 from the assumed door end',
    )
  })
})

describe('CEDEX/IICL long-side sections', () => {
  it('has 5 sections for 20 ft and 10 for 40 and 45 ft', () => {
    expect(sectionCount(20)).toBe(5)
    expect(sectionCount(40)).toBe(10)
    expect(sectionCount(45)).toBe(10)
  })

  it('maps one photo zone to one section at 20 ft, numbered from the door end', () => {
    // Right side: doors at photo left, so photo column 1 is section 1.
    expect([1, 2, 3, 4, 5].map((c) => sectionsOfZone(column(c), 20, 'right'))).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
    ])
    // Left side: doors at photo right, so photo column 5 is section 1.
    expect([1, 2, 3, 4, 5].map((c) => sectionsOfZone(column(c), 20, 'left'))).toEqual([
      [5],
      [4],
      [3],
      [2],
      [1],
    ])
  })

  it('maps one photo zone to two sections at 40 and 45 ft', () => {
    for (const ft of [40, 45] as const) {
      expect(sectionsOfZone(column(1), ft, 'right')).toEqual([1, 2])
      expect(sectionsOfZone(column(5), ft, 'right')).toEqual([9, 10])
      expect(sectionsOfZone(column(5), ft, 'left')).toEqual([1, 2])
      expect(sectionsOfZone(column(1), ft, 'left')).toEqual([9, 10])
      expect(sectionsOfZone(column(3), ft, 'left')).toEqual([5, 6])
    }
  })

  it('maps a span across zones, and a corner post to the end section only', () => {
    expect(sectionsOfZone({ u0: 0.27, u1: 0.7, v0: 0.6, v1: 0.8 }, 40, 'right')).toEqual([
      3, 4, 5, 6, 7,
    ])
    expect(sectionsOfZone({ u0: 0, u1: 0.04, v0: 0, v1: 1 }, 40, 'right')).toEqual([1])
    expect(sectionsOfZone({ u0: 0.96, u1: 1, v0: 0, v1: 1 }, 40, 'left')).toEqual([1])
  })
})
