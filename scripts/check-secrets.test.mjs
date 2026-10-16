// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findSecretsInDiff, findSecretsInText } from './check-secrets.mjs'

// Fixtures are assembled at runtime so this file never contains a key-shaped literal.
const OPENAI_PROJECT_PREFIX = ['sk', 'proj', ''].join('-')
const OPENROUTER_PREFIX = ['sk', 'or', 'v1', ''].join('-')
const FILLER = 'A1b2C3d4E5f6G7h8I9j0K1l2'
const PROJECT_KEY = OPENAI_PROJECT_PREFIX + FILLER
const OPENROUTER_KEY = OPENROUTER_PREFIX + FILLER
const GENERIC_KEY = ['sk', FILLER].join('-')

describe('findSecretsInText', () => {
  it('detects an sk-proj- key and reports its line number', () => {
    const text = `const ok = true\nconst key = "${PROJECT_KEY}"\n`
    const hits = findSecretsInText(text, 'src/config.ts')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ file: 'src/config.ts', line: 2 })
  })

  it('detects an sk-or-v1- key', () => {
    expect(findSecretsInText(`KEY=${OPENROUTER_KEY}`, '.env.local')).toHaveLength(1)
  })

  it('detects a generic sk- key of 20 or more characters', () => {
    expect(findSecretsInText(`token: ${GENERIC_KEY}`, 'notes.txt')).toHaveLength(1)
  })

  it('does not report the matched secret value', () => {
    const [hit] = findSecretsInText(`KEY=${PROJECT_KEY}`, 'a.ts')
    expect(JSON.stringify(hit)).not.toContain(FILLER)
  })

  it('passes clean text', () => {
    const text = [
      'const label = "Confident"',
      'npm run check',
      'short sk-abc is not a key',
      'task-runner-manager-service stays clean',
    ].join('\n')
    expect(findSecretsInText(text, 'src/clean.ts')).toEqual([])
  })
})

describe('findSecretsInDiff', () => {
  it('flags a key on an added line and names the file from the diff header', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,1 +1,2 @@',
      ' const a = 1',
      `+const key = "${PROJECT_KEY}"`,
    ].join('\n')
    const hits = findSecretsInDiff(diff)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ file: 'src/app.ts', line: 2 })
  })

  it('ignores removed lines, since they are not being committed', () => {
    const diff = [
      '+++ b/src/app.ts',
      '@@ -1,1 +1,1 @@',
      `-const key = "${PROJECT_KEY}"`,
      '+const key = process.env.KEY',
    ].join('\n')
    expect(findSecretsInDiff(diff)).toEqual([])
  })
})
