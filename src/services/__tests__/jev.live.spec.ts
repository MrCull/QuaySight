// Opt-in live smoke test for Jev (ticket #15). Makes ONE real, chargeable call on one sample photo.
// Needs a TypeSafe console key (console.typesafe.ai), supplied at run time and never stored in the repo:
//   PowerShell: $env:JEV_API_KEY = '<key>'; npx vitest run src/services/__tests__/jev.live.spec.ts
//   Bash:       JEV_API_KEY='<key>' npx vitest run src/services/__tests__/jev.live.spec.ts
// Without JEV_API_KEY the suite is skipped. The raw response (no headers, no key) is written to
// src/fixtures/live/jev-smoke.json for the lead to review before committing.
import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callJev } from '../jev'
import { JEV_ENDPOINT } from '../../domain/jev'

const apiKey = process.env.JEV_API_KEY ?? ''
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO = resolve(root, 'samples/rear-door-aphu-45g1.jpg')
const FIXTURE = resolve(root, 'src/fixtures/live/jev-smoke.json')
const MODEL = 'jev-latest'

if (!apiKey) {
  console.warn('Skipping live Jev smoke test: set JEV_API_KEY at run time to run it.')
}

describe.skipIf(!apiKey)('Jev live smoke test (opt-in, one chargeable call)', () => {
  it('reads one sample photo and records the raw response as a fixture', async () => {
    const bytes = await readFile(PHOTO)
    const photo = new Blob([bytes], { type: 'image/jpeg' })

    let rawBody: unknown = null
    const capturing: typeof fetch = async (input, init) => {
      const response = await fetch(input, init)
      rawBody = await response.clone().json().catch(() => null)
      return response
    }

    const result = await callJev({ apiKey, photo, model: MODEL, fetchImpl: capturing })

    expect(result.containerId.value.length).toBe(11)
    expect(result.resolvedModel).toMatch(/^jev-1\./)

    const fixture = JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        endpoint: JEV_ENDPOINT,
        requestedModel: MODEL,
        photo: 'samples/rear-door-aphu-45g1.jpg',
        response: rawBody,
      },
      null,
      2,
    )
    expect(fixture).not.toContain(apiKey)

    await mkdir(dirname(FIXTURE), { recursive: true })
    await writeFile(FIXTURE, fixture + '\n', 'utf8')
  })
})
