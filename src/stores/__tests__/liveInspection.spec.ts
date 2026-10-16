import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { LUNA_ENDPOINT } from '../../domain/luna'
import { jsonResponse, openAiSurveyReply } from '../../__tests__/surveyReplies'

const KEY = 'test-only-key-value-0000'

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

/** The survey's reply reading this ID, as the dated model with the usage the cost estimate rests on. */
function reply(id = 'APHU6586847') {
  return jsonResponse(openAiSurveyReply(id, { model: 'gpt-6-luna-20260922', inputTokens: 15780 }))
}

import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck)
})
afterAll(() => restoreRequests())

describe('live Luna inspection in the store', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('will not start until a Luna key is entered, then runs live', () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    choosePhoto(store)
    expect(store.canStart).toBe(false)
    store.setApiKey(KEY)
    expect(store.canStart).toBe(true)
    expect(store.mode).toBe('live')
  })

  it('does not send the OpenAI key to OpenRouter, and will not start without an OpenRouter key', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.setProvider('openrouter')
    expect(store.canStart).toBe(false)
    choosePhoto(store)
    await store.start()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('runs one chargeable call through the ledger and records the live result', async () => {
    fetchMock.mockResolvedValue(reply())
    const store = useInspectionStore()
    store.setProvider('luna')
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(LUNA_ENDPOINT)
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${KEY}`)
    expect(String(init?.body)).toContain('data:image/jpeg;base64,')

    expect(store.status).toBe('complete')
    expect(store.record?.source).toBe('live')
    expect(store.record?.model).toBe('gpt-6-luna')
    expect(store.record?.resolvedVersion).toBe('gpt-6-luna-20260922')
    expect(store.record?.rawResponses[0]).toMatchObject({
      capturedFrom: 'provider',
      provider: 'luna',
    })
    expect(store.record?.containerId?.value).toBe('APHU6586847')

    const entries = ledger.entries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      provider: 'luna',
      endpoint: 'decisions',
      status: 'complete',
      resolvedModel: 'gpt-6-luna-20260922',
      costState: 'estimated',
    })
    expect(entries[0]!.costUsd).toBeCloseTo(0.001578, 6)
  })

  it('keeps a partial reading and marks the unread positions', async () => {
    fetchMock.mockResolvedValue(reply('APHU65868??'))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)
    await store.start()
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('APHU65868??')
  })

  it('shows the actionable provider message on failure and still records the attempt', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: 'Rate limit reached for requests' } }, 429),
    )
    const store = useInspectionStore()
    store.setProvider('luna')
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/rate limit/i)
    expect(store.errorMessage).not.toContain(KEY)
    expect(ledger.entries()[0]).toMatchObject({ status: 'failed', costState: 'unavailable' })
  })

  it('clears the key on request and closes the gate again', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.clearApiKey()
    expect(store.apiKey).toBe('')
    expect(store.canStart).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not persist the key to browser storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    expect(setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(store.$state)).toContain(KEY)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a live run when the photo has no file to send', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.setPhoto({ name: 'rear.jpg', url: 'blob:x', orientation: 'landscape' })
    await store.start()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/choose the photo again/i)
  })
})
