// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compareToBaseline, countByFile, scanText } from './check-tokens.mjs'

const kinds = (text, file = 'src/x.css') => scanText(text, file).map((v) => v.kind)

describe('scanText', () => {
  it('flags hex colours', () => {
    expect(kinds('.a { color: #1a2b3c; }')).toEqual(['hex-colour'])
    expect(kinds('.a { color: #fff; }')).toEqual(['hex-colour'])
  })

  it('flags rgb( and hsl( colours', () => {
    expect(kinds('.a { color: rgb(0 0 0); }')).toEqual(['rgb-hsl'])
    expect(kinds('.a { color: HSLA(0, 0%, 0%, 1); }')).toEqual(['rgb-hsl'])
  })

  it('flags font-size and font shorthand with a literal px value', () => {
    expect(kinds('.a { font-size: 14px; }')).toEqual(['font-size-px'])
    expect(kinds('.a { font: 600 16px/1.4 var(--font-body); }')).toEqual(['font-px'])
  })

  it('flags literal px in padding, margin and gap', () => {
    expect(kinds('.a { padding: 8px 12px; }')).toEqual(['spacing-px'])
    expect(kinds('.a { margin-top: 4px; }')).toEqual(['spacing-px'])
    expect(kinds('.a { gap: 6px; }')).toEqual(['spacing-px'])
    expect(kinds('.a { column-gap: 0.5px; }')).toEqual(['spacing-px'])
  })

  it('passes token-based values', () => {
    const css = [
      '.a {',
      '  color: var(--ink);',
      '  font-size: var(--font-size-body);',
      '  padding: var(--space-4) var(--space-5);',
      '  margin: 0;',
      '  gap: var(--space-2);',
      '}',
    ].join('\n')
    expect(kinds(css)).toEqual([])
  })

  it('reports file and 1-based line numbers', () => {
    const [hit] = scanText('.a {}\n  color: #abc;\n', 'src/App.vue')
    expect(hit).toMatchObject({ file: 'src/App.vue', line: 2, kind: 'hex-colour' })
  })
})

describe('countByFile', () => {
  it('counts violations per file', () => {
    const violations = [
      { file: 'src/a.css', line: 1, kind: 'hex-colour' },
      { file: 'src/a.css', line: 4, kind: 'spacing-px' },
      { file: 'src/b.vue', line: 9, kind: 'font-px' },
    ]
    expect(countByFile(violations)).toEqual({ 'src/a.css': 2, 'src/b.vue': 1 })
  })
})

describe('compareToBaseline', () => {
  it('passes when every count is at or below its baseline', () => {
    expect(compareToBaseline({ 'src/a.css': 3 }, { 'src/a.css': 3 })).toEqual([])
    expect(compareToBaseline({ 'src/a.css': 2 }, { 'src/a.css': 3 })).toEqual([])
    expect(compareToBaseline({}, { 'src/a.css': 3 })).toEqual([])
  })

  it('fails when a file count rises above its baseline', () => {
    const problems = compareToBaseline({ 'src/a.css': 4 }, { 'src/a.css': 3 })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('src/a.css')
  })

  it('fails when a file with violations has no baseline entry', () => {
    const problems = compareToBaseline({ 'src/new.vue': 1 }, { 'src/a.css': 3 })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('src/new.vue')
  })
})
