import { describe, it, expect, vi } from 'vitest'
import { askDecisions } from '../askDecisions'
import { buildManifestQuestions } from '../../domain/manifest'
import { manifestAsk } from '../../domain/manifestAsk'
import { LUNA_ENDPOINT } from '../../domain/luna'
import { OPENROUTER_ENDPOINT } from '../../domain/openrouter'
import { findModel, labelsFor, defaultModelFor } from '../../domain/providers'
import { failureOf } from '../../domain/requestFailure'
import type { AskContext } from '../askDecisions'
import type { RunRoute } from '../../plan/requestPlan'

// Mocked fetch only. The keys are test values and are never written anywhere else.
const KEYS = { luna: 'test-only-openai-key-0000', openrouter: 'test-only-openrouter-key-0000' }
const photo = new Blob(['not-really-a-jpeg'], { type: 'image/jpeg' })
const questions = buildManifestQuestions(['APHU6586847', 'MSKU1234565'])
const manifest = manifestAsk(questions)

function routeOf(provider: 'luna' | 'openrouter'): RunRoute {
  const model = defaultModelFor(provider)
  const entry = findModel(provider, model)!
  return {
    provider,
    model,
    entry,
    endpoint: 'decisions',
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
}

function ctxOf(provider: 'luna' | 'openrouter', fetchImpl: typeof fetch): AskContext {
  return {
    route: routeOf(provider),
    apiKey: KEYS[provider],
    photo,
    signal: new AbortController().signal,
    fetchImpl,
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe.each([
  ['luna', LUNA_ENDPOINT],
  ['openrouter', OPENROUTER_ENDPOINT],
] as const)('askDecisions on %s', (provider, endpoint) => {
  it('sends the question set once to the provider endpoint, the key only in Authorization', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(200, {
        model: 'm-1',
        // Each provider's own answer shape: a list on OpenAI, an object by question name on OpenRouter.
        answers:
          provider === 'luna'
            ? [{ type: 'choice', name: 'manifest_1', choice: 'APHU6586847', probabilities: [] }]
            : { manifest_1: { type: 'choice', choice: 'APHU6586847', probabilities: {} } },
      }),
    )
    const reply = await askDecisions(ctxOf(provider, fetchImpl), manifest)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(endpoint)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEYS[provider]}`)
    expect(String(init.body)).not.toContain(KEYS[provider])
    expect(reply.resolvedModel).toBeTruthy()
  })

  it('fails with a cause stamped once, and never shows the key', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(429, { error: { message: `slow down ${KEYS[provider]}` } }),
    )
    const error = await askDecisions(ctxOf(provider, fetchImpl), manifest).catch((e: unknown) => e)
    expect(failureOf(error).cause).toBe('busy')
    expect(failureOf(error).status).toBe(429)
    expect(JSON.stringify(failureOf(error))).not.toContain(KEYS[provider])
    expect((error as Error).message).not.toContain(KEYS[provider])
  })

  it('reports a thrown fetch without the underlying text', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError(`Failed to fetch ${KEYS[provider]}`)
    })
    const error = await askDecisions(ctxOf(provider, fetchImpl), manifest).catch((e: unknown) => e)
    expect((error as Error).message).not.toContain(KEYS[provider])
    expect(failureOf(error).cause).not.toBe('unknown')
  })
})

describe('askDecisions error wording, per provider', () => {
  it('removes an echoed key from a provider message', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(400, { error: { message: `Invalid value near ${KEYS.luna}` } }),
    )
    const error = (await askDecisions(ctxOf('luna', fetchImpl), manifest).catch(
      (e: unknown) => e,
    )) as Error
    expect(error.message).not.toContain(KEYS.luna)
    expect(error.message).toContain('[key removed]')
  })

  it('names an invalid key as such', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(401, { error: { message: 'bad' } }))
    const error = (await askDecisions(ctxOf('luna', fetchImpl), manifest).catch(
      (e: unknown) => e,
    )) as Error
    expect(error.message).toMatch(/key was rejected/i)
  })

  it('treats a non-JSON success body as a bad response, cause unreadable', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('<html>oops</html>'))
    const error = await askDecisions(ctxOf('luna', fetchImpl), manifest).catch((e: unknown) => e)
    expect(failureOf(error).cause).toBe('unreadable')
  })

  it('tells offline from refused on OpenAI by the browser connection state', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const online = vi.spyOn(window.navigator, 'onLine', 'get')
    online.mockReturnValue(false)
    const offline = await askDecisions(ctxOf('luna', fetchImpl), manifest).catch((e: unknown) => e)
    online.mockReturnValue(true)
    const refused = await askDecisions(ctxOf('luna', fetchImpl), manifest).catch((e: unknown) => e)
    online.mockRestore()
    expect(failureOf(offline).cause).toBe('offline')
    expect(failureOf(refused).cause).toBe('refused')
  })

  it('an error that never reached the adapter is described as unknown', () => {
    expect(failureOf(new Error('boom')).cause).toBe('unknown')
  })
})
