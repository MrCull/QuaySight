// Opt-in live smoke test for the ID wording (ticket #29) and Jev's crop read (ticket #31): COYU 266813 0
// read by group position. Makes real, chargeable calls on samples/rear-door-coyu-22g1.jpg (1079 × 1080):
//   - GPT-6 Luna, OpenAI direct            (needs OPENAI_API_KEY): the file's own bytes, then the re-check
//   - GPT-6 Luna Decisions, via OpenRouter (needs OPENROUTER_API_KEY): the same
//   - Jev latest, via OpenRouter           (needs OPENROUTER_API_KEY): a live run through the store, as the
//     app makes it: the photo prepared, the full-photo read with the box, then the crop read around it.
//     A real browser canvas (Playwright's Chromium; set PW_CHROMIUM_PATH to use a pre-installed one)
//     prepares and crops the photo, as in the app.
// The Luna checks send the original file's bytes and do NOT exercise the app's preparation path, which
// re-encodes the photo. Luna's answers on this photo flip with small pixel changes: through the app's own
// path (the store, 16 Oct 2026) both routes read CO?U22?8130, position 6 misread as 2. See
// docs/research/live-api-findings-2026-10-16.md.
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/coyu.live.spec.ts
// Each raw response (no headers, no key) is written to src/fixtures/live/coyu-*.json. Those fixtures feed
// the store test in src/stores/__tests__/coyuRecorded.spec.ts.
//
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS); this spec then
// installs undici's EnvHttpProxyAgent, as the other live specs do.
import { describe, it, expect, vi, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

vi.mock('../imageCodec', () => import('./browserCodec'))

import { closeBrowserCodec } from './browserCodec'
import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'
import { liveLuna } from './liveCalls'
import { LUNA_ENDPOINT, LUNA_MODEL, assembleLunaReading, type LunaMapping } from '../../domain/luna'
import { mergeRecheck, unresolvedPositions } from '../../domain/recheck'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { findModel, labelsFor } from '../../domain/providers'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO_PATH = 'samples/rear-door-coyu-22g1.jpg'
const COYU = 'COYU2668130'

/**
 * The bar the photo as the app sends it (1079 px) meets on GPT-6 Luna, checked 16 Oct 2026: every
 * character read is right, and a character Luna cannot settle is left unread (the manifest check is then
 * offered), never filled with a wrong digit. Upscaled to Luna's 2,048 px it reads all eleven; see
 * docs/research/live-api-findings-2026-10-16.md.
 */
function expectNeverMisread(value: string): void {
  console.info(`Read ${value}${value === COYU ? ' (complete and correct)' : ''}.`)
  expect(value).toHaveLength(11)
  const wrong = [...value].flatMap((ch, i) => (ch !== '?' && ch !== COYU[i] ? [i + 1] : []))
  expect(wrong, 'positions read as the wrong character').toEqual([])
}

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live COYU smoke test: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
  )
}

async function photo(): Promise<Blob> {
  return new Blob([await readFile(resolve(root, PHOTO_PATH))], { type: 'image/jpeg' })
}

/** A fetch that keeps the raw response body for the fixture. Headers are never kept. */
function capturing() {
  const seen = { body: null as unknown, status: 0 }
  const impl: typeof fetch = async (input, init) => {
    const response = await fetch(input, init)
    seen.status = response.status
    seen.body = await response
      .clone()
      .json()
      .catch(() => null)
    return response
  }
  return { seen, impl }
}

async function record(file: string, fields: Record<string, unknown>, key: string): Promise<void> {
  const fixture = JSON.stringify(
    { recordedAt: new Date().toISOString(), photo: PHOTO_PATH, ...fields },
    null,
    2,
  )
  expect(fixture).not.toContain(key)
  const path = resolve(root, 'src/fixtures/live', file)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, fixture + '\n', 'utf8')
}

/**
 * The Luna reading as the app makes it: the first reading, then one re-check of the characters it left
 * unread, merged (src/stores/inspection.ts). Both raw responses go in the fixture.
 */
