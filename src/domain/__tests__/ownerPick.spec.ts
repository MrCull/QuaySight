import { describe, it, expect } from 'vitest'
import { combineOwnerReading } from '../ownerPick'
import { OWNER_CODES } from '../ownerCodes'
import type { ChoiceReading } from '../idQuestions'

const read = (id: string): ChoiceReading[] =>
  id.split('').map((value) => ({ value, certainty: 'Likely', runnerUp: null }))

describe('near matches in the owner-code list', () => {
  it('offers at most six listed prefixes, however many are close to the letters', () => {
    // TCX is one or two letters from dozens of listed prefixes (TCN, TCB, TCK, TXT, ...).
    const { alternatives } = combineOwnerReading(read('TCXU6921109'), {
      code: null,
      certainty: 'Uncertain',
    })
    expect(alternatives).toHaveLength(6)
    expect(alternatives).not.toContain('TCX')
  })

  it('breaks a tie between equally near prefixes by rank, best rank first', () => {
    // The nearest prefixes to "ZZZ" are one letter away (CZZ); the next ones are two away. Among those two-away
    // prefixes the best-ranked come first.
    const letters = 'ZZZ'
    const away = (p: string) => [...p].filter((ch, i) => ch !== letters[i]).length
    const prefixes = OWNER_CODES.map((c) => c.slice(0, 3))
    const { alternatives } = combineOwnerReading(read('ZZZU6921109'), {
      code: null,
      certainty: 'Uncertain',
    })
    const expected = [
      ...prefixes.filter((p) => away(p) === 1),
      ...prefixes.filter((p) => away(p) === 2),
    ].slice(0, 6)
    expect(alternatives).toEqual(expected)
    expect(alternatives.slice(1)).toEqual(['ZIM', 'MSZ', 'APZ', 'COZ', 'AMZ'])
  })

  it('counts a listed code outside the top 250 as a near match', () => {
    const outside = OWNER_CODES[450]!
    const wrong = outside.slice(0, 2) + (outside[2] === 'Q' ? 'X' : 'Q')
    const { alternatives } = combineOwnerReading(read(`${wrong}U6921109`), {
      code: null,
      certainty: 'Uncertain',
    })
    expect(alternatives).toContain(outside.slice(0, 3))
  })

  it('never lets rank override the reading: a Confident pick of a low-ranked code still stands', () => {
    const lowRanked = OWNER_CODES[450]!
    const { readings } = combineOwnerReading(read('MSCU6921109'), {
      code: lowRanked,
      certainty: 'Confident',
    })
    expect(
      readings
        .slice(0, 4)
        .map((r) => r.value)
        .join(''),
    ).toBe(lowRanked)
  })
})
