import { describe, it, expect } from 'vitest'
import { orientationOf } from '../readPhoto'

describe('orientationOf', () => {
  it('reports landscape when wider than tall', () => {
    expect(orientationOf(2000, 1500)).toBe('landscape')
  })

  it('reports portrait when taller than wide', () => {
    expect(orientationOf(1000, 1600)).toBe('portrait')
  })

  it('reports square for equal sides and unknown for missing dimensions', () => {
    expect(orientationOf(800, 800)).toBe('square')
    expect(orientationOf(0, 0)).toBe('unknown')
  })
})
