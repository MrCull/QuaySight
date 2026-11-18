import { describe, it, expect } from 'vitest'
import { readSizeCode } from '../containerDetails'
import { containerDetailQuestions } from '../containerDetailQuestions'
import { DETAIL_QUESTION_NAMES } from '../containerDetailTypes'
import type { ChoiceQuestion, SharedAnswer } from '../questionSet'

// A size/type code that is not one of the common codes has no choice of its own, so its two halves
// (size, type) are asked too. Live (18 Nov 2026), GPT-6 Luna read single characters of 45G1 as 44GG but
// both halves at 0.98; and with the code missing from the list it chose a near common code at low
// probability rather than "other". The halves decide when they are more certain.

const answer = (value: string, p = 0.98, others: Record<string, number> = {}): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p, ...others },
  confidence: p,
})
const halves = (size: string, type: string, p = 0.98) => [answer(size, p), answer(type, p)]

describe('the size/type code read in its two halves', () => {
  it('asks the size half and the type half, each from the pairs the decoding table knows', () => {
    const questions = containerDetailQuestions()
    const [size, type] = DETAIL_QUESTION_NAMES.sizeCodeParts.map(
      (name) => questions.find((q) => q.name === name) as ChoiceQuestion,
    )
    expect(size!.choices.map((c) => c.value)).toEqual(expect.arrayContaining(['45', '22', 'L5']))
    expect(type!.choices.map((c) => c.value)).toEqual(expect.arrayContaining(['G1', 'R1', 'U6']))
    expect(type!.choices.map((c) => c.value)).not.toContain('1G')
  })

  it('shows a code that is not common when the answer is "other"', () => {
    const reading = readSizeCode(answer('other'), halves('25', 'R1'))
    expect(reading).toMatchObject({ state: 'read', code: '25R1', certainty: 'Confident' })
    expect(reading.decoded?.summary).toBe('20 ft High Cube, reefer')
  })

  it('overrules a near common code chosen at low probability, keeping it as the alternative', () => {
    const reading = readSizeCode(answer('20G1', 0.48, { '20G0': 0.07 }), halves('22', 'G1', 0.9))
    expect(reading).toMatchObject({ code: '22G1', certainty: 'Confident', alternative: '20G1' })
  })

  it('keeps a confident common code the halves agree with', () => {
    const reading = readSizeCode(answer('45G1', 0.95), halves('45', 'G1'))
    expect(reading).toMatchObject({ code: '45G1', certainty: 'Confident' })
  })

  it('keeps a confident common code over halves no more certain', () => {
    expect(readSizeCode(answer('22G1', 0.99), halves('22', 'G0')).code).toBe('22G1')
  })

  it('takes the weaker certainty of the two halves', () => {
    const reading = readSizeCode(answer('other'), [answer('25', 0.98), answer('R1', 0.7)])
    expect(reading).toMatchObject({ code: '25R1', certainty: 'Likely' })
  })

  it('stays "not one of the common codes" when a half is below Likely or unreadable', () => {
    expect(readSizeCode(answer('other'), [answer('25'), answer('R1', 0.4)]).state).toBe('other')
    expect(readSizeCode(answer('other'), [answer('25'), answer('unreadable')]).state).toBe('other')
  })

  it('says not visible when the whole-code answer says so, whatever the halves say', () => {
    expect(readSizeCode(answer('not_visible'), halves('22', 'G1')).state).toBe('not-visible')
  })
})
