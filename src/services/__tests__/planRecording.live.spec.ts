// Opt-in live recording of the whole request plan (spec #27, ticket #37): the demo's recordings.
//
// For each photo (the three demo samples and COYU) and each model, this runs a live inspection through the
// store exactly as the app makes it: the photo prepared for the model by a real browser canvas (Playwright's
// Chromium; set PW_CHROMIUM_PATH to use a pre-installed one), then the whole plan against the real provider:
// the survey (ID, details, weights, face), the long-side and door-end damage sets, and whatever follows
// from their answers (Jev's crop read, the weights second look, Luna's re-check). Every request is a real,
// chargeable call, about $0.005 a run. The raw responses (no key, no headers, no request body), with each
// request's latency and cost, are written to src/fixtures/live/plan/<photo>-<route>.json. Demo mode replays
// those files as they are: nothing else is needed to put a recording into the demo.
//   - GPT-6 Luna, OpenAI direct   (needs OPENAI_API_KEY)     -> <photo>-luna.json
//   - Jev latest, via OpenRouter  (needs OPENROUTER_API_KEY) -> <photo>-jev.json
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/planRecording.live.spec.ts
// One photo or route: add `-t 'coyu'` or `-t 'Jev'`. Nothing is written for a run that did not complete.
// Run `npm run check:secrets` before committing the recordings. The sequence is in docs/research/live-api-findings-2026-10-16.md (the last section).
//
// The bar (ticket #37): every run completes; COYU 266813 0 reads COYU 266813 0 on Jev latest. Luna through
// the app is known to misread one COYU digit (docs/research/live-api-findings-2026-10-16.md, "Luna on COYU"),
// so for Luna the bar is only that a wrong reading is never settled: it comes out partial or uncertain.
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
import { idResultState } from '../../domain/certainty'
import type { ProviderId } from '../../domain/inspection'
import { parsePlanRecording, recordRun } from '../../plan/recording'
import { replayRecording } from '../../plan/replay'
import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT_DIR = 'src/fixtures/live/plan'

const PHOTOS = [
  { name: 'rear-door-aphu-45g1', orientation: 'landscape' },
  { name: 'side-dented-grey', orientation: 'landscape' },
  { name: 'rear-door-chsu-22g1', orientation: 'landscape' },
  { name: 'rear-door-coyu-22g1', orientation: 'square' },
  // The presenter's photos (ticket #73): the COYU seal close-up, and the four JDLU 200690 2 photos.
  // Each photo is recorded on its own; the regression set combines them (src/regression/).
  { name: 'seal-closeup-coyu-0154620', orientation: 'portrait' },
  { name: 'jdlu-200690-1-rear-doors', orientation: 'portrait' },
  { name: 'jdlu-200690-2-corner-doors-left', orientation: 'portrait' },
  { name: 'jdlu-200690-3-corner-doors-right', orientation: 'portrait' },
  { name: 'jdlu-200690-4-long-side', orientation: 'portrait' },
] as const

const ROUTES: readonly {
  label: string
  file: string
  provider: ProviderId
  model: string
  key: string
}[] = [
  {
    label: 'GPT-6 Luna on OpenAI',
    file: 'luna',
    provider: 'luna',
    model: 'gpt-6-luna',
    key: openAiKey,
  },
  {
    label: 'Jev latest on OpenRouter',
    file: 'jev',
    provider: 'openrouter',
    model: '~typesafe/jev-latest',
    key: openRouterKey,
  },
]

const COYU = 'COYU2668130'

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live plan recording: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
  )
}

describe('Live plan recording (opt-in, chargeable)', () => {
  afterAll(async () => {
    await closeBrowserCodec()
  })

  for (const photo of PHOTOS) {
    for (const route of ROUTES) {
      it.skipIf(!route.key)(
        `${route.label} on ${photo.name}: the whole plan, recorded`,
        { timeout: 180_000 },
        async () => {
          setActivePinia(createPinia())
          const path = `samples/${photo.name}.jpg`
          const store = useInspectionStore()
          store.setProvider(route.provider)
          store.setModel(route.model)
          store.setApiKey(route.key)
          store.setPhoto({
            name: `${photo.name}.jpg`,
            url: `blob:${photo.name}`,
            orientation: photo.orientation,
            file: new Blob([await readFile(resolve(root, path))], { type: 'image/jpeg' }),
          })

          await store.start()

          const live = store.record
          const ledger = useLedgerStore().entries()
          console.info(
            `${route.label} on ${photo.name}: ${live?.status}\n` +
              ledger
                .map((l) => `  ${l.purpose}: ${l.status}, ${l.latencyMs} ms, $${l.costUsd}`)
                .join('\n'),
          )
          if (!live) console.error(`No result: ${store.errorMessage}`)
          expect(live).not.toBeNull()
          // Every request of the plan answered.
          expect(live!.status).toBe('complete')

          const recording = recordRun(live!, ledger, {
            photo: path,
            recordedAt: new Date().toISOString(),
          })
          const json = JSON.stringify(recording, null, 2)
          expect(json).not.toContain(route.key)
          // What is written must replay: through the same mappers, to the record this run made.
          const parsed = parsePlanRecording(JSON.parse(json))
          const replayed = replayRecording(parsed, { id: live!.id, photo: live!.photo })
          expect(replayed.containerId).toEqual(live!.containerId)
          expect(replayed.damage).toEqual(live!.damage)
          expect(replayed.weights).toEqual(live!.weights)

          const out = resolve(root, OUT_DIR, `${photo.name}-${route.file}.json`)
          await mkdir(dirname(out), { recursive: true })
          await writeFile(out, json + '\n', 'utf8')

          const id = live!.containerId
          console.info(
            `Read ${id?.value} (${id?.certainty}); face ${live!.photoFace?.face}; size ${live!.details?.sizeCode.code}.`,
          )
          // COYU 266813 0: Jev must read it. Luna must not read it wrong and settled.
          const wrong = [...(id?.value ?? '')].filter((c, i) => c !== '?' && c !== COYU[i])
          const meetsBar =
            photo.name !== 'rear-door-coyu-22g1' ||
            (route.provider === 'openrouter'
              ? id?.value === COYU && id.checkDigitValid
              : wrong.length === 0 || idResultState(id!) !== 'settled')
          expect(meetsBar).toBe(true)
        },
      )
    }
  }
})
