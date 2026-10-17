import { describe, it, expect } from 'vitest'
import { buildContainerIdReading } from '../containerId'

// Spec 4.2: observed and calculated check digits both kept; a match is supporting evidence only.
describe('container ID reading with deterministic check digit', () => {
  it('keeps observed and calculated check digits when they match, and marks the digit valid', () => {
    const reading = buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Confident' })
    expect(reading.value).toBe('APHU6586847')
    expect(reading.observedCheckDigit).toBe(7)
    expect(reading.calculatedCheckDigit).toBe(7)
    expect(reading.checkDigitValid).toBe(true)
  })

  it('keeps an invalid check digit visible, flags it, and never changes a visible character', () => {
    const reading = buildContainerIdReading({ printed: 'APHU6586848', certainty: 'Likely' })
    expect(reading.value).toBe('APHU6586848')
    expect(reading.observedCheckDigit).toBe(8)
    expect(reading.calculatedCheckDigit).toBe(7)
    expect(reading.checkDigitValid).toBe(false)
    expect(reading.certainty).toBe('Uncertain')
  })

  it('caps a Confident reading at Uncertain when its check digit does not match', () => {
    const reading = buildContainerIdReading({ printed: 'APHU6586848', certainty: 'Confident' })
    expect(reading.certainty).toBe('Uncertain')
  })

  it('maps a remainder of 10 to a check digit of 0', () => {
    const reading = buildContainerIdReading({ printed: 'AAAZ1234560', certainty: 'Confident' })
    expect(reading.calculatedCheckDigit).toBe(0)
    expect(reading.checkDigitValid).toBe(true)
  })

  it('never raises a weak reading to Confident because the check digit matches', () => {
    const uncertain = buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Uncertain' })
    expect(uncertain.checkDigitValid).toBe(true)
    expect(uncertain.certainty).toBe('Uncertain')
    const cantTell = buildContainerIdReading({ printed: 'APHU6586847', certainty: "Can't tell" })
    expect(cantTell.certainty).toBe("Can't tell")
  })

  it('records no observed check digit when only ten characters are visible, and marks it not valid', () => {
    const reading = buildContainerIdReading({ printed: 'APHU658684', certainty: 'Likely' })
    expect(reading.observedCheckDigit).toBeNull()
    expect(reading.calculatedCheckDigit).toBe(7)
    expect(reading.checkDigitValid).toBe(false)
  })
})
