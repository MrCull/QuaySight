import { describe, it, expect, vi, afterEach } from 'vitest'
import { callJev } from '../jev'
import { JevError, JEV_ENDPOINT, JEV_IMAGE_HEADER } from '../../domain/jev'

const KEY = 'test-only-key-value-0000'
const ID = ['A', 'P', 'H', 'U', '6', '5', '8', '6', '8', '4', '7']
const photo = new Blob(['not-really-a-jpeg'], { type: 'image/jpeg' })

function okBody() {
  const answers: Record<string, unknown> = {}
  ID.forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: 0.95, unreadable: 0.05 },
      confidence: 0.95,
    }
  })
  return { model: 'jev-1.13.0', answers, usage: { input_tokens: 1234, output_tokens: 0 } }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('callJev', () => {
  it('posts once to System One with the key only in Authorization and the photo as a multipart part', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, okBody()))
    const result = await callJev({ apiKey: KEY, photo, model: 'jev-latest', fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(JEV_ENDPOINT)
    expect(url).not.toContain('openai')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(headers[JEV_IMAGE_HEADER]).toBe('true')

    const form = init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    const requestText = await (form.get('request') as Blob).text()
    expect(requestText).not.toContain(KEY)
    const requestJson = JSON.parse(requestText)
    expect(requestJson.model).toBe('jev-latest')
    expect(requestJson.assets.photo_1).toEqual({ type: 'image', part: 'photo_1', format: 'jpeg' })
    expect(form.get('photo_1')).toBeInstanceOf(Blob)

    expect(result.containerId.value).toBe('APHU6586847')
    expect(result.resolvedModel).toBe('jev-1.13.0')
    expect(result.usage).toEqual({ inputTokens: 1234, outputTokens: 0 })
    expect(result.reportedCostUsd).toBeNull()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('refuses a WebP photo before any network call, because Jev takes PNG or JPEG', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, okBody()))
    const webp = new Blob(['x'], { type: 'image/webp' })
    const error = (await callJev({
      apiKey: KEY,
      photo: webp,
      model: 'jev-latest',
      fetchImpl,
    }).catch((e: unknown) => e)) as JevError
    expect(error).toBeInstanceOf(JevError)
    expect(error.kind).toBe('photo')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a network failure without the key or the underlying error text', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError(`Failed to fetch ${KEY}`)
    })
    const error = (await callJev({ apiKey: KEY, photo, model: 'jev-latest', fetchImpl }).catch(
      (e: unknown) => e,
    )) as JevError
    expect(error.kind).toBe('network')
    expect(error.message).not.toContain(KEY)
    expect(error.message).toMatch(/could not reach typesafe/i)
  })

  it('translates an invalid key without echoing it', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(401, { error: { message: 'no' } }),
    )
    const error = (await callJev({ apiKey: KEY, photo, model: 'jev-latest', fetchImpl }).catch(
      (e: unknown) => e,
    )) as JevError
    expect(error.status).toBe(401)
    expect(error.message).toMatch(/TypeSafe console key/)
    expect(error.message).not.toContain(KEY)
  })

  it('treats a non-JSON success body as a bad response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('<html>oops</html>', { status: 200 }),
    )
    const error = (await callJev({ apiKey: KEY, photo, model: 'jev-latest', fetchImpl }).catch(
      (e: unknown) => e,
    )) as JevError
    expect(error.kind).toBe('bad-response')
  })
})
