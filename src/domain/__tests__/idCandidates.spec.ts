import { describe, it, expect } from 'vitest'
import { rankIdCandidates, withCategoryLetter } from '../idCandidates'
import type { ChoiceReading } from '../idQuestions'

const read = (id: string, runnerUps: Record<number, string> = {}): ChoiceReading[] =>
  id.split('').map((value, i) => ({
    value,
    certainty: 'Likely',
    runnerUp: runnerUps[i + 1] ?? null,
  }))

describe('ranking candidate container IDs', () => {
  it('puts the 4th letter as U on every reading', () => {
    expect(
      withCategoryLetter(read('COYX2668130'))
        .map((r) => r.value)
        .join(''),
    ).toBe('COYU2668130')
  })

  it('ranks the runner-up combination that passes above the top letters that fail', () => {
    // COUU 266813 fails; swapping the 3rd letter to Y passes (check digit 0).
    const ranked = rankIdCandidates(read('COUU2668130', { 3: 'Y' }), 'Likely')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.alternatives).toEqual([])
  })

  it('can pass by swapping two positions together', () => {
    const ranked = rankIdCandidates(read('COUU2668137', { 3: 'Y', 11: '0' }), 'Likely')
    expect(ranked.chars.join('')).toBe('COYU2668130')
  })

  it('keeps at most two alternatives when nothing passes', () => {
    const ranked = rankIdCandidates(read('COUU2668135', { 3: 'Y', 7: '1', 9: '4' }), 'Likely')
    expect(ranked.chars.join('')).toBe('COUU2668135')
    expect(ranked.alternatives).toEqual(['COYU2668135', 'COUU2618135'])
  })

  it('keeps the alternatives when the passing reading is only Uncertain', () => {
    const ranked = rankIdCandidates(read('COUU2668130', { 3: 'Y' }), 'Uncertain')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.alternatives).toEqual(['COUU2668130'])
  })

  it("judges the winning candidate's own certainty, not the worst of the original reading", () => {
    // Top owner letter U is Uncertain and fails the check digit; the runner-up Y is Likely and passes.
    const readings = read('COUU2668130', { 3: 'Y' }).map((r, i) =>
      i === 2 ? { ...r, certainty: 'Uncertain' as const, runnerUpCertainty: 'Likely' as const } : r,
    )
    const ranked = rankIdCandidates(readings, 'Confident')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.alternatives).toEqual([])
  })

  it('keeps the alternatives when the winning swap is itself only Uncertain', () => {
    const readings = read('COUU2668130', { 3: 'Y' }).map((r, i) =>
      i === 2 ? { ...r, runnerUpCertainty: 'Uncertain' as const } : r,
    )
    expect(rankIdCandidates(readings, 'Confident').alternatives).toEqual(['COUU2668130'])
  })
})
