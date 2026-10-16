// Opt-in live smoke test for door-end damage (ticket #35) on the three clean or lightly worn door photos:
//   samples/rear-door-aphu-45g1.jpg  (2048 × 1536)
//   samples/rear-door-chsu-22g1.jpg  (1312 × 984)
//   samples/rear-door-coyu-22g1.jpg  (1079 × 1080)
// Per photo and route it makes two real, chargeable calls, as a live run does for these photos: the survey
// (which reads the ID and says which face the photo shows) and the door-end damage set. The photo is prepared
// for the route's limits first, as the app does (a real browser canvas: Playwright's Chromium; set
// PW_CHROMIUM_PATH to use a pre-installed one), so APHU is shrunk for Jev.
//   - GPT-6 Luna, OpenAI direct            (needs OPENAI_API_KEY)
//   - GPT-6 Luna Decisions, via OpenRouter (needs OPENROUTER_API_KEY)
//   - Jev latest, via OpenRouter           (needs OPENROUTER_API_KEY)
// The bar: the survey says rear doors, the door set finds the end inspectable, and these clean doors produce
// no major finding of any kind. Moderate or lower findings are printed, to tune the set's wording against.
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/doorDamage.live.spec.ts
// Each raw response (no headers, no key) is written to src/fixtures/live/door-damage-<photo>-<route>.json.
// Run `npm run check:secrets` before committing the fixtures.
//
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS); this spec then
// installs undici's EnvHttpProxyAgent, as the other live specs do.
import { describe, it, expect, vi, afterAll } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

vi.mock('../imageCodec', () => import('./browserCodec'))

import { closeBrowserCodec } from './browserCodec'
import { preparePhoto } from '../preparePhoto'
import { assessDamage } from '../../domain/damageSets'
import type { ProviderId } from '../../domain/inspection'
import { findModel, labelsFor } from '../../domain/providers'
import { LUNA_ENDPOINT } from '../../domain/luna'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { survey } from '../../plan/requests/survey'
import { doorDamage } from '../../plan/requests/doorDamage'
import type { RequestContext, RunRoute } from '../../plan/requestPlan'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const PHOTOS = [
  { name: 'aphu', path: 'samples/rear-door-aphu-45g1.jpg' },
  { name: 'chsu', path: 'samples/rear-door-chsu-22g1.jpg' },
  { name: 'coyu', path: 'samples/rear-door-coyu-22g1.jpg' },
] as const

const ROUTES = [
  {
    label: 'GPT-6 Luna on OpenAI',
    file: 'luna',
    provider: 'luna',
    model: 'gpt-6-luna',
    endpoint: LUNA_ENDPOINT,
    key: openAiKey,
  },
  {
    label: 'GPT-6 Luna Decisions through OpenRouter',
    file: 'openrouter-luna',
    provider: 'openrouter',
    model: 'openai/gpt-6-luna-decisions',
    endpoint: OPENROUTER_ENDPOINT,
    key: openRouterKey,
  },
  {
    label: 'Jev latest through OpenRouter',
    file: 'openrouter-jev',
    provider: 'openrouter',
    model: '~typesafe/jev-latest',
    endpoint: OPENROUTER_ENDPOINT,
    key: openRouterKey,
  },
] as const satisfies readonly {
  label: string
  file: string
  provider: ProviderId
  model: string
  endpoint: string
  key: string
}[]

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live door-damage smoke test: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
  )
}

function routeFor(provider: ProviderId, model: string, endpoint: string): RunRoute {
  const entry = findModel(provider, model)!
  return {
    provider,
    model,
    entry,
    endpoint,
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
}

/** Runs the survey and the door set on one route and photo, as the plan does, and keeps both raw responses. */
async function runBoth(route: RunRoute, apiKey: string, photoPath: string, fixtureFile: string) {
  const original = new Blob([await readFile(resolve(root, photoPath))], { type: 'image/jpeg' })
  const photo = await preparePhoto(original, route.entry.photoLimits, route.describe.name)
  const ctx: RequestContext = {
    route,
    apiKey,
    photo,
    signal: new AbortController().signal,
    answer: () => undefined,
  }
  const [read, door] = await Promise.all([survey.send(ctx), doorDamage.send(ctx)])
  const fixture = JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      photo: photoPath,
      endpoint: route.endpoint,
      requestedModel: route.model,
      survey: read.raw,
      door: door.raw,
    },
    null,
    2,
  )
  expect(fixture).not.toContain(apiKey)
  const path = resolve(root, 'src/fixtures/live', fixtureFile)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, fixture + '\n', 'utf8')

  const face = read.answer.findings.face
  const damage = assessDamage(face, [{ ...door.answer }], photoPath)
  console.info(
    `${route.describe.name} on ${photoPath}: face ${face?.face ?? 'unread'}; findings ${
      damage?.findings.map((f) => `${f.location} (${f.severity ?? 'component'})`).join(', ') ||
      'none'
    }`,
  )
  return { face, door: door.answer, damage }
}

describe('door-end damage live smoke test (opt-in, chargeable)', () => {
  afterAll(async () => {
    await closeBrowserCodec()
  })

  for (const route of ROUTES) {
    for (const photo of PHOTOS) {
      it.skipIf(!route.key)(
        `${route.label} sees the ${photo.name.toUpperCase()} door end and finds no major damage on it`,
        async () => {
          const { face, door, damage } = await runBoth(
            routeFor(route.provider, route.model, route.endpoint),
            route.key,
            photo.path,
            `door-damage-${photo.name}-${route.file}.json`,
          )
          expect(face?.face).toBe('rear-doors')
          expect(door.inspectable).toBe(true)
          const major = (damage?.findings ?? []).filter((f) => f.severity === 'major')
          expect(
            major.map((f) => f.location),
            'findings rated major on a clean door',
          ).toEqual([])
        },
      )
    }
  }
})

vi.setConfig({ testTimeout: 180_000 })
