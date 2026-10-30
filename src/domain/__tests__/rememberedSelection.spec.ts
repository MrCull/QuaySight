import { describe, it, expect } from 'vitest'
import { readRememberedSelection, rememberSelection } from '../rememberedSelection'

describe('remembered provider and model', () => {
  it('reads back a provider and model the catalogue still offers', () => {
    expect(
      readRememberedSelection('{"provider":"openrouter","model":"typesafe/jev-1.13"}'),
    ).toEqual({
      provider: 'openrouter',
      model: 'typesafe/jev-1.13',
    })
  })

  it('round-trips what it writes, and writes nothing but the provider and model', () => {
    const written = rememberSelection({ provider: 'openrouter', model: 'typesafe/jev-1.14' })
    expect(JSON.parse(written)).toEqual({ provider: 'openrouter', model: 'typesafe/jev-1.14' })
    expect(readRememberedSelection(written)).toEqual({
      provider: 'openrouter',
      model: 'typesafe/jev-1.14',
    })
  })

  it('ignores nothing stored, unreadable text and providers the catalogue no longer lists', () => {
    expect(readRememberedSelection(null)).toBeNull()
    expect(readRememberedSelection('not json')).toBeNull()
    expect(readRememberedSelection('"luna"')).toBeNull()
    expect(
      readRememberedSelection('{"provider":"typesafe-direct","model":"~typesafe/jev-latest"}'),
    ).toBeNull()
    // TypeSafe direct, as remembered before it left the selector.
    expect(readRememberedSelection('{"provider":"jev","model":"jev-1.14.0"}')).toBeNull()
  })

  it('keeps a listed provider but falls back to its recommended model when the model is gone', () => {
    expect(readRememberedSelection('{"provider":"openrouter","model":"typesafe/jev-0.9"}')).toEqual(
      {
        provider: 'openrouter',
        model: '~typesafe/jev-latest',
      },
    )
    // GPT-6 Luna Decisions, as remembered before it left OpenRouter's models (25 Oct 2026).
    expect(
      readRememberedSelection('{"provider":"openrouter","model":"openai/gpt-6-luna-decisions"}'),
    ).toEqual({ provider: 'openrouter', model: '~typesafe/jev-latest' })
    expect(readRememberedSelection('{"provider":"luna","model":"~typesafe/jev-latest"}')).toEqual({
      provider: 'luna',
      model: 'gpt-6-luna',
    })
  })
})
