import { describe, it, expect } from 'vitest'
import { checkWeights } from '../weights'

// Worked example from the sample photo (samples/rear-door-aphu-45g1.jpg): MAX GROSS 32,500 kg, TARE 3,870 kg, NET 28,630 kg.
describe('weight rows and gross minus tare arithmetic', () => {
  it('keeps maximum gross and tare as printed rows and calculates payload from them', () => {
    const result = checkWeights({
      maxGrossKg: 32500,
      tareKg: 3870,
      printedNetKg: 28630,
      certainty: 'Confident',
    })
    expect(result.maxGross).toEqual({
      valueKg: 32500,
      provenance: 'printed',
      certainty: 'Confident',
    })
    expect(result.tare).toEqual({ valueKg: 3870, provenance: 'printed', certainty: 'Confident' })
    expect(result.payload).toEqual({
      valueKg: 28630,
      provenance: 'calculated',
      certainty: 'Confident',
    })
    expect(result.conflict).toBeNull()
  })

  it('calculates no payload when tare is missing', () => {
    const result = checkWeights({
      maxGrossKg: 32500,
      tareKg: null,
      printedNetKg: null,
      certainty: 'Confident',
    })
    expect(result.payload).toBeNull()
    expect(result.tare).toBeNull()
    expect(result.conflict).toBeNull()
  })

  it('calculates no payload when maximum gross is missing', () => {
    const result = checkWeights({
      maxGrossKg: null,
      tareKg: 3870,
      printedNetKg: null,
      certainty: 'Likely',
    })
    expect(result.payload).toBeNull()
  })

  it('labels a calculated payload with the weaker of its two inputs, never higher', () => {
    const result = checkWeights({
      maxGrossKg: 32500,
      tareKg: 3870,
      printedNetKg: null,
      certainty: 'Uncertain',
    })
    expect(result.payload?.certainty).toBe('Uncertain')
  })

  it('flags a conflict when printed net disagrees with gross minus tare, and does not hide either value', () => {
    const result = checkWeights({
      maxGrossKg: 32500,
      tareKg: 3870,
      printedNetKg: 28000,
      certainty: 'Confident',
    })
    expect(result.conflict).toContain('28,000 kg')
    expect(result.conflict).toContain('28,630 kg')
    expect(result.payload?.valueKg).toBe(28630)
    expect(result.payload?.certainty).toBe('Uncertain')
  })

  it('does not raise a conflict when printed net is absent', () => {
    const result = checkWeights({
      maxGrossKg: 32500,
      tareKg: 3870,
      printedNetKg: null,
      certainty: 'Confident',
    })
    expect(result.conflict).toBeNull()
  })
})
