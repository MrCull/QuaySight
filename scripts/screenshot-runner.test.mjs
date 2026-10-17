// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { countScreenshots, resolveChromiumPath } from './screenshot-runner.mjs'

describe('resolveChromiumPath', () => {
  it('uses PW_CHROMIUM_PATH when it is set', () => {
    expect(resolveChromiumPath({ PW_CHROMIUM_PATH: '/x/chrome' }, () => true)).toBe('/x/chrome')
  })
  it('falls back to /opt/pw-browsers/chromium when it exists', () => {
    expect(resolveChromiumPath({}, (p) => p === '/opt/pw-browsers/chromium')).toBe(
      '/opt/pw-browsers/chromium',
    )
  })
  it('returns undefined when nothing is set and the container browser is absent', () => {
    expect(resolveChromiumPath({}, () => false)).toBeUndefined()
  })
})

describe('countScreenshots', () => {
  it('counts only .png files written at or after the run started', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-shots-'))
    const old = new Date(Date.now() - 60_000)
    fs.writeFileSync(path.join(dir, 'old.png'), 'x')
    fs.utimesSync(path.join(dir, 'old.png'), old, old)
    fs.writeFileSync(path.join(dir, 'new.png'), 'x')
    fs.writeFileSync(path.join(dir, 'index.json'), '{}')
    expect(countScreenshots(dir, Date.now() - 5_000)).toBe(1)
    fs.rmSync(dir, { recursive: true })
  })
  it('is zero when the directory does not exist', () => {
    expect(countScreenshots('/nonexistent-qs-dir', 0)).toBe(0)
  })
})
