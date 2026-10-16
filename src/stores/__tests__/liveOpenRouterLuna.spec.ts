import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
// A fake photo is a blob whose text is its size; the fake JPEG's text is "jpeg <w>x<h>".
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { buildInspectionExport } from '../../domain/exports'

const KEY = 'test-only-openrouter-key-0000'
const OPENAI_KEY = 'test-only-openai-key-0000'
const MODEL = 'openai/gpt-6-luna-decisions'

/** The printed layout every character question describes (ticket #29). */
const LAYOUT =
  'The container number on this photo is printed as four capital letters, a gap, a six-digit group, then a single digit in a drawn box.'

/** Any trace of the check-digit calculation, which is never put in front of the model. */
const CHECK_DIGIT_ALGORITHM = /modulo|remainder|A=10|multiply/i

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

function choosePhoto(store: ReturnType<typeof useInspectionStore>, file = fakePhoto(3072, 4096)) {
  store.setPhoto({ name: 'rear.jpg', url: 'blob:original', orientation: 'portrait', file })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Probabilities = Record<string, number>

const questionName = (position: number) => `id_char_${String(position).padStart(2, '0')}`

/** Hand-written answers for APHU6586847: position 5 is a likely 6 with 8 as the runner-up. */
function answersFor(id = 'APHU6586847'): Probabilities[] {
  return id.split('').map((ch, i) => {
    if (i === 4) return { '6': 0.7, '8': 0.25, '0': 0.05 }
    return { [ch]: 0.97, [i < 4 ? 'Z' : '0']: 0.03 }
  })
}

const best = (p: Probabilities) => Object.entries(p).sort((a, b) => b[1] - a[1])[0]![0]

/** An OpenRouter Luna Decisions reply, in the response shape seen live on 16 Oct 2026. */
function lunaBody(
  perPosition: Array<Probabilities | null> = answersFor(),
  usage: Record<string, number> | null = { input_tokens: 3355, output_tokens: 0, cost: 0.0003355 },
) {
  const answers: Record<string, unknown> = {}
  perPosition.forEach((p, i) => {
    if (!p) return
    answers[questionName(i + 1)] = {
      type: 'choice',
      choice: best(p),
      probabilities: p,
      confidence: 0.9,
    }
  })
  return {
    model: 'openai/gpt-6-luna-decisions-20261006',
    answers,
    ...(usage ? { usage } : {}),
    id: 'gen-dec-test',
    provider: 'OpenAI',
  }
}

/** The same answers in OpenAI's own Decisions reply, as the direct route returns them. */
function directLunaBody(perPosition: Probabilities[] = answersFor()) {
  return {
    model: 'gpt-6-luna',
    answers: perPosition.map((p, i) => ({
      type: 'choice',
      name: questionName(i + 1),
      choice: best(p),
      probabilities: Object.entries(p).map(([value, probability]) => ({ value, probability })),
    })),
    usage: { input_tokens: 3355, output_tokens: 0 },
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

describe('live GPT-6 Luna Decisions through OpenRouter in the store', () => {
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

  function liveStore() {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel(MODEL)
    store.setApiKey(KEY)
    choosePhoto(store)
    return store
  }

  it("sends the Luna question set, with no check-digit calculation, in OpenRouter's question format and with no box question", async () => {
    fetchMock.mockResolvedValue(json(lunaBody()))
    const store = liveStore()

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = sent(fetchMock)
    expect(request.url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(request.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(request.rawBody).not.toContain(KEY)

    const { body } = request
    expect(body.model).toBe(MODEL)
    expect(body.state[0]).toContain('Read the container identification')
    expect(request.rawBody).not.toMatch(CHECK_DIGIT_ALGORITHM)
    expect(body.state[1].type).toBe('image_url')
    const [, type = '', data = ''] =
      /^data:([^;]+);base64,(.*)$/.exec(body.state[1].image_url.url) ?? []
    // Fitted to Luna's 2,048 px on the long side.
    expect({ type, text: atob(data) }).toEqual({ type: 'image/jpeg', text: 'jpeg 1536x2048' })

    // The survey: eleven position questions first, each a choice with OpenRouter's criteria map, then the
    // container details.
    expect(Object.keys(body.questions).slice(0, 12)).toEqual([
      ...Array.from({ length: 11 }, (_, i) => `id_char_${String(i + 1).padStart(2, '0')}`),
      'size_type_code',
    ])
    expect(body.questions.id_char_01).toEqual({
      type: 'choice',
      instructions: `${LAYOUT} Read only the first letter of the four-letter group.`,
      criteria: Object.fromEntries(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => [letter, `Letter ${letter}`]),
      ),
    })
    expect(body.questions.id_char_11).toEqual({
      type: 'choice',
      instructions: `${LAYOUT} Read only the single digit in the drawn box, exactly as printed.`,
      criteria: Object.fromEntries(
        '0123456789'.split('').map((digit) => [digit, `Digit ${digit}`]),
      ),
    })
    expect(Object.values(body.questions).some((q) => q.type === 'box')).toBe(false)
  })

  it('maps the answers to the same shared record as direct Luna, and records the resolved model', async () => {
    fetchMock.mockResolvedValue(json(directLunaBody()))
    const direct = useInspectionStore()
    direct.setProvider('luna')
    direct.setApiKey(OPENAI_KEY)
    choosePhoto(direct)
    await direct.start()
    const directReading = direct.record?.containerId

    setActivePinia(createPinia())
    const response = lunaBody()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(json(response))
    const store = liveStore()
    await store.start()

    expect(store.status).toBe('complete')
    expect(store.errorMessage).toBeNull()
    expect(directReading).toMatchObject({
      value: 'APHU6586847',
      checkDigitValid: true,
      certainty: 'Likely',
      alternatives: ['APHU8586847'],
    })
    expect(store.record?.containerId).toEqual(directReading)
    expect(store.record).toMatchObject({
      source: 'live',
      provider: 'openrouter',
      model: MODEL,
      resolvedVersion: 'openai/gpt-6-luna-decisions-20261006',
    })
    expect(store.record?.rawResponses).toEqual([
      expect.objectContaining({ provider: 'openrouter', capturedFrom: 'provider', body: response }),
    ])
    expect(JSON.stringify(store.record)).not.toContain(KEY)
  })

  it('puts the cost OpenRouter reports in the ledger as provider-reported', async () => {
    fetchMock.mockResolvedValue(json(lunaBody()))
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    expect(ledger.entries()).toEqual([
      expect.objectContaining({
        provider: 'openrouter',
        model: MODEL,
        resolvedModel: 'openai/gpt-6-luna-decisions-20261006',
        status: 'complete',
        usage: { inputTokens: 3355, outputTokens: 0 },
        costUsd: 0.0003355,
        costState: 'reported',
      }),
    ])
    expect(ledger.session).toMatchObject({ costUsd: 0.0003355, incomplete: false })
  })

  it('falls back to the rate-table estimate, marked as an estimate, when usage.cost is missing', async () => {
    fetchMock.mockResolvedValue(
      json(lunaBody(answersFor(), { input_tokens: 3355, output_tokens: 0 })),
    )
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    const [entry] = ledger.entries()
    expect(entry?.costState).toBe('estimated')
    // $0.10 per million input tokens, output free: what OpenRouter charged on 16 Oct 2026.
    expect(entry?.costUsd).toBeCloseTo(0.0003355, 12)
    expect(ledger.session.incomplete).toBe(false)
  })

  it('attributes the run to model, maker and route in the export', async () => {
    fetchMock.mockResolvedValue(json(lunaBody()))
    const store = liveStore()

    await store.start()

    expect(buildInspectionExport(store.record!).inspection).toMatchObject({
      provider: 'openrouter',
      providerName: 'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      model: MODEL,
      resolvedVersion: 'openai/gpt-6-luna-decisions-20261006',
    })
  })

  it('re-asks only the unread positions once, through OpenRouter on the same model, and merges the answer', async () => {
    // Positions 7 and 9 are unanswered on the first pass; the re-check reads them.
    const first = answersFor().map((p, i) => (i === 6 || i === 8 ? null : p))
    const recheck = answersFor().map((p, i) => (i === 6 || i === 8 ? p : null))
    fetchMock
      .mockResolvedValueOnce(json(lunaBody(first)))
      .mockResolvedValueOnce(
        json(lunaBody(recheck, { input_tokens: 2100, output_tokens: 0, cost: 0.00021 })),
      )
    const store = liveStore()
    const ledger = useLedgerStore()

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const again = sent(fetchMock, 1)
    expect(again.url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(again.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(again.body.model).toBe(MODEL)
    expect(again.rawBody).not.toMatch(CHECK_DIGIT_ALGORITHM)
    expect(Object.keys(again.body.questions)).toEqual(['id_char_07', 'id_char_09'])

    expect(store.record?.containerId?.value).toBe('APHU6586847')
    expect(store.record?.rechecks).toEqual([
      expect.objectContaining({ provider: 'openrouter', model: MODEL }),
    ])
    expect(ledger.entries()).toEqual([
      expect.objectContaining({ provider: 'openrouter', model: MODEL, costUsd: 0.0003355 }),
      expect.objectContaining({
        provider: 'openrouter',
        model: MODEL,
        costUsd: 0.00021,
        costState: 'reported',
      }),
    ])
  })

  it.each([
    [
      404,
      { error: { code: 404, message: 'Model not found' } },
      /does not offer GPT-6 Luna Decisions/,
    ],
    [401, { error: { code: 401, message: 'User not found.' } }, /OpenRouter rejected the key/],
    [200, { model: 'openai/gpt-6-luna-decisions-20261006' }, /OpenRouter replied without answers/],
  ])(
    'a %i reply shows an OpenRouter message about the Luna model and never the key',
    async (status, body, message) => {
      fetchMock.mockResolvedValue(json(body, status))
      const store = liveStore()

      await store.start()

      expect(store.status).toBe('failed')
      expect(store.errorMessage).toMatch(message)
      expect(store.errorMessage).not.toContain(KEY)
      expect(store.photo?.url).toBe('blob:original')
    },
  )
})
