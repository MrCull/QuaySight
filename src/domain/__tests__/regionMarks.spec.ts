import { describe, it, expect } from 'vitest'
import type { SharedAnswer } from '../questionSet'
import {
  MARK_COUNT,
  adjacent,
  areaOfMarks,
  markBox,
  markLabels,
  readRegions,
  regionsQuestions,
} from '../regionMarks'

const choice = (value: string, p: number): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p },
  confidence: p,
})

describe('the numbered regions', () => {
  it('are a 4 x 4 grid and nine regions straddling the grid lines: 25 marks', () => {
    expect(MARK_COUNT).toBe(25)
    expect(markLabels()).toHaveLength(25)
    expect(markBox(1)).toEqual({ top: 0, bottom: 0.25, left: 0, right: 0.25 })
    expect(markBox(16)).toEqual({ top: 0.75, bottom: 1, left: 0.75, right: 1 })
    // Mark 17 is centred where the first row and column lines cross, a cell in size.
    expect(markBox(17)).toEqual({ top: 0.125, bottom: 0.375, left: 0.125, right: 0.375 })
    expect(markBox(25)).toEqual({ top: 0.625, bottom: 0.875, left: 0.625, right: 0.875 })
    expect(markBox(0)).toBeNull()
    expect(markBox(26)).toBeNull()
  })

  it('draw the straddling marks in the second colour, so they are not read as cells', () => {
    const labels = markLabels()
    expect(labels.filter((l) => l.crossing).map((l) => l.text)).toEqual(
      Array.from({ length: 9 }, (_, i) => String(17 + i)),
    )
  })

  it('join two adjacent marks into one area, and ignore a second mark that is not adjacent', () => {
    expect(adjacent(3, 4)).toBe(true)
    expect(adjacent(3, 19)).toBe(true)
    expect(adjacent(1, 16)).toBe(false)
    expect(areaOfMarks([3, 4])).toEqual({
      marks: [3, 4],
      box: { top: 0, bottom: 0.25, left: 0.5, right: 1 },
    })
    expect(areaOfMarks([3, 14])?.marks).toEqual([3])
    expect(areaOfMarks([3, 3])?.marks).toEqual([3])
    expect(areaOfMarks([])).toBeNull()
  })

  it('ask the ID, seal, weights, ISO code and each hazard sticker, each with a second mark', () => {
    const names = regionsQuestions().map((q) => q.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'id_mark',
        'id_mark_2',
        'seal_mark',
        'weights_mark',
        'iso_mark',
        'hazard_1_mark',
        'hazard_3_mark_2',
      ]),
    )
    const offered = regionsQuestions().map((q) =>
      q.type === 'choice' ? q.choices.map((c) => c.value).join(',') : q.type,
    )
    const marks = [...Array.from({ length: 25 }, (_, i) => String(i + 1)), 'none'].join(',')
    expect(new Set(offered)).toEqual(new Set([marks]))
  })

  it('read the marks named, with "none" and a mark the model is unsure of both giving no area', () => {
    const found = readRegions({
      id_mark: choice('3', 0.8),
      id_mark_2: choice('4', 0.5),
      seal_mark: choice('none', 0.9),
      weights_mark: choice('7', 0.04),
      iso_mark: choice('19', 0.5),
      hazard_1_mark: choice('12', 0.6),
      hazard_2_mark: choice('none', 0.9),
    })
    expect(found.id).toEqual({ marks: [3, 4], box: { top: 0, bottom: 0.25, left: 0.5, right: 1 } })
    expect(found.seal).toBeNull()
    expect(found.weights).toBeNull()
    expect(found.iso?.marks).toEqual([19])
    expect(found.hazards.map((h) => h.marks)).toEqual([[12]])
  })

  it('give no area for a second mark when the first is none', () => {
    expect(readRegions({ id_mark: choice('none', 0.9), id_mark_2: choice('4', 0.9) }).id).toBeNull()
  })
})
