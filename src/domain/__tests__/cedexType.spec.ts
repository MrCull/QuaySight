import { describe, expect, it } from 'vitest'
import { cedexType, cedexTypeDescription } from '../cedexType'

describe('a finding’s CEDEX damage type', () => {
  it('names the best type when it is probable enough, with the others as alternatives', () => {
    const reading = cedexType({
      types: [
        { code: 'DT', name: 'Dent', probability: 0.82 },
        { code: 'BT', name: 'Bent', probability: 0.3 },
      ],
    })
    expect(reading.best?.code).toBe('DT')
    expect(reading.others.map((t) => t.code)).toEqual(['BT'])
  })

  it('does not force a code below the bar: every candidate is listed instead', () => {
    const reading = cedexType({
      types: [
        { code: 'DT', name: 'Dent', probability: 0.4 },
        { code: 'BW', name: 'Bowed', probability: 0.3 },
      ],
    })
    expect(reading.best).toBeNull()
    expect(reading.others.map((t) => t.code)).toEqual(['DT', 'BW'])
  })

  it('takes a type with no recorded probability as given', () => {
    expect(
      cedexType({ types: [{ code: 'HO', name: 'Holed', probability: null }] }).best?.code,
    ).toBe('HO')
    expect(cedexType({ types: [] })).toEqual({ best: null, others: [] })
  })

  it('describes each code in plain words', () => {
    expect(cedexTypeDescription('CH')).toContain('through the material')
    expect(cedexTypeDescription('ZZ')).toBeNull()
  })
})
