import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('design-system/components/bundle.css', 'utf8')
const rule = (selector: string) =>
  css.split('\n').find((line) => line.trimStart().startsWith(selector)) ?? ''

describe('design-system bundle', () => {
  it('sizes the loupe at 6 x the largest spacing token (384px)', () => {
    const loupe = rule('.qs-loupe {')
    expect(loupe).toContain('width: calc(var(--space-8) * 6)')
    expect(loupe).toContain('height: calc(var(--space-8) * 6)')
  })

  it('styles the native select and its options with tokens, in the colour scheme of the theme in force', () => {
    // The scheme comes from :root (tokens.css sets color-scheme per theme), so the native list matches the theme.
    expect(rule('.qs-input select {')).not.toContain('color-scheme')
    const options = rule('.qs-input select option')
    expect(options).toContain('var(--surface)')
    expect(options).toContain('var(--ink)')
  })
})
