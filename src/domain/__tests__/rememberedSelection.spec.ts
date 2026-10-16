import { describe, it, expect } from 'vitest'
import { readRememberedSelection, rememberSelection } from '../rememberedSelection'

describe('remembered provider and model', () => {
  it('reads back a provider and model the catalogue still offers', () => {
    expect(readRememberedSelection('{"provider":"jev","model":"jev-1.13.0"}')).toEqual({
      provider: 'jev',
      model: 'jev-1.13.0',
    })
  })

  it('round-trips what it writes, and writes nothing but the provider and model', () => {
    const written = rememberSelection({ provider: 'jev', model: 'jev-1.14.0' })
    expect(JSON.parse(written)).toEqual({ provider: 'jev', model: 'jev-1.14.0' })
    expect(readRememberedSelection(written)).toEqual({ provider: 'jev', model: 'jev-1.14.0' })
  })

  it('ignores nothing stored, unreadable text and providers the catalogue no longer lists', () => {
    expect(readRememberedSelection(null)).toBeNull()
    expect(readRememberedSelection('not json')).toBeNull()
    expect(readRememberedSelection('"luna"')).toBeNull()
    expect(
      readRememberedSelection('{"provider":"typesafe-direct","model":"jev-latest"}'),
    ).toBeNull()
  })

  it('keeps a listed provider but falls back to its recommended model when the model is gone', () => {
    expect(readRememberedSelection('{"provider":"jev","model":"jev-0.9"}')).toEqual({
      provider: 'jev',
      model: 'jev-latest',
    })
    expect(readRememberedSelection('{"provider":"luna","model":"jev-latest"}')).toEqual({
      provider: 'luna',
      model: 'gpt-6-luna',
    })
  })
})
