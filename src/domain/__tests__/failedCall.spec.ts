import { describe, it, expect } from 'vitest'
import { classifyFailedCall } from '../failedCall'

// A provider like OpenAI's Decisions API: CORS headers on success, none on errors (checked live 16 Oct 2026).
const corsOnSuccessOnly = { errorsCarryCors: false }
// A provider like OpenRouter: CORS headers on success and on errors.
const corsAlways = { errorsCarryCors: true }

describe('classifying a failed provider call', () => {
  it('calls a thrown fetch refused when the browser is online and the provider hides its errors', () => {
    expect(classifyFailedCall({ kind: 'thrown', online: true }, corsOnSuccessOnly)).toBe('refused')
  })

  it('calls a thrown fetch unreachable when the browser is offline', () => {
    expect(classifyFailedCall({ kind: 'thrown', online: false }, corsOnSuccessOnly)).toBe(
      'unreachable',
    )
    expect(classifyFailedCall({ kind: 'thrown', online: false }, corsAlways)).toBe('unreachable')
  })

  it('calls a thrown fetch unreachable when the provider would have shown a readable error', () => {
    expect(classifyFailedCall({ kind: 'thrown', online: true }, corsAlways)).toBe('unreachable')
  })

  it('classifies a readable status by meaning, whatever the provider and connection', () => {
    const cases: [number, string][] = [
      [401, 'bad-key'],
      [403, 'bad-key'],
      [404, 'not-found'],
      [429, 'rate-limited'],
      [500, 'unavailable'],
      [503, 'unavailable'],
      [400, 'rejected'],
      [422, 'rejected'],
    ]
    for (const [status, expected] of cases) {
      expect(classifyFailedCall({ kind: 'status', status }, corsOnSuccessOnly)).toBe(expected)
      expect(classifyFailedCall({ kind: 'status', status }, corsAlways)).toBe(expected)
    }
  })
})
