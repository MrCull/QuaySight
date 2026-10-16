import { describe, it, expect } from 'vitest'
import { canStart, hasKey, selectorView } from '../keyGate'

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
    expect(canStart({ ...base, model: 'jev-latest' })).toBe(false)
  })

  it('allows a start once a photo, a key and a valid model are present', () => {
    expect(canStart(base)).toBe(true)
  })

  it('checks the key for the provider in use, so a Jev run needs a Jev key', () => {
    expect(canStart({ ...base, provider: 'jev', model: 'jev-latest', apiKey: '' })).toBe(false)
    expect(canStart({ ...base, provider: 'jev', model: 'jev-latest' })).toBe(true)
  })
})

describe('selectorView (collapse logic)', () => {
  it('shows the full entry view before a key is entered', () => {
    expect(
      selectorView({ apiKey: '', model: 'gpt-6-luna', provider: 'luna', editing: false }),
    ).toBe('entry')
  })

  it('collapses to a summary once a key is entered and the selection is valid', () => {
    expect(
      selectorView({ apiKey: 'test-key', model: 'gpt-6-luna', provider: 'luna', editing: false }),
    ).toBe('collapsed')
  })

  it('stays expanded while the presenter is editing, even with a valid key', () => {
    expect(
      selectorView({ apiKey: 'test-key', model: 'gpt-6-luna', provider: 'luna', editing: true }),
    ).toBe('entry')
  })

  it('does not collapse when the model is not valid for the provider', () => {
    expect(
      selectorView({ apiKey: 'test-key', model: 'jev-latest', provider: 'luna', editing: false }),
    ).toBe('entry')
  })

  it('returns to the entry view when the key is cleared', () => {
    expect(
      selectorView({ apiKey: '', model: 'gpt-6-luna', provider: 'luna', editing: false }),
    ).toBe('entry')
  })
})
