import { describe, it, expect } from 'vitest'
import { canContinue, canStart, hasKey, keyFormatWarning } from '../keyGate'

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

describe('keyFormatWarning (key-prefix check)', () => {
  it('warns about an OpenRouter key that does not start with sk-or-, naming the provider and prefix', () => {
    expect(keyFormatWarning('openrouter', 'sk-test-abc123')).toEqual({
      provider: 'OpenRouter',
      prefix: 'sk-or-',
    })
  })

  it('warns about an OpenAI key that does not start with sk-', () => {
    expect(keyFormatWarning('luna', 'or-abc123')).toEqual({ provider: 'OpenAI', prefix: 'sk-' })
  })

  it('says nothing for a key with the expected prefix', () => {
    expect(keyFormatWarning('openrouter', 'sk-or-test-abc123')).toBeNull()
    expect(keyFormatWarning('luna', 'sk-test-abc123')).toBeNull()
  })

  it('says nothing for an empty key, or while the prefix is still being typed', () => {
    expect(keyFormatWarning('openrouter', '')).toBeNull()
    expect(keyFormatWarning('openrouter', '   ')).toBeNull()
    expect(keyFormatWarning('openrouter', 's')).toBeNull()
    expect(keyFormatWarning('openrouter', 'sk-o')).toBeNull()
  })

  it('warns about a key pasted with a leading space, which would not reach the provider as typed', () => {
    expect(keyFormatWarning('luna', ' sk-test-abc123')).toEqual({
      provider: 'OpenAI',
      prefix: 'sk-',
    })
  })

  it('never carries the key itself', () => {
    const warning = keyFormatWarning('openrouter', 'wrong-secret-value')
    expect(JSON.stringify(warning)).not.toContain('wrong-secret-value')
  })
})
