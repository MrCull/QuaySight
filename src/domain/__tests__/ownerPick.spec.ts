import { describe, it, expect } from 'vitest'
import { combineOwnerReading } from '../ownerPick'
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
})
