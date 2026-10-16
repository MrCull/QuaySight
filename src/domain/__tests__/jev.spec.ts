import { describe, it, expect } from 'vitest'
import {
  JEV_ENDPOINT,
  JEV_IMAGE_HEADER,
  JEV_IMAGE_REF,
  JevError,
  buildJevRequest,
  jevFailure,
  jevPhotoFormat,
  mapJevResponse,
} from '../jev'
import { UNREAD } from '../certainty'

const KEY = 'test-only-key-value-0000'
const ID = ['A', 'P', 'H', 'U', '6', '5', '8', '6', '8', '4', '7']

function answersFor(chars: string[], probability = 0.95) {
  const answers: Record<string, unknown> = {}
  chars.forEach((ch, i) => {
    const key = `id_char_${String(i + 1).padStart(2, '0')}`
    answers[key] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: probability, unreadable: 1 - probability },
      confidence: probability,
    }
  })
  answers.legibility = {
    type: 'score',
    score: 3.8,
    legend: { '0': 'a', '1': 'b', '2': 'c', '3': 'd', '4': 'e' },
    probabilities: { '3': 0.2, '4': 0.8 },
    confidence: 0.8,
  }
  answers.full_number_visible = { type: 'noul', noul: 0.97 }
  return answers
}

function okBody(overrides: Record<string, unknown> = {}) {
  return {
    model: 'jev-1.13.0',
    answers: answersFor(ID),
    usage: { input_tokens: 1234, output_tokens: 0 },
    ...overrides,
  }
}

describe('buildJevRequest', () => {
  it('uses the System One endpoint and the experimental image header', () => {
    expect(JEV_ENDPOINT).toBe('https://api.typesafe.ai/v1/systemone')
    expect(JEV_IMAGE_HEADER).toBe('TypeSafe-Danger-Zone-Images')
  })

  it('sends the requested model, the image asset by reference and no box question for a non-box model', () => {
    const body = buildJevRequest('jev-latest', 'jpeg')
    expect(body.model).toBe('jev-latest')
    expect(body.assets).toEqual({
      [JEV_IMAGE_REF]: { type: 'image', part: JEV_IMAGE_REF, format: 'jpeg' },
    })
    expect(JSON.stringify(body.state)).toContain(JEV_IMAGE_REF)
    expect(Object.values(body.questions).some((q) => q.type === 'box')).toBe(false)
  })

  it('asks one choice question per identification position with an unreadable option', () => {
    const { questions } = buildJevRequest('jev-latest', 'png')
    for (let i = 1; i <= 11; i++) {
      const q = questions[`id_char_${String(i).padStart(2, '0')}`]
      expect(q?.type).toBe('choice')
      if (q?.type !== 'choice') throw new Error('not choice')
      expect(Object.keys(q.criteria)).toContain('unreadable')
    }
    const q1 = questions.id_char_01
    if (q1?.type !== 'choice') throw new Error('not choice')
    expect(Object.keys(q1.criteria)).toHaveLength(27)
  })

  it('adds the score and noul questions used for the shared contract', () => {
    const { questions } = buildJevRequest('jev-latest', 'jpeg')
    expect(questions.legibility?.type).toBe('score')
    expect(questions.full_number_visible?.type).toBe('noul')
  })

  it('adds the box question only when the caller asks for it', () => {
    expect(buildJevRequest('jev-1.14.0', 'jpeg', { box: true }).questions.container_box?.type).toBe(
      'box',
    )
    expect(buildJevRequest('jev-1.14.0', 'jpeg').questions.container_box).toBeUndefined()
    expect(
      buildJevRequest('jev-1.13.0', 'jpeg', { box: false }).questions.container_box,
    ).toBeUndefined()
  })
})

describe('jevPhotoFormat', () => {
  it('accepts only PNG and JPEG, which Jev takes', () => {
    expect(jevPhotoFormat('image/jpeg')).toBe('jpeg')
    expect(jevPhotoFormat('image/png')).toBe('png')
    expect(jevPhotoFormat('image/webp')).toBeNull()
  })
})

