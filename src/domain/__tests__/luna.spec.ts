import { describe, it, expect } from 'vitest'
import {
  CHECK_DIGIT_GUIDANCE,
  LUNA_ENDPOINT,
  LUNA_MODEL,
  buildLunaRequest,
  lunaFailure,
  lunaFetchFailure,
  mapLunaResponse,
  LunaError,
} from '../luna'

const DATA_URL = 'data:image/jpeg;base64,AAAA'

// Hand-written answers for APHU658684 with check digit 7. Expected values are the spec's, not derived from the code.
const ID = ['A', 'P', 'H', 'U', '6', '5', '8', '6', '8', '4', '7']

function choiceAnswer(index: number, chosen: string, probability: number, extra: unknown[] = []) {
  return {
    type: 'choice',
    name: `id_char_${String(index + 1).padStart(2, '0')}`,
    choice: chosen,
    probabilities: [{ value: chosen, probability }, ...extra],
    confidence: probability,
  }
}

function fullResponse(overrides: Partial<Record<number, unknown>> = {}) {
  return {
    answers: ID.map((ch, i) => overrides[i] ?? choiceAnswer(i, ch, 0.95)),
  }
}

describe('Luna request', () => {
  it('posts to the Decisions endpoint with the pinned model', () => {
    expect(LUNA_ENDPOINT).toBe('https://api.openai.com/v1/decisions')
    expect(LUNA_MODEL).toBe('gpt-6-luna')
    expect(buildLunaRequest(DATA_URL).model).toBe('gpt-6-luna')
  })

  it('sends the photo as an inline data URL with its real MIME type', () => {
    const body = buildLunaRequest(DATA_URL)
    const content = body.input[0]!.content
    expect(content.find((part) => part.type === 'input_image')).toEqual({
      type: 'input_image',
      image_url: DATA_URL,
    })
  })

  it('includes the spec check-digit guidance verbatim in the identification instructions', () => {
    const text = buildLunaRequest(DATA_URL).input[0]!.content.find(
      (part) => part.type === 'input_text',
    )
    expect(text?.type === 'input_text' && text.text).toContain(CHECK_DIGIT_GUIDANCE)
    expect(CHECK_DIGIT_GUIDANCE).toContain('Remainder 10 is displayed as 0.')
    expect(CHECK_DIGIT_GUIDANCE).toContain('do not invent or change clearly visible characters')
  })

  it('asks eleven named choice questions: letters for positions 1-4, digits for 5-11', () => {
    const { questions } = buildLunaRequest(DATA_URL)
    expect(questions).toHaveLength(11)
    expect(questions.map((q) => q.name)).toEqual(
      Array.from({ length: 11 }, (_, i) => `id_char_${String(i + 1).padStart(2, '0')}`),
    )
    const letters = questions[0]!
    expect(letters.type).toBe('choice')
    expect(letters.type === 'choice' && letters.choices.map((c) => c.value)).toHaveLength(26)
    const check = questions[10]!
    expect(check.type === 'choice' && check.choices.map((c) => c.value)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ])
  })
})

