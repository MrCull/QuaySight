// Opt-in live smoke test for long-side damage (ticket #33) on samples/side-dented-grey.jpg (900 × 600,
// within every model's limits, so it is sent as it is). Per route it makes two real, chargeable calls,
// exactly as a live run does: the survey (which reads the ID and says which face the photo shows) and the
// long-side damage set.
//   - GPT-6 Luna, OpenAI direct            (needs OPENAI_API_KEY)
//   - GPT-6 Luna Decisions, via OpenRouter (needs OPENROUTER_API_KEY)
//   - Jev latest, via OpenRouter           (needs OPENROUTER_API_KEY)
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/sideDamage.live.spec.ts
// Each raw response (no headers, no key) is written to src/fixtures/live/side-damage-*.json.
//
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS); this spec then
// installs undici's EnvHttpProxyAgent, as the other live specs do.
import { describe, it, expect, vi } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { assessDamage } from '../../domain/damageSets'
import type { ProviderId } from '../../domain/inspection'
import { findModel, labelsFor } from '../../domain/providers'
import { LUNA_ENDPOINT } from '../../domain/luna'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { readId } from '../../plan/requests/readId'
import { sideDamage } from '../../plan/requests/sideDamage'
import type { RequestContext, RunRoute } from '../../plan/requestPlan'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PHOTO_PATH = 'samples/side-dented-grey.jpg'

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live side-damage smoke test: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
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

/** Runs the survey and the side set on one route, as the plan does, and keeps both raw responses. */
async function runBoth(route: RunRoute, apiKey: string, fixtureFile: string) {
  const photo = new Blob([await readFile(resolve(root, PHOTO_PATH))], { type: 'image/jpeg' })
  const ctx: RequestContext = {
    route,
    apiKey,
    photo,
    signal: new AbortController().signal,
    answer: () => undefined,
  }
  const [survey, side] = await Promise.all([readId.send(ctx), sideDamage.send(ctx)])
  const fixture = JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      photo: PHOTO_PATH,
      endpoint: route.endpoint,
      requestedModel: route.model,
      survey: survey.raw,
      side: side.raw,
    },
    null,
    2,
  )
  expect(fixture).not.toContain(apiKey)
  const path = resolve(root, 'src/fixtures/live', fixtureFile)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, fixture + '\n', 'utf8')

  const face = survey.answer.face
  const damage = assessDamage(face, [{ ...side.answer }], PHOTO_PATH)
  console.info(
    `${route.describe.name}: face ${face?.face ?? 'unread'}; findings ${damage?.findings
      .map((f) => `${f.location} (${f.severity ?? 'component'})`)
      .join(', ')}`,
  )
  return { face, damage }
}

/** The dent sits in the bottom-middle zones (photo columns 2 and 3, lower half), and no panel zone above. */
function dentIsBottomMiddle(damage: ReturnType<typeof assessDamage>): void {
  const panels = (damage?.findings ?? []).filter((f) => f.component === 'panel' && f.zone)
  const where = panels.map((f) => f.location).join('; ')
  const bottomMiddle = panels.filter(
    (f) => f.zone!.v0 >= 0.5 && f.zone!.u0 >= 0.2 - 1e-9 && f.zone!.u1 <= 0.6 + 1e-9,
  )
  expect(bottomMiddle.length, `panel findings were: ${where}`).toBeGreaterThan(0)
  expect(panels.filter((f) => f.zone!.v1 <= 0.5 + 1e-9).map((f) => f.location)).toEqual([])
}

describe('long-side damage live smoke test (opt-in, chargeable)', () => {
  it.skipIf(!openAiKey)(
    'GPT-6 Luna on OpenAI places the dent in the bottom-middle zones',
    async () => {
      const route = routeFor('luna', 'gpt-6-luna', LUNA_ENDPOINT)
      const { face, damage } = await runBoth(route, openAiKey, 'side-damage-luna.json')
      expect(face?.face).toBe('long-side')
      dentIsBottomMiddle(damage)
    },
  )

  it.skipIf(!openRouterKey)(
    'GPT-6 Luna Decisions through OpenRouter places the dent in the bottom-middle zones',
    async () => {
      const route = routeFor('openrouter', 'openai/gpt-6-luna-decisions', OPENROUTER_ENDPOINT)
      const { face, damage } = await runBoth(
        route,
        openRouterKey,
        'side-damage-openrouter-luna.json',
      )
      expect(face?.face).toBe('long-side')
      dentIsBottomMiddle(damage)
    },
  )

  it.skipIf(!openRouterKey)(
    'Jev latest through OpenRouter places the dent in the bottom-middle zones',
    async () => {
      const route = routeFor('openrouter', '~typesafe/jev-latest', OPENROUTER_ENDPOINT)
      const { face, damage } = await runBoth(
        route,
        openRouterKey,
        'side-damage-openrouter-jev.json',
      )
      expect(face?.face).toBe('long-side')
      dentIsBottomMiddle(damage)
    },
  )
})

vi.setConfig({ testTimeout: 120_000 })