describe('mapJevResponse', () => {
  it('maps the identification answers to the shared reading, records the resolved model and usage', () => {
    const result = mapJevResponse(okBody(), 'jev-latest')
    expect(result.containerId.value).toBe('APHU6586847')
    expect(result.containerId.checkDigitValid).toBe(true)
    expect(result.containerId.certainty).toBe('Confident')
    expect(result.resolvedModel).toBe('jev-1.13.0')
    expect(result.usage).toEqual({ inputTokens: 1234, outputTokens: 0 })
  })

  it('reports cost as null when the response carries no cost field, never zero', () => {
    expect(mapJevResponse(okBody(), 'jev-latest').reportedCostUsd).toBeNull()
  })

  it('reads a reported cost only when the response actually provides one', () => {
    const body = okBody({ usage: { input_tokens: 10, output_tokens: 0, cost: 0.0000004 } })
    expect(mapJevResponse(body, 'jev-latest').reportedCostUsd).toBe(0.0000004)
  })

  it('keeps an unreadable position as unread and never fills it in', () => {
    const chars = [...ID]
    chars[3] = 'unreadable'
    const body = okBody({ answers: answersFor(chars) })
    const result = mapJevResponse(body, 'jev-latest')
    expect(result.containerId.value).toContain(UNREAD)
    expect(result.containerId.value.charAt(3)).toBe(UNREAD)
  })

  it('leaves the calculated check digit unavailable (null), never zero, when the first ten characters are not all read', () => {
    const chars = [...ID]
    chars[2] = 'unreadable'
    const result = mapJevResponse(okBody({ answers: answersFor(chars) }), 'jev-latest')
    expect(result.containerId.value.charAt(2)).toBe(UNREAD)
    expect(result.containerId.observedCheckDigit).toBe(7)
    expect(result.containerId.calculatedCheckDigit).toBeNull()
    expect(result.containerId.checkDigitValid).toBe(false)
  })

  it('does not read a position as Confident when the runner-up is within the margin (0.90 against 0.88)', () => {
    const answers = answersFor(ID) as Record<string, unknown>
    answers.id_char_10 = {
      type: 'choice',
      choice: '4',
      probabilities: { '4': 0.9, '1': 0.88 },
      confidence: 0.9,
    }
    const result = mapJevResponse(okBody({ answers }), 'jev-latest')
    expect(result.containerId.positionCertainty?.[9]).toBe('Likely')
    expect(result.containerId.certainty).toBe('Likely')
  })

  it('caps the certainty to Uncertain when the score says the identification is hard to read', () => {
    const body = okBody()
    ;(body.answers as Record<string, unknown>).legibility = {
      type: 'score',
      score: 0.4,
      legend: {},
      probabilities: { '0': 0.6, '1': 0.4 },
      confidence: 0.7,
    }
    const result = mapJevResponse(body, 'jev-latest')
    expect(result.containerId.certainty).toBe('Uncertain')
  })

  it('returns a box answer when the model supplies one, and null otherwise', () => {
    expect(mapJevResponse(okBody(), 'jev-latest').box).toBeNull()
    const body = okBody()
    ;(body.answers as Record<string, unknown>).container_box = {
      type: 'box',
      box: { top: 0.1, bottom: 0.4, left: 0.2, right: 0.6 },
      confidence: 0.9,
    }
    expect(mapJevResponse(body, 'jev-1.14.0').box).toEqual({
      top: 0.1,
      bottom: 0.4,
      left: 0.2,
      right: 0.6,
      confidence: 0.9,
    })
  })

  it('falls back to the requested model when the response reports none', () => {
    const body = okBody({ model: undefined })
    expect(mapJevResponse(body, 'jev-latest').resolvedModel).toBe('jev-latest')
  })

  it('rejects a response without answers as a bad response', () => {
    expect(() => mapJevResponse({ model: 'jev-1.13.0' }, 'jev-latest')).toThrow(JevError)
  })
})

describe('jevFailure', () => {
  it('tells the presenter the key must be a TypeSafe console key on a 401, without echoing it', () => {
    const error = jevFailure(401, { error: { message: `bad ${KEY}` } }, KEY)
    expect(error.status).toBe(401)
    expect(error.message).toMatch(/TypeSafe console key/)
    expect(error.message).not.toContain(KEY)
  })

  it('explains the context limit for max_tokens_exceeded', () => {
    const error = jevFailure(
      400,
      { error: { code: 'max_tokens_exceeded', message: 'too long' } },
      KEY,
    )
    expect(error.message).toMatch(/context/i)
  })

  it('names the image rules on a rejected photo', () => {
    const error = jevFailure(400, { error: { message: 'image rejected' } }, KEY)
    expect(error.message).toMatch(/PNG or JPEG/)
    expect(error.message).toMatch(/280/)
  })

  it('reports a payload too large, rate limiting and overload clearly', () => {
    expect(jevFailure(413, {}, KEY).message).toMatch(/too large/i)
    expect(jevFailure(429, {}, KEY).message).toMatch(/rate limit/i)
    expect(jevFailure(529, {}, KEY).message).toMatch(/overloaded/i)
  })

  it('removes a key echoed in a provider message', () => {
    const error = jevFailure(404, { error: { message: `question ${KEY} is malformed` } }, KEY)
    expect(error.message).not.toContain(KEY)
    expect(error.message).toContain('[key removed]')
  })
})
