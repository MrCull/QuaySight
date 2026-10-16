import { describe, it, expect } from 'vitest'
import { questionSetAsk } from '../questionSetAsk'
import { questionSet, QuestionSetError, type AnswersReading } from '../questionSet'
import { LunaError } from '../luna'
import { OpenRouterError } from '../openrouter'

const PHOTO = 'data:image/jpeg;base64,AAAA'
const SET = questionSet('Freight container photo.', [
  { type: 'predicate', name: 'door_end', instructions: 'Is the door end in view?' },
])
const openAi = { model: 'gpt-6-luna', entry: { wireFormat: 'openai-decisions' as const } }
const openRouter = {
  model: '~typesafe/jev-latest',
  entry: { wireFormat: 'openrouter-decisions' as const },
}

describe('questionSetAsk', () => {
  const ask = questionSetAsk(SET, (reply: AnswersReading) => reply)

  it("builds the route's own wire format from the shared set", () => {
    expect(ask.build({ route: openAi, imageDataUrl: PHOTO })).toMatchObject({
      model: 'gpt-6-luna',
      questions: [{ type: 'predicate', name: 'door_end' }],
    })
    expect(ask.build({ route: openRouter, imageDataUrl: PHOTO })).toMatchObject({
      model: '~typesafe/jev-latest',
      questions: { door_end: { type: 'noul' } },
    })
  })

  it('refuses, while building and so before anything is sent, a set over the route’s limit', () => {
    const tooMany = questionSet(
      'x',
      Array.from({ length: 201 }, (_, i) => ({
        type: 'predicate' as const,
        name: `q${i}`,
        instructions: 'y',
      })),
    )
    expect(() =>
      questionSetAsk(tooMany, (r) => r).build({ route: openRouter, imageDataUrl: PHOTO }),
    ).toThrow(QuestionSetError)
  })

  it('reads either route’s reply into the same typed answers', () => {
    const fromOpenAi = ask.map(
      { answers: [{ type: 'predicate', name: 'door_end', probability: 0.9 }] },
      openAi,
    )
    const fromOpenRouter = ask.map(
      { answers: { door_end: { type: 'noul', noul: 0.9 } }, usage: { cost: 0.0001 } },
      openRouter,
    )
    expect(fromOpenAi.answers).toEqual({ door_end: { type: 'predicate', probability: 0.9 } })
    expect(fromOpenRouter.answers).toEqual(fromOpenAi.answers)
    expect(fromOpenAi.resolvedModel).toBe('gpt-6-luna')
    expect(fromOpenRouter.reportedCostUsd).toBe(0.0001)
  })

  it("words an unreadable reply in the route's own terms", () => {
    expect(() => ask.map({}, openAi)).toThrow(LunaError)
    expect(() => ask.map({}, openRouter)).toThrow(OpenRouterError)
  })
})
