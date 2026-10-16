// Opt-in live smoke test for GPT-6 Luna Decisions through OpenRouter (tickets #13, #23). Makes ONE real,
// chargeable call on one sample photo, with the Luna question set. Needs an OpenRouter key, supplied at run
// time and never stored in the repo:
//   PowerShell: $env:OPENROUTER_API_KEY = '<key>'; npx vitest run src/services/__tests__/openrouterLuna.live.spec.ts
//   Bash:       OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/openrouterLuna.live.spec.ts
// Without OPENROUTER_API_KEY the suite is skipped. The raw response (no headers, no key) is written to
// src/fixtures/live/openrouter-luna-smoke.json for the lead to review before committing. Only the first
// pass is made: a re-check of unread positions would be a second charge, and the store specs cover it.
//
// The photo is samples/rear-door-aphu-45g1.jpg (1536 × 2048, upright, no EXIF rotation), the photo the
// direct Luna smoke test uses. It is sent as it is, because Node has no canvas to fit it: it is already
// within Luna's 2,048 px on the long side.
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
import { callOpenRouterLuna } from '../openrouter'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { findModel, labelsFor, questionSetOf } from '../../domain/providers'

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
if (apiKey && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO_PATH = 'samples/rear-door-aphu-45g1.jpg'
const PHOTO = resolve(root, PHOTO_PATH)
const FIXTURE = resolve(root, 'src/fixtures/live/openrouter-luna-smoke.json')
const MODEL = 'openai/gpt-6-luna-decisions'

if (!apiKey) {
  console.warn(
    'Skipping live OpenRouter Luna smoke test: set OPENROUTER_API_KEY at run time to run it.',
  )
}

describe.skipIf(!apiKey)(
  'OpenRouter Luna Decisions live smoke test (opt-in, one chargeable call)',
  () => {
    it('reads one sample photo and records the raw response as a fixture', async () => {
      const entry = findModel('openrouter', MODEL)
      expect(entry, `${MODEL} is not in the OpenRouter catalogue`).toBeDefined()
      expect(questionSetOf(entry!)).toBe('luna')

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

      const result = await callOpenRouterLuna({
        apiKey,
        photo,
        model: MODEL,
        describe: {
          name: labelsFor('openrouter', MODEL).model,
          maxSide: entry!.photoLimits.maxSide,
        },
        fetchImpl: capturing,
      })

      expect(status).toBe(200)
      expect(result.containerId.value.length).toBe(11)
      // The real reply maps onto the shared reading: at least one position is read.
      expect(result.readings.filter((r) => r.value !== null).length).toBeGreaterThan(0)
      expect(result.resolvedModel).toMatch(/^openai\/gpt-6-luna-decisions/)
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
  },
)
