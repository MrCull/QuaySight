import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')
import lunaSmoke from '../../fixtures/live/luna-smoke.json'
import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'

// Test-only placeholders. No provider ever receives them: fetch is stubbed at the network edge.
const LUNA_KEY = 'test-only-luna-key-0000'
const OPENROUTER_KEY = 'test-only-openrouter-key-0000'

const okResponse = () =>
  new Response(JSON.stringify(lunaSmoke.response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:test-photo',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

describe('New inspection', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('after a completed live run, leaves no photo, result, run status or error', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    choosePhoto(store)
    await store.start()
    expect(store.status).toBe('complete')
    expect(store.record).not.toBeNull()

    store.newInspection()

    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
    expect(store.status).toBe('idle')
    expect(store.errorMessage).toBeNull()
  })

  it('releases the dropped photo so the browser can free it', () => {
    const revoke = vi.fn<(url: string) => void>()
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { revokeObjectURL: revoke }))
    const store = useInspectionStore()
    choosePhoto(store)

    store.newInspection()

    expect(revoke).toHaveBeenCalledWith('blob:test-photo')
  })

  it('clears the selected damage marker', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    choosePhoto(store)
    await store.start()
    store.selectFinding(1)
    expect(store.selectedFinding).toBe(1)

    store.newInspection()

    expect(store.selectedFinding).toBeNull()
  })

  it('keeps the provider, model, every key and the session cost total', async () => {
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setProvider('openrouter')
    store.setApiKey(OPENROUTER_KEY)
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    choosePhoto(store)
    await store.start()
    const session = ledger.session
    expect(session.requests).toBeGreaterThan(0)
    const model = store.model

    store.newInspection()

    expect(store.provider).toBe('luna')
    expect(store.model).toBe(model)
    expect(store.apiKey).toBe(LUNA_KEY)
    store.setProvider('openrouter')
    expect(store.apiKey).toBe(OPENROUTER_KEY)
    expect(ledger.session).toEqual(session)
    expect(ledger.entries()).toHaveLength(session.requests)
  })

  it('cancels a running inspection so no result from it lands afterwards', async () => {
    let answer!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    choosePhoto(store)
    const run = store.start()
    expect(store.status).toBe('running')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    store.newInspection()
    expect(store.status).toBe('idle')

    answer(okResponse())
    await run

    expect(store.status).toBe('idle')
    expect(store.record).toBeNull()
    expect(store.photo).toBeNull()
  })

  it('lets the next container run straight after a cancelled one', async () => {
    let answer!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    choosePhoto(store)
    const stale = store.start()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    store.newInspection()
    choosePhoto(store)
    await store.start()
    answer(okResponse())
    await stale

    expect(store.status).toBe('complete')
    expect(store.record?.source).toBe('live')
  })
})

describe('New inspection: manifest retry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** A recorded run whose container ID was not identified, so the manifest offer is open. */
  async function unidentifiedResult() {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)
    store.replaySample = true
    store.scenario = 'unidentified'
    const run = store.start()
    await vi.advanceTimersByTimeAsync(1600)
    await run
    expect(store.record?.containerId).toBeNull()
    return store
  }

  it('clears a failed manifest check, its entries and a dismissed offer', async () => {
    const store = await unidentifiedResult()
    store.retryFails = true
    const check = store.retryManifest(['APHU6586847'])
    await vi.advanceTimersByTimeAsync(1600)
    await check
    store.dismissRetry()
    expect(store.retry).toMatchObject({ status: 'error', dismissed: true })

    store.newInspection()

    expect(store.retry).toEqual({ status: 'idle', message: null, ids: [], dismissed: false })
  })

  it('drops a manifest check still in flight', async () => {
    const store = await unidentifiedResult()
    const check = store.retryManifest(['APHU6586847'])
    expect(store.retry.status).toBe('checking')

    store.newInspection()
    await vi.advanceTimersByTimeAsync(1600)
    await check

    expect(store.record).toBeNull()
    expect(store.retry.status).toBe('idle')
  })
})
