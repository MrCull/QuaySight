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

  it('shows no alternatives when nothing passes the check digit', () => {
    const ranked = rankIdCandidates(read('COUU2668135', { 3: 'Y', 7: '1', 9: '4' }), 'Likely')
    expect(ranked.chars.join('')).toBe('COUU2668135')
    expect(ranked.alternatives).toEqual([])
    // Nothing fails the check digit and still reaches the screen, whatever the best reading's certainty.
    expect(ranked.certainty).toBe('Uncertain')
  })

  it('never offers an alternative that fails the check digit, however plausible', () => {
    // The 3rd letter's runner-up U fails; the 11th digit's runner-up 5 fails. Only the passing swap shows.
    const ranked = rankIdCandidates(read('COYU2668130', { 3: 'U', 7: '0', 11: '5' }), 'Likely')
    expect(ranked.alternatives).toEqual(['COYU2608130'])
  })

  it('keeps the passing alternatives when the passing reading is only Uncertain', () => {
    const ranked = rankIdCandidates(read('COYU2668130', { 3: 'E' }), 'Uncertain')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.certainty).toBe('Uncertain')
    expect(ranked.alternatives).toEqual(['COEU2668130'])
  })

  it('shows no alternatives when the best reading is Confident and passes', () => {
    const readings = read('COYU2668130', { 3: 'E' }).map((r) => ({
      ...r,
      certainty: 'Confident' as const,
    }))
    const ranked = rankIdCandidates(readings, 'Confident')
    expect(ranked.certainty).toBe('Confident')
    expect(ranked.alternatives).toEqual([])
  })

  it('keeps Likely, and its alternatives, when the owner is not on the list', () => {
    const readings = read('COEU2668130', { 3: 'Y' }).map((r) => ({
      ...r,
      certainty: 'Confident' as const,
    }))
    const ranked = rankIdCandidates(readings, 'Confident')
    expect(ranked.chars.join('')).toBe('COEU2668130')
    expect(ranked.certainty).toBe('Likely')
    expect(ranked.alternatives).toEqual(['COYU2668130'])
  })

  it('is Confident from a weak character only when two reads agreed on every character', () => {
    const readings = read('COYU2668130').map((r, i) =>
      i === 6 ? { ...r, certainty: 'Uncertain' as const } : r,
    )
    expect(rankIdCandidates(readings, 'Confident').certainty).toBe('Uncertain')
    expect(rankIdCandidates(readings, 'Confident', [], true).certainty).toBe('Confident')
  })

  it("judges the winning candidate's own certainty, not the worst of the original reading", () => {
    // Top owner letter U is Uncertain and fails the check digit; the runner-up Y is Likely and passes.
    const readings = read('COUU2668130', { 3: 'Y' }).map((r, i) =>
      i === 2 ? { ...r, certainty: 'Uncertain' as const, runnerUpCertainty: 'Likely' as const } : r,
    )
    const ranked = rankIdCandidates(readings, 'Confident')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.certainty).toBe('Confident')
    expect(ranked.alternatives).toEqual([])
  })

  it('is only Uncertain when the winning swap is itself only Uncertain', () => {
    const readings = read('COUU2668130', { 3: 'Y' }).map((r, i) =>
      i === 2 ? { ...r, runnerUpCertainty: 'Uncertain' as const } : r,
    )
    const ranked = rankIdCandidates(readings, 'Confident')
    expect(ranked.chars.join('')).toBe('COYU2668130')
    expect(ranked.certainty).toBe('Uncertain')
    expect(ranked.alternatives).toEqual([])
  })

  it('ranks passing alternatives by their own certainty', () => {
    const readings = read('COYU2668130', { 3: 'E', 7: '0' }).map((r, i) =>
      i === 2
        ? { ...r, runnerUpCertainty: 'Uncertain' as const }
        : i === 6
          ? { ...r, runnerUpCertainty: 'Likely' as const }
          : r,
    )
    const ranked = rankIdCandidates(readings, 'Likely')
    // The more certain swap (position 7) outranks the earlier but weaker one (position 3).
    expect(ranked.alternatives).toEqual(['COYU2608130', 'COEU2668130'])
  })

  it('shows alternatives with a listed owner before one without, then at most two', () => {
    const readings = read('COYU2668130', { 3: 'E', 7: '0', 8: '5' }).map((r, i) =>
      i === 6 || i === 7 ? { ...r, runnerUpCertainty: 'Uncertain' as const } : r,
    )
    const ranked = rankIdCandidates(readings, 'Likely')
    // COEU is the more certain swap but its owner is not on the list, so both COYU swaps come first.
    expect(ranked.alternatives).toEqual(['COYU2608130', 'COYU2665130'])
  })

  it('ranks a passing candidate above a more certain one that fails', () => {
    const readings = read('COUU2668130', { 3: 'Y', 7: '3' }).map((r, i) =>
      i === 2 ? { ...r, runnerUpCertainty: "Can't tell" as const } : r,
    )
    expect(rankIdCandidates(readings, 'Likely').chars.join('')).toBe('COYU2668130')
  })
})