async function readLikeTheApp(
  read: (positions: number[] | undefined, fetchImpl: typeof fetch) => Promise<LunaMapping>,
) {
  const first = capturing()
  const firstReading = await read(undefined, first.impl)
  expect(first.seen.status).toBe(200)
  const asked = unresolvedPositions(firstReading.readings)
  const fixture: Record<string, unknown> = { response: first.seen.body }
  if (asked.length === 0) return { containerId: firstReading.containerId, fixture }

  const again = capturing()
  const second = await read(asked, again.impl)
  expect(again.seen.status).toBe(200)
  const merged = mergeRecheck(firstReading.readings, second.readings, asked)
  console.info(
    `First reading ${firstReading.containerId.value}; re-checked positions ${asked.join(', ')}.`,
  )
  return {
    containerId: assembleLunaReading(merged.readings),
    fixture: { ...fixture, recheck: { positions: asked, response: again.seen.body } },
  }
}

describe('COYU 266813 0 live smoke test (opt-in, chargeable)', () => {
  afterAll(async () => {
    await closeBrowserCodec()
  })

  it.skipIf(!openAiKey)(
    'GPT-6 Luna on OpenAI never misreads COYU 266813 0 from the original file bytes (not the app preparation path)',
    async () => {
      const sent = await photo()
      const read = await readLikeTheApp((positions, fetchImpl) =>
        liveLuna({ apiKey: openAiKey, photo: sent, positions, fetchImpl }),
      )
      await record(
        'coyu-luna.json',
        { endpoint: LUNA_ENDPOINT, requestedModel: LUNA_MODEL, ...read.fixture },
        openAiKey,
      )
      expect(read.containerId.calculatedCheckDigit ?? 0).toBe(0)
      expectNeverMisread(read.containerId.value)
    },
  )

  it.skipIf(!openRouterKey)(
    'GPT-6 Luna Decisions through OpenRouter never misreads COYU 266813 0 from the original file bytes (not the app preparation path)',
    async () => {
      const model = 'openai/gpt-6-luna-decisions'
      const entry = findModel('openrouter', model)!
      const sent = await photo()
      const read = await readLikeTheApp((positions, fetchImpl) =>
        liveLuna({ apiKey: openRouterKey, photo: sent, model, positions, fetchImpl }),
      )
      await record(
        'coyu-openrouter-luna.json',
        { endpoint: OPENROUTER_ENDPOINT, requestedModel: model, ...read.fixture },
        openRouterKey,
      )
      expect(read.containerId.calculatedCheckDigit ?? 0).toBe(0)
      expectNeverMisread(read.containerId.value)
    },
  )

  it.skipIf(!openRouterKey)(
    'Jev latest through OpenRouter reads COYU 266813 0 in a live run, combining the full photo with a crop around its box',
    async () => {
      setActivePinia(createPinia())
      const model = '~typesafe/jev-latest'
      const store = useInspectionStore()
      store.setProvider('openrouter')
      store.setModel(model)
      store.setApiKey(openRouterKey)
      store.setPhoto({
        name: 'rear-door-coyu-22g1.jpg',
        url: 'blob:coyu',
        orientation: 'square',
        file: await photo(),
      })

      await store.start()

      const run = store.record!
      const responseOf = (id: string) =>
        run.rawResponses.find((r) => r.passId === `${run.id}-${id}`)?.body ?? null
      await record(
        'coyu-openrouter-jev.json',
        {
          endpoint: OPENROUTER_ENDPOINT,
          requestedModel: model,
          response: responseOf('read'),
          crop: { region: run.idCropRead?.crop ?? null, response: responseOf('crop') },
        },
        openRouterKey,
      )
      console.info(
        useLedgerStore()
          .entries()
          .map((l) => `${l.purpose}: ${l.status}, ${l.latencyMs} ms, $${l.costUsd}`)
          .join('\n'),
      )
      console.info(
        `Read ${run.containerId?.value}; crop ${JSON.stringify(run.idCropRead?.crop)}; disagreements ${JSON.stringify(run.idCropRead?.disagreements)}.`,
      )
      expect(run.idCropRead?.outcome).toBe('combined')
      expect(run.containerId).toMatchObject({ value: COYU, checkDigitValid: true })
    },
  )
})
