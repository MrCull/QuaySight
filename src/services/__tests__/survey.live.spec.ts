// Opt-in live smoke test for the survey's container details (ticket #32): the COYU 22G1 photo.
// Makes up to three real, chargeable survey requests on samples/rear-door-coyu-22g1.jpg (1079 x 1080):
//   - GPT-6 Luna, OpenAI direct            (needs OPENAI_API_KEY)
//   - GPT-6 Luna Decisions, via OpenRouter (needs OPENROUTER_API_KEY)
//   - Jev latest, via OpenRouter           (needs OPENROUTER_API_KEY)
// Keys are supplied at run time and never stored in the repo:
//   Bash: OPENAI_API_KEY='<key>' OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/survey.live.spec.ts
// Nothing is recorded: the checks are about the details only (the ID has its own live spec).
// The photo is a door end of a 22G1 box: a 20 ft, 8 ft 6 in, general-purpose container with no reefer,
// open-top, tank or flat-rack features, no operational marking and no DG placard.
//
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS).
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { LUNA_MODEL } from '../../domain/luna'
import type { ProviderId } from '../../domain/inspection'
import { LUNA_ENDPOINT_ID } from '../../domain/luna'
import { OPENROUTER_ENDPOINT_ID } from '../../domain/openrouter'
import { findModel, labelsFor } from '../../domain/providers'
import { survey } from '../../plan/requests/survey'
import type { RunRoute } from '../../plan/requestPlan'

const openAiKey = process.env.OPENAI_API_KEY ?? ''
const openRouterKey = process.env.OPENROUTER_API_KEY ?? ''
if ((openAiKey || openRouterKey) && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

if (!openAiKey && !openRouterKey) {
  console.warn(
    'Skipping the live survey smoke test: set OPENAI_API_KEY or OPENROUTER_API_KEY to run it.',
  )
}

async function surveyOn(provider: ProviderId, model: string, apiKey: string) {
  const entry = findModel(provider, model)!
  const route: RunRoute = {
    provider,
    model,
    entry,
    endpoint:
      entry.wireFormat === 'openrouter-decisions' ? OPENROUTER_ENDPOINT_ID : LUNA_ENDPOINT_ID,
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
  const photo = new Blob([await readFile(resolve(root, 'samples/rear-door-coyu-22g1.jpg'))], {
    type: 'image/jpeg',
  })
  const reply = await survey.send({
    route,
    apiKey,
    photo,
    signal: new AbortController().signal,
    answer: () => undefined,
  })
  return reply.answer.findings.details
}

function expectCoyuDetails(details: Awaited<ReturnType<typeof surveyOn>>): void {
  console.info(
    `Size/type code ${details.sizeCode.code} (${details.sizeCode.certainty}); placard ${details.dgPlacard.answer}.`,
  )
  expect(details.sizeCode.code).toBe('22G1')
  expect(details.sizeCode.decoded).toMatchObject({
    length: { label: '20 ft' },
    height: { label: '8 ft 6 in standard', highCube: false },
    type: { label: 'General purpose', equipment: 'general' },
  })
  // Equipment checks the photo settles must not claim special equipment.
  for (const check of Object.values(details.equipment)) expect(check.answer).not.toBe('yes')
  // A high-container caution is never an overwidth marking, and no marking is claimed.
  for (const marking of Object.values(details.markings)) expect(marking.answer).not.toBe('yes')
  expect(details.dgPlacard.answer).not.toBe('placard')
}

describe('COYU 22G1 survey details live smoke test (opt-in, chargeable)', () => {
  it.skipIf(!openAiKey)(
    'GPT-6 Luna on OpenAI reads 22G1 and decodes it',
    async () => {
      expectCoyuDetails(await surveyOn('luna', LUNA_MODEL, openAiKey))
    },
    120_000,
  )

  it.skipIf(!openRouterKey)(
    'GPT-6 Luna Decisions through OpenRouter reads 22G1 and decodes it',
    async () => {
      expectCoyuDetails(await surveyOn('openrouter', 'openai/gpt-6-luna-decisions', openRouterKey))
    },
    120_000,
  )

  it.skipIf(!openRouterKey)(
    'Jev latest through OpenRouter reads 22G1 and decodes it',
    async () => {
      expectCoyuDetails(await surveyOn('openrouter', '~typesafe/jev-latest', openRouterKey))
    },
    120_000,
  )
})
