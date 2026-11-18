import { describe, it, expect } from 'vitest'
import { readSizeCode } from '../containerDetails'
import { containerDetailQuestions } from '../containerDetailQuestions'
import { DETAIL_QUESTION_NAMES } from '../containerDetailTypes'
import type { SharedAnswer } from '../questionSet'

// A size/type code that is not one of the common codes is asked character by character too: read in
// full at Confident it still shows, and decodes when the app's table knows it.

const answer = (value: string, p = 0.99): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p },
  confidence: p,
})
const chars = (code: string, p = 0.99) => [...code].map((c) => answer(c, p))

describe('a size/type code that is not one of the common codes', () => {
  it('asks each of its four characters on its own', () => {
    const names = containerDetailQuestions().map((q) => q.name)
    for (const name of DETAIL_QUESTION_NAMES.sizeCodeCharacters) expect(names).toContain(name)
  })

  it('shows a code read in full at Confident, decoded from the table', () => {
    const reading = readSizeCode(answer('other'), chars('25R1'))
    expect(reading).toMatchObject({ state: 'read', code: '25R1', certainty: 'Confident' })
    expect(reading.decoded?.summary).toBe('20 ft High Cube, reefer')
  })

  it('shows a code the app cannot decode, still read at Confident', () => {
    const reading = readSizeCode(answer('other'), chars('2ZG1'))
    expect(reading).toMatchObject({ state: 'read', code: '2ZG1', decoded: null })
  })

  it('stays "not a common code" when any character is below Confident', () => {
    const characters = [...chars('25R'), answer('1', 0.7)]
    expect(readSizeCode(answer('other'), characters).state).toBe('other')
  })

  it('stays "not a common code" when the whole-code answer is below Confident', () => {
    expect(readSizeCode(answer('other', 0.7), chars('25R1')).state).toBe('other')
  })

  it('stays "not a common code" when a character is unreadable', () => {
    expect(readSizeCode(answer('other'), [...chars('25R'), answer('unreadable')]).state).toBe(
      'other',
    )
  })

  it('keeps the common code when one is chosen, whatever the characters say', () => {
    expect(readSizeCode(answer('22G1'), chars('45G1')).code).toBe('22G1')
  })
})
