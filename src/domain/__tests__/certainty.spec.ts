import { describe, it, expect } from 'vitest'
import {
  CERTAINTY_LABELS,
  MAX_ALTERNATIVES,
  idResultState,
  visibleAlternatives,
} from '../certainty'
import type { ContainerIdReading } from '../inspection'

function reading(overrides: Partial<ContainerIdReading> = {}): ContainerIdReading {
  return {
    value: 'APHU6586847',
    observedCheckDigit: 7,
    calculatedCheckDigit: 7,
    checkDigitValid: true,
    certainty: 'Confident',
    provenance: 'printed',
    ...overrides,
  }
}

describe('certainty labels', () => {
  it('are exactly the five fixed words, in order of confidence', () => {
    expect([...CERTAINTY_LABELS]).toEqual([
      'Confident',
      'Likely',
      'Uncertain',
      "Can't tell",
      'Not seen',
    ])
  })
})

describe('visibleAlternatives', () => {
  it('shows at most two alternatives', () => {
    const r = reading({ alternatives: ['APHU6586841', 'APHU6586842', 'APHU6586843'] })
    expect(MAX_ALTERNATIVES).toBe(2)
    expect(visibleAlternatives(r)).toEqual(['APHU6586841', 'APHU6586842'])
  })

  it('drops an alternative that repeats the best reading or another alternative', () => {
    const r = reading({ alternatives: ['APHU6586847', 'APHU6586841', 'APHU6586841'] })
    expect(visibleAlternatives(r)).toEqual(['APHU6586841'])
  })

  it('returns nothing when no alternatives were supplied', () => {
    expect(visibleAlternatives(reading())).toEqual([])
  })
})

describe('idResultState', () => {
  it('is settled for a full reading that is Confident or Likely', () => {
    expect(idResultState(reading({ certainty: 'Confident' }))).toBe('settled')
    expect(idResultState(reading({ certainty: 'Likely' }))).toBe('settled')
  })

  it('is uncertain when the best reading is Uncertain', () => {
    expect(idResultState(reading({ certainty: 'Uncertain' }))).toBe('uncertain')
  })

  it('is partial when some positions were not read', () => {
    expect(idResultState(reading({ value: 'APHU65868?', certainty: 'Likely' }))).toBe('partial')
  })

  it('is partial with 6 of the 11 characters read, insufficient with 5', () => {
    expect(idResultState(reading({ value: 'APHU65?????', certainty: 'Likely' }))).toBe('partial')
    expect(idResultState(reading({ value: 'APHU6??????', certainty: 'Likely' }))).toBe(
      'insufficient',
    )
  })

  it('is insufficient when no character can be read at all', () => {
    expect(idResultState(reading({ value: '?????????????', certainty: "Can't tell" }))).toBe(
      'insufficient',
    )
  })
})
