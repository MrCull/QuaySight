import { describe, it, expect } from 'vitest'
import { calculateCheckDigit, checkDigitMatches } from '../iso6346'

// Worked values from the spec (section 4.2): letter values start at A=10 and skip multiples of 11.
describe('ISO 6346 check digit', () => {
  it('calculates the check digit for a known-good owner code and serial', () => {
    expect(calculateCheckDigit('CSQU305438')).toBe(3)
  })

  it('calculates the check digit for the APHU sample prefix and serial', () => {
    expect(calculateCheckDigit('APHU658684')).toBe(7)
  })

  it('calculates the check digit for the CHSU sample prefix and serial', () => {
    expect(calculateCheckDigit('CHSU205183')).toBe(1)
  })

  it('maps remainder 10 to 0', () => {
    // Worked example: weighted sum of AAAZ123456 gives remainder 10, displayed as 0.
    expect(calculateCheckDigit('AAAZ123456')).toBe(0)
  })

  it('reports whether a printed check digit matches the calculated one', () => {
    expect(checkDigitMatches('APHU6586847')).toBe(true)
    expect(checkDigitMatches('APHU6586848')).toBe(false)
  })
})
