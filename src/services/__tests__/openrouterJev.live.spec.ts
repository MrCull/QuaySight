// Opt-in live smoke test for Jev through OpenRouter (tickets #15, #22). Makes ONE real, chargeable call on
// one sample photo. Needs an OpenRouter key, supplied at run time and never stored in the repo:
//   PowerShell: $env:OPENROUTER_API_KEY = '<key>'; npx vitest run src/services/__tests__/openrouterJev.live.spec.ts
//   Bash:       OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/openrouterJev.live.spec.ts
// Optional: OPENROUTER_JEV_MODEL picks the model (default ~typesafe/jev-latest; typesafe/jev-1.14, typesafe/jev-1.13).
// Without OPENROUTER_API_KEY the suite is skipped. The raw response (no headers, no key) is written to
// src/fixtures/live/openrouter-jev-smoke.json for the lead to review before committing.
//
// The photo is samples/rear-door-chsu-22g1.jpg (1312 × 984, upright, no EXIF rotation). It is sent as
// it is, because Node has no canvas to fit it: it is already within Jev's 256–1,568 px per side. The APHU
// sample (2048 × 1536) is not, and Jev refuses it with "Invalid image dimensions".
//
// Behind an HTTP proxy (corporate network, cloud sandbox): Node's built-in fetch ignores proxy variables by
// default and fails with ENOTFOUND. Set these before running (checked on Node 22.22, 16 Oct 2026):
//   HTTPS_PROXY (or https_proxy)  the proxy URL; NO_PROXY lists hosts that bypass it.
//   NODE_EXTRA_CA_CERTS            path to the proxy's CA bundle, if the proxy re-signs TLS.
// NODE_USE_ENV_PROXY=1 is not enough here: the jsdom test environment loads its own undici, which replaces
// Node's proxy-aware dispatcher. So when HTTPS_PROXY is set this spec installs undici's EnvHttpProxyAgent
// itself, below. Without a proxy variable nothing changes.
import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { liveJev } from './liveCalls'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { findModel } from '../../domain/providers'

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
if (apiKey && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO_PATH = 'samples/rear-door-chsu-22g1.jpg'
const PHOTO = resolve(root, PHOTO_PATH)
const FIXTURE = resolve(root, 'src/fixtures/live/openrouter-jev-smoke.json')
const MODEL = process.env.OPENROUTER_JEV_MODEL ?? '~typesafe/jev-latest'

if (!apiKey) {
  console.warn(
    'Skipping live OpenRouter Jev smoke test: set OPENROUTER_API_KEY at run time to run it.',
  )
}

describe.skipIf(!apiKey)('OpenRouter Jev live smoke test (opt-in, one chargeable call)', () => {
  it('reads one sample photo and records the raw response as a fixture', async () => {
    const entry = findModel('openrouter', MODEL)
    expect(entry, `${MODEL} is not in the OpenRouter catalogue`).toBeDefined()

    const bytes = await readFile(PHOTO)
    const photo = new Blob([bytes], { type: 'image/jpeg' })

    let rawBody: unknown = null
    let status = 0
    const capturing: typeof fetch = async (input, init) => {
      const response = await fetch(input, init)
      status = response.status
      rawBody = await response
        .clone()
        .json()
        .catch(() => null)
      return response
    }

    const result = await liveJev({ apiKey, photo, model: MODEL, fetchImpl: capturing })

    expect(status).toBe(200)
    expect(result.containerId.value.length).toBe(11)
    expect(result.resolvedModel).toMatch(/^typesafe\/jev-1\./)
    expect(result.reportedCostUsd).toEqual(expect.any(Number))

    const fixture = JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        endpoint: OPENROUTER_ENDPOINT,
        requestedModel: MODEL,
        photo: PHOTO_PATH,
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
