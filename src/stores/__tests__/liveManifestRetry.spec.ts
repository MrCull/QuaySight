import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
// A fake photo is a blob whose text is its size; the fake JPEG's text is "jpeg <w>x<h>".
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'

// The manifest check after a LIVE first result whose container ID was not fully read (spec 3.2, 8.5):
// one live call on the same provider and model with the photo as sent, never a recorded replay.
// (Demo mode's recorded check is in demoMode.spec.ts.)

const KEY = 'test-only-openrouter-key-0000'
const OPENAI_KEY = 'test-only-openai-key-0000'
const OPENROUTER_HOST = 'https://openrouter.ai/api/alpha/decisions'
const OPENAI_HOST = 'https://api.openai.com/v1/decisions'

// The recorded fixtures read APHU6586847. A replay would land that; the live answers below never do.
const MANIFEST = ['MSCU4417305', 'APHU6586847', 'TGHU1234567']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface SentRequest {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  rawBody: string
}

function sent(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call: number): SentRequest {
  const [input, init] = fetchMock.mock.calls[call]!
  const rawBody = String(init?.body)
  return {
    url: String(input),
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: JSON.parse(rawBody) as Record<string, unknown>,
    rawBody,
  }
}

/** OpenRouter Jev answers for the first pass, '?' leaving a position unread. */
function jevFirstPass(id: string) {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] =
      ch === '?'
        ? {
            type: 'choice',
            choice: 'unreadable',
            probabilities: { unreadable: 0.9, '1': 0.1 },
            confidence: 0.8,
          }
        : { type: 'choice', choice: ch, probabilities: { [ch]: 0.97 }, confidence: 0.94 }
  })
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1844, output_tokens: 75, cost: 0.000077 },
    id: 'gen-dec-first',
    provider: 'TypeSafe',
  }
}

type OpenRouterQuestion = { type: string; instructions: string; criteria: Record<string, unknown> }

/**
 * Answers an OpenRouter manifest request: `pick` for the question that offers it, the not-listed
 * option (the one key that is not a pasted entry) for every other question.
 */
function openRouterManifestAnswer(
  rawBody: string,
  pick: string | null,
  probability = 0.93,
  cost = 0.000081,
) {
  const body = JSON.parse(rawBody) as { questions: Record<string, OpenRouterQuestion> }
  const answers: Record<string, unknown> = {}
  for (const [name, question] of Object.entries(body.questions)) {
    const options = Object.keys(question.criteria)
    const notListed = options.find((o) => !MANIFEST.includes(o))!
    const choice = pick && options.includes(pick) ? pick : notListed
    const probabilities: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]))
    probabilities[choice] = choice === pick ? probability : 0.95
    if (choice === pick) probabilities[notListed] = 1 - probability
    else probabilities[notListed] = 0.95
    answers[name] = { type: 'choice', choice, probabilities, confidence: 0.9 }
  }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1910, output_tokens: 6, cost },
    id: 'gen-dec-manifest',
    provider: 'TypeSafe',
  }
}

import { onlyRequests } from '../../plan/registry'
import { readId } from '../../plan/requests/readId'
import { idRecheck } from '../../plan/requests/idRecheck'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(readId, idRecheck)
})
afterAll(() => restoreRequests())

