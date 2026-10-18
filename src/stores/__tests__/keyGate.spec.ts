import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')
import lunaSmoke from '../../fixtures/live/luna-smoke.json'
import { useInspectionStore } from '../inspection'
import { useSetupStore } from '../setup'

// Test-only placeholder. No provider ever receives it: fetch is stubbed at the network edge.
const LUNA_KEY = 'test-only-luna-key-0000'

const okResponse = () =>
  new Response(JSON.stringify(lunaSmoke.response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/** What the photo picker does: puts the photos on screen, then gives the go-ahead. */
function choosePhotos(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:test-photo',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
  return store.startWhenReady()
}

describe('the key gate: photos chosen with no key wait for one', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    useSetupStore().view = 'inspection'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the settings drawer and sends nothing', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')

    await choosePhotos(store)

    expect(useSetupStore().drawerOpen).toBe(true)
    expect(store.status).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('starts the waiting inspection once the key is saved', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    await choosePhotos(store)

    store.setApiKey(LUNA_KEY)

    expect(store.status).toBe('running')
    await store.inFlight
    expect(store.status).toBe('complete')
    expect(store.record?.source).toBe('live')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('leaves the photos waiting, with New inspection showing, when the drawer closes with no key', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    await choosePhotos(store)

    useSetupStore().closeDrawer()

    expect(store.photo).not.toBeNull()
    expect(store.status).toBe('idle')
    expect(store.showNewInspection).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('starts nothing when a key is saved with no photos waiting', () => {
    const store = useInspectionStore()
    store.setProvider('luna')

    store.setApiKey(LUNA_KEY)

    expect(store.status).toBe('idle')
    expect(useSetupStore().drawerOpen).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('starts straight away when the key is already set, with no drawer', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(LUNA_KEY)

    const run = choosePhotos(store)

    expect(store.status).toBe('running')
    expect(useSetupStore().drawerOpen).toBe(false)
    await run
  })
})
