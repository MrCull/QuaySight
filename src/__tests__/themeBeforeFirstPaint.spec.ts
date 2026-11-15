import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// index.html sets the theme before the first paint, so the page never flashes the wrong one. Run that inline
// script as written against a fresh <html> and a given storage.
const html = readFileSync('index.html', 'utf8')
const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

function themeBeforeFirstPaint(localStorage: Pick<Storage, 'getItem'>): string | null {
  const root = document.createElement('html')
  const run = new Function('localStorage', 'document', inline)
  run(localStorage, { documentElement: root })
  return root.getAttribute('data-theme')
}

const storing = (value: string | null) => ({ getItem: () => value })

describe('the theme before the first paint', () => {
  it('is dark when nothing was remembered', () => {
    expect(themeBeforeFirstPaint(storing(null))).toBe('dark')
  })

  it('is a remembered light or dark', () => {
    expect(themeBeforeFirstPaint(storing('light'))).toBe('light')
    expect(themeBeforeFirstPaint(storing('dark'))).toBe('dark')
  })

  it('is dark for a stored value that is not a theme', () => {
    expect(themeBeforeFirstPaint(storing('sepia'))).toBe('dark')
  })

  it('is dark where storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
    }
    expect(themeBeforeFirstPaint(blocked)).toBe('dark')
  })
})