describe('Luna response mapping', () => {
  it('maps a full reading to the shared record with the check digit validated', () => {
    const mapped = mapLunaResponse(fullResponse(), 'gpt-6-luna')
    expect(mapped.containerId.value).toBe('APHU658684' + '7')
    expect(mapped.containerId.observedCheckDigit).toBe(7)
    expect(mapped.containerId.calculatedCheckDigit).toBe(7)
    expect(mapped.containerId.checkDigitValid).toBe(true)
    expect(mapped.containerId.certainty).toBe('Confident')
    expect(mapped.containerId.provenance).toBe('printed')
  })

  it('keeps unread positions as ? and never fills them in', () => {
    const mapped = mapLunaResponse(
      fullResponse({ 4: { type: 'refusal', name: 'id_char_05' } }),
      'gpt-6-luna',
    )
    expect(mapped.containerId.value).toBe('APHU?586847')
    expect(mapped.containerId.checkDigitValid).toBe(false)
  })

  it('treats a missing answer as an unread position', () => {
    const response = { answers: fullResponse().answers.slice(0, 8) }
    const mapped = mapLunaResponse(response, 'gpt-6-luna')
    expect(mapped.containerId.value).toBe('APHU6586???')
    expect(mapped.containerId.certainty).toBe("Can't tell")
    expect(mapped.containerId.checkDigitValid).toBe(false)
  })

  it('leaves the calculated check digit unavailable (null), never zero, when the first ten characters are not all read', () => {
    const mapped = mapLunaResponse(
      fullResponse({ 2: { type: 'refusal', name: 'id_char_03' } }),
      'gpt-6-luna',
    )
    expect(mapped.containerId.value).toBe('AP?U6586847')
    expect(mapped.containerId.observedCheckDigit).toBe(7)
    expect(mapped.containerId.calculatedCheckDigit).toBeNull()
    expect(mapped.containerId.checkDigitValid).toBe(false)
  })

  it('lowers certainty for a low-probability position and offers the runner-up as an alternative', () => {
    const response = fullResponse({
      9: choiceAnswer(9, '4', 0.7, [{ value: '1', probability: 0.2 }]),
    })
    const mapped = mapLunaResponse(response, 'gpt-6-luna')
    expect(mapped.containerId.positionCertainty?.[9]).toBe('Likely')
    expect(mapped.containerId.certainty).toBe('Likely')
    expect(mapped.containerId.alternatives).toEqual(['APHU65868' + '1' + '7'])
  })

  it('does not read a position as Confident when the runner-up is within the margin (0.90 against 0.88)', () => {
    const response = fullResponse({
      9: choiceAnswer(9, '4', 0.9, [{ value: '1', probability: 0.88 }]),
    })
    const mapped = mapLunaResponse(response, 'gpt-6-luna')
    expect(mapped.containerId.positionCertainty?.[9]).toBe('Likely')
    expect(mapped.containerId.certainty).toBe('Likely')
  })

  it('keeps Confident when the runner-up is well outside the margin (0.90 against 0.40)', () => {
    const response = fullResponse({
      9: choiceAnswer(9, '4', 0.9, [{ value: '1', probability: 0.4 }]),
    })
    const mapped = mapLunaResponse(response, 'gpt-6-luna')
    expect(mapped.containerId.positionCertainty?.[9]).toBe('Confident')
  })

  it('treats a near-tie at the Uncertain level as unread rather than reading it as a fact', () => {
    const response = fullResponse({
      9: choiceAnswer(9, '4', 0.32, [{ value: '1', probability: 0.3 }]),
    })
    const mapped = mapLunaResponse(response, 'gpt-6-luna')
    expect(mapped.containerId.value.charAt(9)).toBe('?')
    expect(mapped.containerId.positionCertainty?.[9]).toBe("Can't tell")
  })

  it('reads the resolved model from the response when it reports one', () => {
    const mapped = mapLunaResponse(
      { ...fullResponse(), model: 'gpt-6-luna-20260922' },
      'gpt-6-luna',
    )
    expect(mapped.resolvedModel).toBe('gpt-6-luna-20260922')
  })

  it('falls back to the requested model when the response reports none', () => {
    expect(mapLunaResponse(fullResponse(), 'gpt-6-luna').resolvedModel).toBe('gpt-6-luna')
  })

  it('reads usage from the response fields and leaves it null when absent', () => {
    const withUsage = mapLunaResponse(
      { ...fullResponse(), usage: { input_tokens: 15780, output_tokens: 0 } },
      'gpt-6-luna',
    )
    expect(withUsage.usage).toEqual({ inputTokens: 15780, outputTokens: 0 })
    expect(mapLunaResponse(fullResponse(), 'gpt-6-luna').usage).toBeNull()
  })

  it('rejects a body without an answers array as a bad response', () => {
    expect(() => mapLunaResponse({ nope: true }, 'gpt-6-luna')).toThrow(LunaError)
  })
})

describe('Luna errors', () => {
  it('translates an invalid key into an actionable message', () => {
    const error = lunaFailure(401, { error: { message: 'Incorrect API key provided' } }, 'sk-x')
    expect(error.message).toMatch(/key was rejected/i)
    expect(error.status).toBe(401)
  })

  it('translates rate limiting', () => {
    expect(lunaFailure(429, {}, 'sk-x').message).toMatch(/rate limit/i)
  })

  it('translates server failure', () => {
    expect(lunaFailure(503, {}, 'sk-x').message).toMatch(/unavailable/i)
  })

  it('never includes the key in a message, even if the provider echoes it', () => {
    const key = 'test-only-key-value-0000'
    const error = lunaFailure(400, { error: { message: `bad value ${key}` } }, key)
    expect(error.message).not.toContain(key)
    expect(error.message).not.toContain('key-value')
  })

  it('says partial results are kept, whatever went wrong', () => {
    const failures = [
      lunaFetchFailure(true),
      lunaFetchFailure(false),
      ...[400, 401, 403, 404, 429, 500, 503].map((status) => lunaFailure(status, {}, 'sk-x')),
      lunaFailure(400, { error: { message: 'Invalid image' } }, 'sk-x'),
    ]
    for (const error of failures) {
      expect(error.message).toMatch(/ Any partial result is kept\.$/)
      expect(error.message.match(/partial result/g)).toHaveLength(1)
    }
  })
})
