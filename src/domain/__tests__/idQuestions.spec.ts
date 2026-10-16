import { describe, it, expect } from 'vitest'
import { jevIdQuestionSet, lunaIdQuestionSet } from '../idQuestions'
import { buildLunaRequest, mapLunaResponse } from '../luna'
import { buildOpenRouterJevRequest, buildOpenRouterLunaRequest } from '../openrouter'
import { buildJevRequest } from '../jev'
import type { ChoiceQuestion } from '../questionSet'

const PHOTO = 'data:image/jpeg;base64,AAAA'

/** Every character question the app can send, on every route, for the ID and the Luna re-check. */
function everyIdRequest(): unknown[] {
  return [
    buildLunaRequest(PHOTO),
    buildLunaRequest(PHOTO, [3, 7, 11]),
    buildOpenRouterLunaRequest('openai/gpt-6-luna-decisions', PHOTO),
    buildOpenRouterLunaRequest('openai/gpt-6-luna-decisions', PHOTO, [9]),
    buildOpenRouterJevRequest('~typesafe/jev-latest', PHOTO, { box: true }),
    buildJevRequest('jev-latest', 'jpeg', { box: true }),
  ]
}

function instructionsOf(position: number): string[] {
  const name = `id_char_${String(position).padStart(2, '0')}`
  return [lunaIdQuestionSet(), jevIdQuestionSet({ image: 'the photo', box: false })].map((set) => {
    const question = set.questions.find((q) => q.name === name)
    return question?.instructions ?? ''
  })
}

describe('ID character questions', () => {
  it('describe the printed layout in every character question', () => {
    for (let position = 1; position <= 11; position++) {
      for (const text of instructionsOf(position)) {
        expect(text).toMatch(/four capital letters/)
        expect(text).toMatch(/a gap/)
        expect(text).toMatch(/six-digit group/)
        expect(text).toMatch(/single digit in a drawn box/)
      }
    }
  })

  it.each([
    [1, 'Read only the first letter of the four-letter group.'],
    [3, 'Read only the third letter of the four-letter group.'],
    [4, 'Read only the fourth letter of the four-letter group.'],
    [5, 'Read only the first digit of the six-digit group.'],
    [7, 'Read only the third digit of the six-digit group.'],
    [10, 'Read only the sixth digit of the six-digit group.'],
    [11, 'Read only the single digit in the drawn box, exactly as printed.'],
  ])('name position %i by its place in its group', (position, place) => {
    for (const text of instructionsOf(position)) expect(text).toContain(place)
  })

  it('never put the check-digit calculation in front of the model, on any route', () => {
    for (const request of everyIdRequest()) {
      const sent = JSON.stringify(request)
      expect(sent).not.toMatch(/modulo|remainder|A=10|multiply|multiples of 11|512/i)
      expect(sent).not.toMatch(/calculate/i)
    }
  })

  it('offer letters for the four-letter group and digits elsewhere, as choice objects', () => {
    const questions = lunaIdQuestionSet().questions as ChoiceQuestion[]
    expect(questions[0]!.choices).toHaveLength(26)
    expect(questions[0]!.choices[0]).toEqual({ value: 'A', description: 'Letter A' })
    expect(questions[10]!.choices.map((c) => c.value)).toEqual('0123456789'.split(''))
  })
})

describe('check-digit validation stays in the app', () => {
  const answer = (index: number, value: string) => ({
    type: 'choice',
    name: `id_char_${String(index + 1).padStart(2, '0')}`,
    choice: value,
    probabilities: [{ value, probability: 0.97 }],
  })

  it('accepts COYU 266813 0, whose check digit is right', () => {
    const answers = 'COYU2668130'.split('').map((ch, i) => answer(i, ch))
    expect(mapLunaResponse({ answers }, 'gpt-6-luna').containerId).toMatchObject({
      value: 'COYU2668130',
      calculatedCheckDigit: 0,
      checkDigitValid: true,
      certainty: 'Confident',
    })
  })

  it('flags the misreading COYU 266113 0, whose check digit fails, and does not keep it Confident', () => {
    const answers = 'COYU2661130'.split('').map((ch, i) => answer(i, ch))
    const reading = mapLunaResponse({ answers }, 'gpt-6-luna').containerId
    expect(reading.checkDigitValid).toBe(false)
    expect(reading.value).toBe('COYU2661130')
    expect(reading.certainty).toBe('Likely')
  })
})
