import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../inspection'
import { useSetupStore } from '../setup'
import { useLedgerStore } from '../ledger'
import { DEMO_SAMPLES } from '../../domain/demoSamples'

/** Starts the chosen sample and lets its recorded result land past the staged progress. */
async function runSample(store: ReturnType<typeof useInspectionStore>, id: string) {
  store.chooseSample(id as (typeof DEMO_SAMPLES)[number]['id'])
  const run = store.start()
  await vi.advanceTimersByTimeAsync(2000)
  await run
}

/**
 * Demo mode (spec #16, ticket #24) at the store seam, with fetch stubbed at the network edge:
 * a visitor with no key sees the three bundled samples from recorded results, and nothing reaches a provider.
 */
describe('demo mode', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('is entered from the setup card with no key, straight onto the inspection screen', () => {
    const setup = useSetupStore()
    const inspection = useInspectionStore()
    expect(inspection.apiKey).toBe('')

    setup.enterDemo()

    expect(setup.view).toBe('inspection')
    expect(inspection.demo).toBe(true)
    expect(inspection.photo).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offers the three bundled containers: rear doors with markings, a damaged side, clean rear doors', () => {
    expect(DEMO_SAMPLES.map((sample) => sample.photo.name)).toEqual([
      'rear-door-aphu-45g1.jpg',
      'side-dented-grey.jpg',
      'rear-door-chsu-22g1.jpg',
    ])
    expect(DEMO_SAMPLES.map((sample) => sample.title)).toEqual([
      'Rear doors with markings',
      'Damaged grey side',
      'Clean grey rear doors',
    ])
  })

  it.each(DEMO_SAMPLES.map((sample) => [sample.id, sample.photo.name] as const))(
    'replays %s against its own photo, with no key, no request and nothing on the ledger',
    async (id, photoName) => {
      vi.useFakeTimers()
      useSetupStore().enterDemo()
      const store = useInspectionStore()

      store.chooseSample(id)
      expect(store.photo?.name).toBe(photoName)
      expect(store.canStart).toBe(true)
      await runSample(store, id)

      expect(store.status).toBe('complete')
      expect(store.record?.source).toBe('recorded')
      expect(store.record?.photo?.name).toBe(photoName)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useLedgerStore().entries()).toEqual([])
      expect(useLedgerStore().session.requests).toBe(0)
    },
  )

  it('takes no photo upload: a chosen file never replaces the sample', () => {
    useSetupStore().enterDemo()
    const store = useInspectionStore()
    store.chooseSample('rear-aphu')

    store.setPhoto({ name: 'mine.jpg', url: 'blob:mine', orientation: 'portrait' })

    expect(store.photo?.name).toBe('rear-door-aphu-45g1.jpg')
    expect(store.sample).toBe('rear-aphu')
  })

  it('New inspection returns to the sample picker and stays in demo mode', async () => {
    vi.useFakeTimers()
    useSetupStore().enterDemo()
    const store = useInspectionStore()
    await runSample(store, 'side-dented')
    expect(store.record).not.toBeNull()

    store.newInspection()

    expect(store.demo).toBe(true)
    expect(store.sample).toBeNull()
    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
    expect(store.status).toBe('idle')
  })

  it('Connect a provider leaves demo mode for the setup card, on a blank screen', async () => {
    vi.useFakeTimers()
    const setup = useSetupStore()
    setup.enterDemo()
    const store = useInspectionStore()
    await runSample(store, 'rear-chsu')

    setup.connectProvider()

    expect(setup.view).toBe('setup')
    expect(store.demo).toBe(false)
    expect(store.mode).toBe('live')
    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
    // Back on the setup card, Continue still waits for a key.
    expect(setup.canContinue).toBe(false)
  })

  it('is never persisted: a new session starts on the setup card', () => {
    useSetupStore().enterDemo()
    useInspectionStore().chooseSample('rear-aphu')
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(stored).not.toMatch(/demo|rear-aphu|sample/i)

    setActivePinia(createPinia())
    const setup = useSetupStore()
    setup.restore()
    expect(setup.view).toBe('setup')
    expect(useInspectionStore().demo).toBe(false)
  })

  describe('manifest check on the damaged side (no ID in view)', () => {
    async function sideResult() {
      vi.useFakeTimers()
      useSetupStore().enterDemo()
      const store = useInspectionStore()
      await runSample(store, 'side-dented')
      expect(store.record?.containerId).toBeNull()
      return store
    }

    async function check(store: ReturnType<typeof useInspectionStore>, ids: string[]) {
      const run = store.retryManifest(ids)
      expect(store.retry.status).toBe('checking')
      await vi.advanceTimersByTimeAsync(2000)
      await run
    }

    it('replays the recorded check with no key: no entry matches the photo, the first result is kept', async () => {
      const store = await sideResult()
      const first = store.record

      await check(store, ['APHU6586847', 'CHSU2051831'])

      expect(store.record).toEqual(first)
      expect(store.retry).toMatchObject({
        status: 'idle',
        noMatch: true,
        ids: ['APHU6586847', 'CHSU2051831'],
      })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(useLedgerStore().entries()).toEqual([])
    })

    it('replays the recorded provider failure when the sample option asks for it', async () => {
      const store = await sideResult()
      store.retryFails = true

      await check(store, ['APHU6586847'])

      expect(store.retry.status).toBe('error')
      expect(store.retry.message).toContain('Rate limit reached')
      expect(store.record?.containerId).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
