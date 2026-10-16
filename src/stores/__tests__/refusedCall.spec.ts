// Ticket #18: a refused OpenAI call reads as "refused", not as a connection problem. OpenAI's Decisions API
// leaves CORS headers off its error responses (checked live 16 Oct 2026), so in the browser a 401 arrives
// as a thrown fetch. Fetch is stubbed at the network edge; navigator.onLine is the only other input.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')
import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import {
  buildInspectionExport,
  buildRawResponsesExport,
  buildSummaryText,
} from '../../domain/exports'

const KEY = 'test-only-key-value-0000'
const REFUSED =
  'OpenAI refused the request. Usually the key is wrong, out of credit, or has no access to gpt-6-luna. Check the key, then try again.'

// Hand-written: APHU6586847 is the worked example. Positions 7 and 9 come back unread on the first pass.
const ID = 'APHU6586847'
function decisionsBody(unread: number[] = []) {
  return {
    model: 'gpt-6-luna-20260922',
    answers: ID.split('').flatMap((ch, i) =>
      unread.includes(i + 1)
        ? []
        : [
            {
              type: 'choice',
              name: `id_char_${String(i + 1).padStart(2, '0')}`,
              choice: ch,
              probabilities: [{ value: ch, probability: 0.97 }],
              confidence: 0.97,
            },
          ],
    ),
    usage: { input_tokens: 15780 },
  }
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** What the browser does with a CORS-less error response: the fetch promise rejects. */
function corsBlocked(): Promise<Response> {
  return Promise.reject(new TypeError('Failed to fetch'))
}

function setOnline(online: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online)
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['not-really-a-jpeg'], { type: 'image/jpeg' }),
  })
}

/** Everything the presenter can see or save: the error, the ledger, the record and each export. */
function everythingShown(store: ReturnType<typeof useInspectionStore>): string {
  const record = store.record
  return [
    store.errorMessage ?? '',
    JSON.stringify(useLedgerStore().entries()),
    JSON.stringify(record),
    record ? JSON.stringify(buildInspectionExport(record)) : '',
    record ? JSON.stringify(buildRawResponsesExport(record)) : '',
    record ? buildSummaryText(record) : '',
  ].join('\n')
}

function expectNoKeyAnywhere(store: ReturnType<typeof useInspectionStore>) {
  expect(everythingShown(store)).not.toContain(KEY)
}

describe('a live Luna run whose call fails before a response is readable', () => {
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

  it('says OpenAI refused the request when the browser is online, and keeps the photo', async () => {
    setOnline(true)
    fetchMock.mockImplementation(corsBlocked)
    const store = useInspectionStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('failed')
    expect(store.errorMessage).toBe(REFUSED)
    expect(store.photo?.name).toBe('rear.jpg')
    expect(useLedgerStore().entries()[0]).toMatchObject({ status: 'failed' })
    expectNoKeyAnywhere(store)
  })

  it('says it could not reach OpenAI when the browser is offline', async () => {
    setOnline(false)
    fetchMock.mockImplementation(corsBlocked)
    const store = useInspectionStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toBe(
      'Could not reach OpenAI. Check your connection, then try again.',
    )
    expectNoKeyAnywhere(store)
  })

  it('keeps the first reading when the follow-up call for unread positions is refused', async () => {
    setOnline(true)
    fetchMock
      .mockImplementationOnce(async () => okResponse(decisionsBody([7, 9])))
      .mockImplementationOnce(corsBlocked)
    const store = useInspectionStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('APHU65?6?47')
    expectNoKeyAnywhere(store)
  })

  it('keeps the specific message for a status that comes back readable', async () => {
    setOnline(true)
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const store = useInspectionStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toBe(
      'OpenAI rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
    )
    expectNoKeyAnywhere(store)
  })
})