describe('manifest check after a live inspection', () => {
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

  async function partlyReadOnOpenRouter() {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('typesafe/jev-1.14')
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'rear.jpg',
      url: 'blob:original',
      orientation: 'portrait',
      file: new Blob(['1536x2048'], { type: 'image/jpeg' }),
    })
    fetchMock.mockResolvedValueOnce(json(jevFirstPass('MSCU44173??')))
    await store.start()
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('MSCU44173??')
    return store
  }

  it('asks the same OpenRouter model, with the photo as sent, which pasted entry is on the container', async () => {
    const store = await partlyReadOnOpenRouter()
    const ledger = useLedgerStore()
    fetchMock.mockImplementationOnce(async (_input, init) =>
      json(openRouterManifestAnswer(String(init?.body), 'MSCU4417305')),
    )

    await store.retryManifest(MANIFEST)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = sent(fetchMock, 0)
    const check = sent(fetchMock, 1)
    expect(check.url).toBe(OPENROUTER_HOST)
    expect(check.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(check.body.model).toBe('typesafe/jev-1.14')
    // The photo as sent for the first reading, not the chosen file.
    expect(check.body.state).toEqual([expect.any(String), (first.body.state as unknown[])[1]])
    const questions = Object.values(check.body.questions as Record<string, OpenRouterQuestion>)
    expect(questions.every((q) => q.type === 'choice')).toBe(true)
    const offered = questions.flatMap((q) => Object.keys(q.criteria))
    for (const id of MANIFEST) expect(offered).toContain(id)
    // Each question also offers "not listed".
    for (const q of questions) expect(Object.keys(q.criteria)).toHaveLength(MANIFEST.length + 1)
    expect(check.rawBody).not.toContain(KEY)

    // The model's choice replaces the ID in place, marked as a manifest match.
    const reading = store.record?.containerId
    expect(reading?.value).toBe('MSCU4417305')
    expect(reading?.provenance).toBe('manifest')
    expect(reading?.manifestChecked).toBe(true)
    expect(store.retry.status).toBe('idle')
    expect(store.retry.noMatch).toBe(false)

    // Its own ledger line, on the same inspection, priced from the reported cost.
    const entries = ledger.entries()
    expect(entries).toHaveLength(2)
    const line = entries[1]!
    expect(line.inspectionId).toBe(store.record?.id)
    expect(line.purpose).toBe('Checking against manifest')
    expect(line.provider).toBe('openrouter')
    expect(line.model).toBe('typesafe/jev-1.14')
    expect(line.resolvedModel).toBe('typesafe/jev-1.14-20261014')
    expect(line.status).toBe('complete')
    expect(line.costState).toBe('reported')
    expect(line.costUsd).toBe(0.000081)
    expect(JSON.stringify(entries)).not.toContain(KEY)
    expect(JSON.stringify(store.record)).not.toContain(KEY)
  })

  it('offers the check while the live ID is partly read, and not once it is read in full', async () => {
    const store = await partlyReadOnOpenRouter()
    expect(store.manifestRetryOffered).toBe(true)

    fetchMock.mockResolvedValueOnce(json(jevFirstPass('MSCU4417305')))
    await store.start()
    expect(store.record?.containerId?.value).toBe('MSCU4417305')
    expect(store.manifestRetryOffered).toBe(false)
  })

  it('keeps the first result when the model answers not listed, and never lands a recorded reading', async () => {
    const store = await partlyReadOnOpenRouter()
    const ledger = useLedgerStore()
    const first = store.record?.containerId
    fetchMock.mockImplementationOnce(async (_input, init) =>
      json(openRouterManifestAnswer(String(init?.body), null)),
    )

    await store.retryManifest(MANIFEST)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.record?.containerId).toEqual(first)
    expect(store.retry.status).toBe('idle')
    expect(store.retry.noMatch).toBe(true)
    // The check ran and was charged: its own ledger line and its raw response in the record.
    expect(ledger.entries()).toHaveLength(2)
    expect(ledger.entries()[1]?.purpose).toBe('Checking against manifest')
    expect(store.record?.rawResponses).toHaveLength(2)
    expect(store.record?.rawResponses[1]?.capturedFrom).toBe('provider')
  })

  it('reports a failed check with the provider message, keeps the first result, and Try again sends the same entries', async () => {
    const store = await partlyReadOnOpenRouter()
    const ledger = useLedgerStore()
    const first = store.record?.containerId
    fetchMock.mockResolvedValueOnce(
      json({ error: { message: 'Rate limit exceeded', code: 429 } }, 429),
    )

    await store.retryManifest(MANIFEST)

    expect(store.record?.containerId).toEqual(first)
    expect(store.retry.status).toBe('error')
    expect(store.retry.message).toBe(
      'OpenRouter rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
    )
    expect(store.retry.message).not.toContain(KEY)
    expect(ledger.entries()[1]?.status).toBe('failed')

    fetchMock.mockImplementationOnce(async (_input, init) =>
      json(openRouterManifestAnswer(String(init?.body), 'TGHU1234567')),
    )
    await store.retryManifest(store.retry.ids)
    for (const id of MANIFEST) expect(sent(fetchMock, 2).rawBody).toContain(id)
    expect(store.record?.containerId?.value).toBe('TGHU1234567')
    expect(store.retry.status).toBe('idle')
    expect(ledger.entries()).toHaveLength(3)
  })

  it('claims no match when the model picks an entry too weakly to tell', async () => {
    const store = await partlyReadOnOpenRouter()
    const first = store.record?.containerId
    fetchMock.mockImplementationOnce(async (_input, init) =>
      json(openRouterManifestAnswer(String(init?.body), 'APHU6586847', 0.25)),
    )

    await store.retryManifest(MANIFEST)

    expect(store.record?.containerId).toEqual(first)
    expect(store.retry.noMatch).toBe(true)
  })

  it('does not run for an empty list', async () => {
    const store = await partlyReadOnOpenRouter()
    await store.retryManifest([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.retry.status).toBe('idle')
  })

  it('is stopped by the per-inspection cap like any live call', async () => {
    const store = await partlyReadOnOpenRouter()
    const ledger = useLedgerStore()
    // A check whose reported cost uses up the inspection's spend limit.
    fetchMock.mockImplementationOnce(async (_input, init) =>
      json(openRouterManifestAnswer(String(init?.body), null, 0.93, 0.06)),
    )
    await store.retryManifest(MANIFEST)

    await store.retryManifest(MANIFEST)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.retry.status).toBe('error')
    expect(store.retry.message).toBe(
      'This inspection has reached its spend limit. Start a new photo to run again.',
    )
    expect(ledger.entries()).toHaveLength(2)
  })

  it('is cancelled by New inspection: a late answer never lands on the blank screen', async () => {
    const store = await partlyReadOnOpenRouter()
    let answer!: (response: Response) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )
    const pending = store.retryManifest(MANIFEST)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(store.retry.status).toBe('checking')

    store.newInspection()
    answer(json(openRouterManifestAnswer(sent(fetchMock, 1).rawBody, 'MSCU4417305')))
    await pending

    expect(store.record).toBeNull()
    expect(store.retry.status).toBe('idle')
    expect(store.retry.ids).toEqual([])
    expect(store.manifestRetryOffered).toBe(false)
  })

  it('splits a long manifest over several questions in the one call, each saying it is only part', async () => {
    const store = await partlyReadOnOpenRouter()
    const long = Array.from({ length: 300 }, (_, i) => `ABCU${String(100000 + i)}0`)
    fetchMock.mockImplementationOnce(async () =>
      json({ model: 'typesafe/jev-1.14-20261014', answers: {}, usage: { input_tokens: 9000 } }),
    )

    await store.retryManifest(long)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const questions = Object.values(
      sent(fetchMock, 1).body.questions as Record<string, OpenRouterQuestion>,
    )
    expect(questions).toHaveLength(2)
    for (const q of questions) {
      expect(Object.keys(q.criteria).length).toBeLessThanOrEqual(255)
      expect(q.instructions).toMatch(/part \d of 2/)
    }
    const offered = new Set(questions.flatMap((q) => Object.keys(q.criteria)))
    for (const id of long) expect(offered.has(id)).toBe(true)
    // No answers: nothing matched.
    expect(store.retry.noMatch).toBe(true)
  })

  it('on OpenAI direct, asks GPT-6 Luna at api.openai.com with the OpenAI key only', async () => {
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setProvider('luna')
    store.setApiKey(OPENAI_KEY)
    store.setPhoto({
      name: 'rear.jpg',
      url: 'blob:original',
      orientation: 'landscape',
      file: new Blob(['2048x1536'], { type: 'image/jpeg' }),
    })
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        questions: { name: string; choices: { value: string }[] }[]
      }
      const answers = body.questions.map((q) => {
        if (q.name.startsWith('manifest_')) {
          return {
            name: q.name,
            type: 'choice',
            choice: 'MSCU4417305',
            probabilities: q.choices.map((c) => ({
              value: c.value,
              probability: c.value === 'MSCU4417305' ? 0.95 : 0.01,
            })),
          }
        }
        // First pass and re-check: positions 10 and 11 stay unread.
        const position = Number(q.name.slice(-2))
        const ch = 'MSCU4417305'[position - 1]!
        return position >= 10
          ? {
              name: q.name,
              type: 'choice',
              choice: ch,
              probabilities: [{ value: ch, probability: 0.2 }],
            }
          : {
              name: q.name,
              type: 'choice',
              choice: ch,
              probabilities: [{ value: ch, probability: 0.97 }],
            }
      })
      return json({ model: 'gpt-6-luna-20260922', answers, usage: { input_tokens: 1200 } })
    })

    await store.start()
    expect(store.record?.containerId?.value).toBe('MSCU44173??')
    const before = fetchMock.mock.calls.length

    await store.retryManifest(MANIFEST)

    expect(fetchMock).toHaveBeenCalledTimes(before + 1)
    const check = sent(fetchMock, before)
    expect(check.url).toBe(OPENAI_HOST)
    expect(check.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`)
    expect(check.body.model).toBe('gpt-6-luna')
    const [question] = check.body.questions as { type: string; choices: { value: string }[] }[]
    expect(question?.type).toBe('choice')
    expect(question?.choices.map((c) => c.value)).toEqual([...MANIFEST, 'other_not_listed'])
    expect(check.rawBody).not.toContain(OPENAI_KEY)

    expect(store.record?.containerId?.value).toBe('MSCU4417305')
    expect(store.record?.containerId?.provenance).toBe('manifest')
    const line = ledger.entries()[ledger.entries().length - 1]!
    expect(line.purpose).toBe('Checking against manifest')
    expect(line.provider).toBe('luna')
    expect(line.costState).toBe('estimated')
  })
})
