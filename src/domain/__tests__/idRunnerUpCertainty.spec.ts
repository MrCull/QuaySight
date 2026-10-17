import { describe, it, expect } from 'vitest'
import { idQuestionName, readIdCharacters } from '../idQuestions'

type Answers = Parameters<typeof readIdCharacters>[0]

const choice = (value: string, probabilities: Record<string, number>) =>
  ({ type: 'choice', value, probabilities }) as unknown as Answers[string]

describe('reading one character', () => {
  it("sets the runner-up's own certainty from its probability", () => {
    const readings = readIdCharacters({
      [idQuestionName(5)]: choice('2', { '2': 0.65, '7': 0.32 }),
    })
    expect(readings[4]).toMatchObject({ value: '2', runnerUp: '7', runnerUpCertainty: 'Uncertain' })
  })

  it('has no runner-up certainty when there is no runner-up', () => {
    const readings = readIdCharacters({ [idQuestionName(5)]: choice('2', { '2': 0.97 }) })
    expect(readings[4]!.runnerUp).toBeNull()
    expect(readings[4]!.runnerUpCertainty).toBeUndefined()
  })
})
