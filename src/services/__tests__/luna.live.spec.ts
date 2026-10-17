// Opt-in live smoke test for GPT-6 Luna (tickets #13, #18). Makes ONE real, chargeable call on one sample photo.
// Run with the key supplied at run time, never stored in the repo:
//   PowerShell: $env:OPENAI_API_KEY = '<key>'; npx vitest run src/services/__tests__/luna.live.spec.ts
//   Bash:       OPENAI_API_KEY='<key>' npx vitest run src/services/__tests__/luna.live.spec.ts
// Without OPENAI_API_KEY the suite is skipped. The raw response (no headers, no key) is written to
// src/fixtures/live/luna-smoke.json for the lead to review before committing.
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
import { liveLuna } from './liveCalls'
import { LUNA_ENDPOINT } from '../../domain/luna'

const apiKey = process.env.OPENAI_API_KEY ?? ''
if (apiKey && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
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
      rawBody = await response
        .clone()
        .json()
        .catch(() => null)
      return response
    }

    const result = await liveLuna({ apiKey, photo, fetchImpl: capturing })

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
