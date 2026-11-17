// Opt-in live smoke test for Liquid d1.2-ultra through OpenRouter's Decisions endpoint (17 Nov 2026).
// Makes a handful of real, chargeable calls (about $0.003 in all). Needs an OpenRouter key, supplied at run
// time and never stored in the repo:
//   Bash: OPENROUTER_API_KEY='<key>' npx vitest run src/services/__tests__/liquid.live.spec.ts
// Without the key the suite is skipped. It writes nothing: the whole-plan recordings are made by
// planRecording.live.spec.ts. What it checks is what the integration relies on:
//   - the survey (ID, details, weights, face) is answered, with a probability per choice and a reported cost;
//   - the 132-question side set goes in two requests (128, then 4), because Liquid refuses a 129th question
//     in one request, and the two answers read as one damage result;
//   - a set over the model's own limit is refused before anything is sent;
//   - the manifest check picks the right entry, and says "not listed" for a manifest without the container.
// Behind an HTTP proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if the proxy re-signs TLS).
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { readSideDamage } from '../../domain/sideDamage'
import { findModel, labelsFor } from '../../domain/providers'
import { QuestionSetError } from '../../domain/questionSet'
import { buildManifestQuestions } from '../../domain/manifest'
import {
  OPENROUTER_ENDPOINT_ID,
  buildOpenRouterManifestRequest,
  mapOpenRouterManifestResponse,
} from '../../domain/openrouter'
import {
  sideDamage,
  sideDamageFirstHalf,
  sideDamageSecondHalf,
} from '../../plan/requests/sideDamage'
import { survey } from '../../plan/requests/survey'
import type { RequestContext, RunRoute } from '../../plan/requestPlan'
import { askDecisions } from '../askDecisions'

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
if (apiKey && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const MODEL = 'liquid/d1.2-ultra'

if (!apiKey) console.warn('Skipping the live Liquid smoke test: set OPENROUTER_API_KEY to run it.')

const entry = findModel('openrouter', MODEL)!
const route: RunRoute = {
  provider: 'openrouter',
  model: MODEL,
  entry,
  endpoint: OPENROUTER_ENDPOINT_ID,
  describe: { name: labelsFor('openrouter', MODEL).model, maxSide: entry.photoLimits.maxSide },
}

async function context(path: string): Promise<RequestContext> {
  return {
    route,
    apiKey,
    photo: new Blob([await readFile(resolve(root, path))], { type: 'image/jpeg' }),
    signal: new AbortController().signal,
    answer: () => undefined,
  }
}

describe.skipIf(!apiKey)('Liquid d1.2-ultra live smoke test (opt-in, chargeable)', () => {
  it('answers the survey on a door photo, reports the model that answered and what the call cost', async () => {
    const reply = await survey.send(await context('samples/rear-door-chsu-22g1.jpg'))

    expect(reply.resolvedModel).toMatch(/^liquid\/d1\.2-ultra/)
    expect(reply.reportedCostUsd).toBeGreaterThan(0)
    expect(reply.usage?.inputTokens).toBeGreaterThan(0)
    expect(reply.answer.containerId.value).toHaveLength(11)
    expect(reply.answer.findings.face?.face).toBe('rear-doors')
    expect(reply.latencyMs).toBeLessThan(60_000)
  })

  it('answers the side set in two requests and reads them as one damage result', async () => {
    const ctx = await context('samples/side-dented-grey.jpg')

    const first = await sideDamageFirstHalf.send(ctx)
    const second = await sideDamageSecondHalf.send(ctx)

    expect(Object.keys(first.answer)).toHaveLength(128)
    expect(Object.keys(second.answer)).toHaveLength(4)
    const reading = readSideDamage({ ...first.answer, ...second.answer })
    expect(reading.zones).toHaveLength(10)
    expect(reading.zones.every((z) => z.visibility !== null)).toBe(true)
    expect(reading.coverage).not.toBeNull()
  })

  it('refuses the whole side set before sending it, rather than letting OpenRouter answer 422', async () => {
    await expect(sideDamage.send(await context('samples/side-dented-grey.jpg'))).rejects.toThrow(
      QuestionSetError,
    )
  })

  it('checks a manifest: picks the container that is on it, and finds none when it is not', async () => {
    const ctx = await context('samples/rear-door-chsu-22g1.jpg')
    const check = (entries: string[]) => {
      const questions = buildManifestQuestions(entries)
      return askDecisions(ctx, {
        build: ({ imageDataUrl }) => buildOpenRouterManifestRequest(MODEL, imageDataUrl, questions),
        map: (raw) => mapOpenRouterManifestResponse(raw, MODEL, questions),
      })
    }

    const listed = await check(['COYU2668130', 'CHSU2051831', 'APHU6586847'])
    const absent = await check(['COYU2668130', 'APHU6586847'])

    expect(listed.answer.reading?.value).toBe('CHSU2051831')
    expect(absent.answer.reading).toBeNull()
    expect(listed.reportedCostUsd).toBeGreaterThan(0)
  })
})
