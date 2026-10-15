// Opt-in live smoke test for GPT-6 Luna (ticket #13). Makes ONE real, chargeable call on one sample photo.
// Run with the key supplied at run time, never stored in the repo:
//   PowerShell: $env:OPENAI_API_KEY = '<key>'; npx vitest run src/services/__tests__/luna.live.spec.ts
//   Bash:       OPENAI_API_KEY='<key>' npx vitest run src/services/__tests__/luna.live.spec.ts
// Without OPENAI_API_KEY the suite is skipped. The raw response (no headers, no key) is written to
// src/fixtures/live/luna-smoke.json for the lead to review before committing.
import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callLuna } from '../luna'
import { LUNA_ENDPOINT } from '../../domain/luna'

const apiKey = process.env.OPENAI_API_KEY ?? ''
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO = resolve(root, 'samples/rear-door-aphu-45g1.jpg')
const FIXTURE = resolve(root, 'src/fixtures/live/luna-smoke.json')

if (!apiKey) {
  console.warn('Skipping live Luna smoke test: set OPENAI_API_KEY at run time to run it.')
}

describe.skipIf(!apiKey)('Luna live smoke test (opt-in, one chargeable call)', () => {
  it('reads one sample photo and records the raw response as a fixture', async () => {
    const bytes = await readFile(PHOTO)
    const photo = new Blob([bytes], { type: 'image/jpeg' })

    let rawBody: unknown = null
    const capturing: typeof fetch = async (input, init) => {
      const response = await fetch(input, init)
      rawBody = await response.clone().json().catch(() => null)
      return response
    }

    const result = await callLuna({ apiKey, photo, fetchImpl: capturing })

    expect(result.containerId.value.length).toBe(11)
    expect(result.resolvedModel).toBeTruthy()

    await mkdir(dirname(FIXTURE), { recursive: true })
    await writeFile(
      FIXTURE,
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          endpoint: LUNA_ENDPOINT,
          requestedModel: 'gpt-6-luna',
          photo: 'samples/rear-door-aphu-45g1.jpg',
          response: rawBody,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
  })
})
