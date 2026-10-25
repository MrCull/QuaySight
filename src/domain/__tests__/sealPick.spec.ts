import { describe, it, expect } from 'vitest'
import type { SharedAnswer } from '../questionSetTypes'
import { readSeal, SEAL_POSITIONS, type SealReading } from '../sealFamily'
import {
  applySealPick,
  joinCandidates,
  MAX_SEAL_CANDIDATES,
  readSealPick,
  runVariants,
  sealCandidates,
  sealPickQuestion,
} from '../sealPick'

const choice = (probabilities: Record<string, number>): SharedAnswer => {
  const value = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]![0]
  return { type: 'choice', value, probabilities, confidence: null }
}

/** Places answered with one character each (or none past the end), as a confident read spells them. */
function spelling(prefix: string, value: string): Record<string, SharedAnswer> {
  return Object.fromEntries(
    Array.from({ length: SEAL_POSITIONS }, (_, i) => [
      `${prefix}${String(i + 1).padStart(2, '0')}`,
      choice({ [value[i] ?? 'none']: 0.95 }),
    ]),
  )
}

const reversed = (v: string) => [...v].reverse().join('')

const reading = (value: string, certainty: SealReading['certainty'] = 'Likely'): SealReading => ({
  visible: true,
  characters: [...value].map((c) => ({ value: c, certainty })),
  value,
  certainty,
})

describe('run variants', () => {
  it('lengthens every run by one and shortens every repeated run by one', () => {
    expect(runVariants('6400003')).toEqual([
      '66400003',
      '64400003',
      '64000003',
      '640003',
      '64000033',
    ])
  })
})

describe('seal candidates', () => {
  it('offers both reads and the near misses of a repeated run (live Jev: 6400003 read as 64000003)', () => {
    const answers = {
      ...spelling('seal_char_', '64000003'),
      ...spelling('seal_rchar_', reversed('6400003')),
    }
    const candidates = sealCandidates(answers, reading('64000003'), SEAL_POSITIONS)
    expect(candidates).toContain('64000003')
    expect(candidates).toContain('6400003')
    expect(candidates.length).toBeLessThanOrEqual(MAX_SEAL_CANDIDATES)
  })

  it("offers a place's next most likely character (live Jev: 0015167 read as 001117)", () => {
    const answers = {
      ...spelling('seal_char_', '0011167'),
      seal_char_04: choice({ '1': 0.6, '5': 0.3 }),
    }
    expect(sealCandidates(answers, reading('0011167'), SEAL_POSITIONS)).toContain('0015167')
  })

  it('offers nothing with an unread place in it, and nothing when no place was read', () => {
    expect(sealCandidates({}, reading('12?4'), SEAL_POSITIONS)).toEqual([])
  })

  it('is part of a read seal, so the pick can offer it', () => {
    const answers = {
      seal_visible: { type: 'predicate', probability: 0.99 } as SharedAnswer,
      seal_length: choice({ '7': 0.9 }),
      ...spelling('seal_char_', '1004440'),
      ...spelling('seal_rchar_', reversed('1004440')),
    }
    expect(readSeal(answers, { box: false })?.candidates).toContain('1004440')
  })

  it('takes the reads in turn when joining them, without repeats', () => {
    expect(joinCandidates(['a', 'b', 'c'], ['b', 'd'])).toEqual(['a', 'b', 'd', 'c'])
  })
})

describe('the pick question', () => {
  it('offers the candidates in sorted order, so the read is not placed first by being the read, and a none-of-these', () => {
    const q = sealPickQuestion(['64000003', '6400003', '640003'])
    expect(q.choices.map((c) => c.value)).toEqual(['64000003', '6400003', '640003', 'other'])
  })
})

describe('reading and applying the pick', () => {
  const candidates = ['6400003', '64000003']
  const answered = (probabilities: Record<string, number>) => ({
    seal_number: choice(probabilities),
  })

  it('stands on a clear pick, its characters at the pick certainty', () => {
    const pick = readSealPick(
      answered({ '6400003': 0.93, '64000003': 0.06, other: 0.01 }),
      candidates,
    )
    const seal = applySealPick({ ...reading('64000003'), alternative: '00003', candidates }, pick)
    expect(seal.value).toBe('6400003')
    expect(seal.certainty).toBe('Confident')
    expect(seal.characters.every((c) => c.certainty === 'Confident')).toBe(true)
    expect(seal.alternative).toBeUndefined()
    expect(seal.candidates).toBeUndefined()
  })

  it('keeps a torn pick at Likely with the other number as its alternative', () => {
    const pick = readSealPick(
      answered({ '64000003': 0.62, '6400003': 0.37, other: 0.01 }),
      candidates,
    )
    const seal = applySealPick(reading('64000003'), pick)
    expect(seal.value).toBe('64000003')
    expect(seal.certainty).toBe('Likely')
    expect(seal.alternative).toBe('6400003')
  })

  it('a level lower when the runner-up is within the margin', () => {
    const pick = readSealPick(answered({ '6400003': 0.5, '64000003': 0.45 }), candidates)
    expect(applySealPick(reading('64000003'), pick).certainty).toBe('Uncertain')
  })

  it('keeps the read at no better than Uncertain when none of the numbers was picked', () => {
    const pick = readSealPick(answered({ other: 0.8, '6400003': 0.2 }), candidates)
    expect(pick.value).toBeNull()
    const seal = applySealPick(reading('64000003', 'Confident'), pick)
    expect(seal.value).toBe('64000003')
    expect(seal.certainty).toBe('Uncertain')
    expect(seal.characters.every((c) => c.certainty === 'Uncertain')).toBe(true)
  })

  it('keeps the read when the pick is too weak to say', () => {
    const pick = readSealPick(
      answered({ '6400003': 0.25, '64000003': 0.24, other: 0.2 }),
      candidates,
    )
    expect(applySealPick(reading('64000003'), pick).value).toBe('64000003')
  })
})
