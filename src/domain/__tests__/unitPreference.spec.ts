import { describe, it, expect } from 'vitest'
import { DEFAULT_UNITS, readRememberedUnits, UNITS_KEY } from '../unitPreference'

describe('the remembered units', () => {
  it('start on Metric', () => {
    expect(DEFAULT_UNITS).toBe('metric')
    expect(readRememberedUnits(null)).toBe('metric')
    expect(readRememberedUnits(undefined)).toBe('metric')
  })

  it('restore either choice', () => {
    expect(readRememberedUnits('imperial')).toBe('imperial')
    expect(readRememberedUnits('metric')).toBe('metric')
  })

  it('fall back to Metric for anything else a browser might hold', () => {
    expect(readRememberedUnits('')).toBe('metric')
    expect(readRememberedUnits('Imperial')).toBe('metric')
    expect(readRememberedUnits('{"units":"imperial"}')).toBe('metric')
  })

  it('are stored under a key of their own', () => {
    expect(UNITS_KEY).toBe('quay-sight.units')
  })
})
