import { describe, it, expect, vi, afterEach } from 'vitest'
import { callLuna } from '../luna'
import { LunaError, LUNA_ENDPOINT } from '../../domain/luna'

const KEY = 'test-only-key-value-0000'
const ID = ['A', 'P', 'H', 'U', '6', '5', '8', '6', '8', '4', '7']

const photo = new Blob(['not-really-a-jpeg'], { type: 'image/jpeg' })

function okBody() {
  return {
    model: 'gpt-6-luna-20260922',
    answers: ID.map((ch, i) => ({
      type: 'choice',
      name: `id_char_${String(i + 1).padStart(2, '0')}`,
      choice: ch,
      probabilities: [{ value: ch, probability: 0.95 }],
      confidence: 0.95,
    })),
    usage: { input_tokens: 15780 },
  }
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

describe('callLuna', () => {
  it('posts once to the Decisions endpoint with the key only in the Authorization header', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, okBody()))
    const result = await callLuna({ apiKey: KEY, photo, fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(LUNA_ENDPOINT)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(String(init.body)).not.toContain(KEY)
    const body = JSON.parse(String(init.body))
    expect(body.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,')).toBe(true)

    expect(result.containerId.value).toBe('APHU6586847')
    expect(result.resolvedModel).toBe('gpt-6-luna-20260922')
    expect(result.usage).toEqual({ inputTokens: 15780, outputTokens: null })
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports a network failure without the key or the underlying error text', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError(`Failed to fetch ${KEY}`)
    })
    const error = await callLuna({ apiKey: KEY, photo, fetchImpl }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LunaError)
    expect((error as LunaError).kind).toBe('network')
    expect((error as Error).message).not.toContain(KEY)
    expect((error as Error).message).toMatch(/could not reach openai/i)
  })

  it('translates an HTTP failure and removes an echoed key from the message', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(400, { error: { message: `Invalid value near ${KEY}` } }),
    )
    const error = (await callLuna({ apiKey: KEY, photo, fetchImpl }).catch((e: unknown) => e)) as LunaError
    expect(error).toBeInstanceOf(LunaError)
    expect(error.status).toBe(400)
    expect(error.message).not.toContain(KEY)
    expect(error.message).toContain('[key removed]')
  })

  it('reports an invalid key as an actionable message', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, { error: { message: 'bad key' } }))
    const error = (await callLuna({ apiKey: KEY, photo, fetchImpl }).catch((e: unknown) => e)) as LunaError
    expect(error.status).toBe(401)
    expect(error.message).toMatch(/key was rejected/i)
  })

  it('treats a non-JSON success body as a bad response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('<html>oops</html>', { status: 200 }))
    const error = (await callLuna({ apiKey: KEY, photo, fetchImpl }).catch((e: unknown) => e)) as LunaError
    expect(error).toBeInstanceOf(LunaError)
    expect(error.kind).toBe('bad-response')
  })
})
