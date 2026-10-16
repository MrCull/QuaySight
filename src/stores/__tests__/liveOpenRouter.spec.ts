import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
// A fake photo is a blob whose text is its size; the fake JPEG's text is "jpeg <w>x<h>".
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { buildInspectionExport } from '../../domain/exports'
import probe from '../../fixtures/live/openrouter-probe.json'

const KEY = 'test-only-openrouter-key-0000'
const OPENAI_KEY = 'test-only-openai-key-0000'

interface SentRequest {
  url: string
  headers: Record<string, string>
  body: {
    model: string
    state: [string, { type: string; image_url: { url: string } }]
    questions: Record<string, { type: string; instructions: string; criteria?: unknown }>
  }
  rawBody: string
}

function fakePhoto(width: number, height: number): Blob {
  return new Blob([`${width}x${height}`], { type: 'image/jpeg' })
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>, file = fakePhoto(1536, 2048)) {
  store.setPhoto({ name: 'rear.jpg', url: 'blob:original', orientation: 'portrait', file })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenRouter Jev answer set reading the given ID, in the response shape seen live on 16 Oct 2026. */
function jevBody(
  id = 'APHU6586847',
  usage: Record<string, number> | null = {
    input_tokens: 1844,
    output_tokens: 75,
    cost: 0.000077448,
  },
) {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: 0.97, unreadable: 0.03 },
      confidence: 0.94,
    }
  })
  answers.legibility = {
    type: 'score',
    score: 3.6,
    legend: { '0': 'Not visible at all', '4': 'Fully readable and sharp' },
    probabilities: { '3': 0.4, '4': 0.6 },
    confidence: 0.5,
  }
  answers.full_number_visible = { type: 'noul', noul: 0.96 }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    ...(usage ? { usage } : {}),
    id: 'gen-dec-test',
    provider: 'TypeSafe',
  }
}

function sent(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call = 0): SentRequest {
  const [input, init] = fetchMock.mock.calls[call]!
  const rawBody = String(init?.body)
  return {
    url: String(input),
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: JSON.parse(rawBody) as SentRequest['body'],
    rawBody,
  }
}

