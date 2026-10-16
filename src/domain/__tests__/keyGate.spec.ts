import { describe, it, expect } from 'vitest'
import { canContinue, canStart, hasKey } from '../keyGate'

describe('hasKey', () => {
  it('is false for empty and whitespace-only keys', () => {
    expect(hasKey('')).toBe(false)
    expect(hasKey('   ')).toBe(false)
  })

  it('is true for any non-blank key', () => {
    expect(hasKey('test-key')).toBe(true)
  })
})

describe('canStart (key gate)', () => {
  const base = {
    hasPhoto: true,
    provider: 'luna' as const,
    model: 'gpt-6-luna',
    apiKey: 'test-key',
  }

  it('refuses to start without a photo', () => {
    expect(canStart({ ...base, hasPhoto: false })).toBe(false)
  })

  it('refuses a recorded-or-live start without a key for the selected provider', () => {
    expect(canStart({ ...base, apiKey: '' })).toBe(false)
    expect(canStart({ ...base, apiKey: '  ' })).toBe(false)
  })

  it('refuses when the model is not offered by the selected provider', () => {
    expect(canStart({ ...base, model: '~typesafe/jev-latest' })).toBe(false)
  })

  it('allows a start once a photo, a key and a valid model are present', () => {
    expect(canStart(base)).toBe(true)
  })

  it('checks the key for the provider in use, so a Jev run needs a Jev key', () => {
    expect(
      canStart({ ...base, provider: 'openrouter', model: '~typesafe/jev-latest', apiKey: '' }),
    ).toBe(false)
    expect(canStart({ ...base, provider: 'openrouter', model: '~typesafe/jev-latest' })).toBe(true)
  })
})

describe('canContinue (setup card gate)', () => {
  const base = { provider: 'luna' as const, model: 'gpt-6-luna', apiKey: 'test-key' }

  it('stays closed until a key is entered', () => {
    expect(canContinue({ ...base, apiKey: '' })).toBe(false)
    expect(canContinue({ ...base, apiKey: '   ' })).toBe(false)
  })

  it('opens with a key and a model the provider offers, with no photo needed', () => {
    expect(canContinue(base)).toBe(true)
    expect(
      canContinue({ provider: 'openrouter', model: 'typesafe/jev-1.13', apiKey: 'test-key' }),
    ).toBe(true)
  })

  it('stays closed for a model the provider does not offer', () => {
    expect(canContinue({ ...base, model: '~typesafe/jev-latest' })).toBe(false)
  })
})
