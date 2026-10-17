import { describe, it, expect } from 'vitest'
import { agree, combineContainerIds, oneStepUp } from '../combineReadings'
import type { CertaintyLabel, ContainerIdReading } from '../inspection'
import { buildContainerIdReading } from '../containerId'

// Known-good IDs: the check digit is the last character (ISO 6346, worked by hand for each).
const COYU = 'COYU2668130'
const APHU = 'APHU6586847'

function idReading(
  printed: string,
  certainty: CertaintyLabel,
  positionCertainty?: CertaintyLabel[],
) {
  if (!printed.includes('?')) {
    return { ...buildContainerIdReading({ printed, certainty }), positionCertainty }
  }
  return {
    value: printed,
    observedCheckDigit: null,
    calculatedCheckDigit: null,
    checkDigitValid: false,
    certainty,
    provenance: 'printed',
    positionCertainty,
  } as ContainerIdReading
}

describe('the agreement rule', () => {
  it('raises the same reading in two photos one step', () => {
    const agreed = agree([
      { photo: 1, value: '22G1', certainty: 'Likely' },
      { photo: 2, value: '22G1', certainty: 'Likely' },
    ])
    expect(agreed).toMatchObject({
      value: '22G1',
      certainty: 'Confident',
      from: [1, 2],
      alternative: null,
    })
  })

  it('makes a disagreement Uncertain, with the other reading as the alternative', () => {
    const agreed = agree([
      { photo: 1, value: '22G1', certainty: 'Confident' },
      { photo: 2, value: '42G1', certainty: 'Likely' },
    ])
    expect(agreed).toMatchObject({
      value: '22G1',
      certainty: 'Uncertain',
      alternative: '42G1',
      from: [1],
    })
  })

  it('keeps a reading only one photo gives as it is', () => {
    expect(agree([{ photo: 2, value: 'yes', certainty: 'Likely' }])).toMatchObject({
      certainty: 'Likely',
      from: [2],
    })
  })

  it('does not raise past Confident, or a reading that was not seen', () => {
    expect(oneStepUp('Confident')).toBe('Confident')
    expect(oneStepUp('Not seen')).toBe('Not seen')
    expect(oneStepUp('Uncertain')).toBe('Likely')
  })
})

describe('combining the container ID across photos', () => {
  it('fills the positions one photo did not read from the other', () => {
    const combined = combineContainerIds([
      { photo: 1, reading: idReading('COYU26????0', 'Likely') },
      { photo: 2, reading: idReading('??YU266813?', 'Likely') },
    ])
    expect(combined).toMatchObject({ kind: 'combined' })
    if (combined?.kind !== 'combined') return
    expect(combined.reading.value).toBe(COYU)
    expect(combined.reading.checkDigitValid).toBe(true)
    expect(combined.taken[1]).toEqual([1, 2, 3, 4, 5, 6, 11])
    // A position both photos read is credited to both.
    expect(combined.taken[2]).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('rises the characters both photos read, one step', () => {
    const combined = combineContainerIds([
      { photo: 1, reading: idReading(COYU, 'Likely') },
      { photo: 2, reading: idReading(COYU, 'Likely') },
    ])
    expect(combined).toMatchObject({
      kind: 'combined',
      reading: { value: COYU, certainty: 'Confident' },
    })
  })

  it('takes the combination that passes the check digit where the photos disagree', () => {
    // Photo 1 misreads the serial's last digit as 7, photo 2 reads it as 0 with a lower certainty.
    const combined = combineContainerIds([
      { photo: 1, reading: idReading('COYU2668137', 'Confident') },
      { photo: 2, reading: idReading(COYU, 'Likely') },
    ])
    if (combined?.kind !== 'combined') throw new Error('expected a combined ID')
    expect(combined.reading.value).toBe(COYU)
    expect(combined.reading.checkDigitValid).toBe(true)
    // The disagreeing position reads Uncertain, with the other reading as the alternative.
    expect(combined.reading.positionCertainty?.[10]).toBe('Uncertain')
    // The other reading fails the check digit, so it is never shown.
    expect(combined.reading.alternatives).toBeUndefined()
  })

  it('is Confident when two photos agree on every character, even from weak single reads', () => {
    const weak = Array<CertaintyLabel>(11).fill('Uncertain')
    const combined = combineContainerIds([
      { photo: 1, reading: idReading(COYU, 'Uncertain', weak) },
      { photo: 2, reading: idReading(COYU, 'Uncertain', weak) },
    ])
    if (combined?.kind !== 'combined') throw new Error('expected a combined ID')
    expect(combined.reading.certainty).toBe('Confident')
    expect(combined.reading.alternatives).toBeUndefined()
  })

  it('stays Likely at best when the owner code is not on the list, however many photos agree', () => {
    // ZZZU 000000 5 passes the check digit; ZZZU is not on the owner list.
    const combined = combineContainerIds([
      { photo: 1, reading: idReading('ZZZU0000005', 'Confident') },
      { photo: 2, reading: idReading('ZZZU0000005', 'Confident') },
    ])
    if (combined?.kind !== 'combined') throw new Error('expected a combined ID')
    expect(combined.reading.checkDigitValid).toBe(true)
    expect(combined.reading.certainty).toBe('Likely')
  })

  it('shows an alternative the photos disagree on only when it passes the check digit', () => {
    // Photo 2 differs at the 7th digit (COYU 260813 0 also passes) and at the check digit (7 fails).
    const combined = combineContainerIds([
      { photo: 1, reading: idReading(COYU, 'Confident') },
      { photo: 2, reading: idReading('COYU2608137', 'Likely') },
    ])
    if (combined?.kind !== 'combined') throw new Error('expected a combined ID')
    expect(combined.reading.certainty).toBe('Uncertain')
    expect(combined.reading.alternatives).toEqual(['COYU2608130'])
  })

  it('never goes past what the check digit allows', () => {
    // Both photos agree on an ID whose check digit fails: it cannot be Confident.
    const combined = combineContainerIds([
      { photo: 1, reading: idReading('COYU2668137', 'Confident') },
      { photo: 2, reading: idReading('COYU2668137', 'Confident') },
    ])
    if (combined?.kind !== 'combined') throw new Error('expected a combined ID')
    expect(combined.reading.checkDigitValid).toBe(false)
    expect(combined.reading.certainty).not.toBe('Confident')
  })

  it('does not combine two different IDs that both pass the check digit', () => {
    const combined = combineContainerIds([
      { photo: 1, reading: idReading(COYU, 'Confident') },
      { photo: 2, reading: idReading(APHU, 'Confident') },
    ])
    expect(combined).toEqual({ kind: 'different', ids: [COYU, APHU] })
  })

  it('returns one photo’s reading unchanged', () => {
    const reading = idReading(COYU, 'Likely')
    expect(combineContainerIds([{ photo: 1, reading }])).toMatchObject({
      kind: 'combined',
      reading,
    })
  })
})