describe('live Jev through OpenRouter in the store', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function liveStore(model?: string) {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    if (model) store.setModel(model)
    store.setApiKey(KEY)
    choosePhoto(store)
    return store
  }

  it('starts on OpenRouter with Jev latest, the pre-selected choice', () => {
    const store = useInspectionStore()
    expect(store.provider).toBe('openrouter')
    expect(store.model).toBe('~typesafe/jev-latest')
  })

  it("sends the request only to OpenRouter's Decisions endpoint, with the key only in the Authorization header", async () => {
    fetchMock.mockResolvedValue(json(jevBody()))
    const store = liveStore()

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = sent(fetchMock)
    expect(request.url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(request.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(request.headers['content-type']).toBe('application/json')
    expect(request.headers['x-title']).toBe('Quay Sight')
    expect(request.headers['http-referer']).toBe('https://quay-sight.com')
    const elsewhere = Object.entries(request.headers).filter(([name]) => name !== 'authorization')
    expect(JSON.stringify(elsewhere)).not.toContain(KEY)
    expect(request.url).not.toContain(KEY)
    expect(request.rawBody).not.toContain(KEY)
  })

  it('sends the prepared photo as a JPEG data-URL part after the instructions, with the Jev question set', async () => {
    fetchMock.mockResolvedValue(json(jevBody()))
    const store = liveStore()

    await store.start()

    const { body } = sent(fetchMock)
    expect(body.model).toBe('~typesafe/jev-latest')
    expect(body.state).toHaveLength(2)
    expect(typeof body.state[0]).toBe('string')
    expect(body.state[1].type).toBe('image_url')
    const [, type = '', data = ''] =
      /^data:([^;]+);base64,(.*)$/.exec(body.state[1].image_url.url) ?? []
    // Fitted to Jev's 1,568 px per side.
    expect({ type, text: atob(data) }).toEqual({ type: 'image/jpeg', text: 'jpeg 1176x1568' })

    expect(body.questions.id_char_01).toMatchObject({ type: 'choice' })
    expect(body.questions.id_char_01?.criteria).toMatchObject({
      A: 'Letter A',
      unreadable: expect.any(String),
    })
    expect(body.questions.id_char_11?.instructions).toContain(
      'Read only the single digit in the drawn box, exactly as printed.',
    )
    expect(body.questions.legibility).toMatchObject({ type: 'score', criteria: expect.any(Array) })
    expect(body.questions.full_number_visible).toMatchObject({ type: 'noul' })
    // The survey: the Jev ID set (eleven characters, legibility, full number, box), then the details.
    expect(Object.keys(body.questions).slice(0, 14)).toEqual([
      ...Array.from({ length: 11 }, (_, i) => `id_char_${String(i + 1).padStart(2, '0')}`),
      'legibility',
      'full_number_visible',
      'container_box',
    ])
    expect(body.questions.size_type_code).toMatchObject({ type: 'choice' })
  })

  it('asks the box question only on box-capable models', async () => {
    fetchMock.mockImplementation(async () => json(jevBody()))
    const boxOf = async (model: string) => {
      setActivePinia(createPinia())
      fetchMock.mockClear()
      await liveStore(model).start()
      return sent(fetchMock).body.questions.container_box?.type
    }

    expect(await boxOf('~typesafe/jev-latest')).toBe('box')
    expect(await boxOf('typesafe/jev-1.14')).toBe('box')
    expect(await boxOf('typesafe/jev-1.13')).toBeUndefined()
  })

  it('maps the answers to the shared record and records the resolved model OpenRouter reports', async () => {
    const response = jevBody()
    fetchMock.mockResolvedValue(json(response))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.errorMessage).toBeNull()
    expect(store.record).toMatchObject({
      source: 'live',
      provider: 'openrouter',
      model: '~typesafe/jev-latest',
      resolvedVersion: 'typesafe/jev-1.14-20261014',
      photo: { name: 'rear.jpg', orientation: 'portrait' },
    })
    expect(store.record?.containerId).toMatchObject({
      value: 'APHU6586847',
      checkDigitValid: true,
      certainty: 'Confident',
    })
    expect(store.record?.rawResponses).toEqual([
      expect.objectContaining({ provider: 'openrouter', capturedFrom: 'provider', body: response }),
    ])
    expect(JSON.stringify(store.record)).not.toContain(KEY)
  })

  it('puts the cost OpenRouter reports in the ledger as provider-reported', async () => {
    fetchMock.mockResolvedValue(json(jevBody()))
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    expect(ledger.entries()).toEqual([
      expect.objectContaining({
        provider: 'openrouter',
        model: '~typesafe/jev-latest',
        resolvedModel: 'typesafe/jev-1.14-20261014',
        status: 'complete',
        usage: { inputTokens: 1844, outputTokens: 75 },
        costUsd: 0.000077448,
        costState: 'reported',
      }),
    ])
    expect(ledger.session).toMatchObject({ costUsd: 0.000077448, incomplete: false })
  })

  it('reads usage and cost from a real OpenRouter Jev response', async () => {
    fetchMock.mockResolvedValue(json(probe.jevLatest.response))
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    expect(store.record?.resolvedVersion).toBe('typesafe/jev-1.14-20261014')
    expect(ledger.entries()[0]).toMatchObject({ costUsd: 0.000077448, costState: 'reported' })
  })

  it('falls back to the rate-table estimate, marked as an estimate, when usage.cost is missing', async () => {
    fetchMock.mockResolvedValue(
      json(jevBody('APHU6586847', { input_tokens: 1844, output_tokens: 75 })),
    )
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    const [entry] = ledger.entries()
    expect(entry?.costState).toBe('estimated')
    // $0.042 per million input tokens, output free.
    expect(entry?.costUsd).toBeCloseTo(0.000077448, 12)
    expect(ledger.session.incomplete).toBe(false)
  })

  it('shows unknown cost as incomplete, never as free, when the response has no usage', async () => {
    fetchMock.mockResolvedValue(json(jevBody('APHU6586847', null)))
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(ledger.entries()[0]).toMatchObject({ costUsd: null, costState: 'unavailable' })
    expect(ledger.session).toMatchObject({ costUsd: null, incomplete: true })
  })

  it('attributes the run to model, maker and route in the export', async () => {
    fetchMock.mockResolvedValue(json(jevBody()))
    const store = liveStore('typesafe/jev-1.14')

    await store.start()

    expect(buildInspectionExport(store.record!).inspection).toMatchObject({
      provider: 'openrouter',
      providerName: 'Jev 1.14 (TypeSafe) via OpenRouter',
      model: 'typesafe/jev-1.14',
      resolvedVersion: 'typesafe/jev-1.14-20261014',
    })
  })

  it('keeps an unread position unread rather than filling it in', async () => {
    const body = jevBody()
    ;(body.answers as Record<string, unknown>).id_char_05 = {
      type: 'choice',
      choice: 'unreadable',
      probabilities: { unreadable: 0.9, '6': 0.1 },
      confidence: 0.8,
    }
    fetchMock.mockResolvedValue(json(body))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('APHU?586847')
  })

  it('never sends the OpenAI key to OpenRouter', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(OPENAI_KEY)
    store.setProvider('openrouter')
    choosePhoto(store)

    await store.start()

    expect(store.canStart).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('errors', () => {
    const cases: Array<[string, number, unknown, RegExp]> = [
      ['bad key', 401, probe.badKey.response, /OpenRouter rejected the key/],
      [
        'forbidden key',
        403,
        { error: { code: 403, message: 'Forbidden' } },
        /OpenRouter rejected the key/,
      ],
      [
        'no credit',
        402,
        {
          error: {
            code: 402,
            message: 'Insufficient credits. Add more using https://openrouter.ai/credits',
          },
        },
        /out of credit.*openrouter\.ai\/credits/,
      ],
      [
        'rate limited',
        429,
        { error: { code: 429, message: 'Rate limit exceeded' } },
        /rate limit/i,
      ],
      [
        'photo rejected for its dimensions',
        400,
        { error: { code: 400, message: 'HTTP 400: Invalid image dimensions' } },
        /rejected the photo.*1,568 px/,
      ],
      [
        'photo too large',
        413,
        { error: { code: 413, message: 'Request payload too large' } },
        /rejected the photo/,
      ],
      [
        'provider down',
        502,
        { error: { code: 502, message: 'Provider returned error' } },
        /unavailable right now/,
      ],
      [
        'provider overloaded',
        529,
        { error: { code: 529, message: 'Provider returned error' } },
        /unavailable right now/,
      ],
      [
        'request rejected',
        400,
        probe.boxOnJev113.response,
        /OpenRouter rejected the request \(400\)/,
      ],
      [
        'model not offered',
        404,
        { error: { code: 404, message: 'Model not found' } },
        /does not offer Jev latest/,
      ],
    ]

    it.each(cases)(
      '%s (%i) shows its own message, keeps the photo and never shows the key',
      async (_name, status, body, message) => {
        fetchMock.mockResolvedValue(json(body, status))
        const store = liveStore()
        const ledger = useLedgerStore()

        await store.start()

        expect(store.status).toBe('failed')
        expect(store.errorMessage).toMatch(message)
        expect(store.errorMessage).toMatch(/Any partial result is kept\.$/)
        expect(store.errorMessage).not.toContain(KEY)
        expect(store.photo?.url).toBe('blob:original')
        expect(ledger.entries()).toEqual([
          expect.objectContaining({ status: 'failed', provider: 'openrouter' }),
        ])
      },
    )

    it('removes the key from any provider text it echoes', async () => {
      fetchMock.mockResolvedValue(
        json({ error: { code: 400, message: `Bad header Bearer ${KEY}` } }, 400),
      )
      const store = liveStore()

      await store.start()

      expect(store.errorMessage).toMatch(/OpenRouter rejected the request \(400\)/)
      expect(store.errorMessage).not.toContain(KEY)
    })

    it('says it could not reach OpenRouter when the browser is offline', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      const store = liveStore()

      await store.start()

      expect(store.status).toBe('failed')
      expect(store.errorMessage).toMatch(/Could not reach OpenRouter/)
      expect(store.errorMessage).toMatch(/Any partial result is kept\.$/)
    })

    it('says the reply was not understood when OpenRouter answers without answers', async () => {
      fetchMock.mockResolvedValue(json({ model: 'typesafe/jev-1.14-20261014' }))
      const store = liveStore()

      await store.start()

      expect(store.status).toBe('failed')
      expect(store.errorMessage).toMatch(/OpenRouter replied without answers/)
      expect(store.errorMessage).toMatch(/Any partial result is kept\.$/)
    })
  })
})
