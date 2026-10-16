import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { recordedInspection } from '../../__tests__/recordedInspection'

// Outside demo mode a manifest check is only ever a live call (liveManifestRetry.spec.ts). A recorded
// result never gets a recorded check against the photo on screen (spec #16, Demo mode).
// (Demo mode's own recorded check is in demoMode.spec.ts.)
describe('inspection store: manifest retry outside demo mode', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function recordedUnidentified() {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setApiKey('test-only-key-0000')
    store.record = await recordedInspection('luna', { delayMs: 0, scenario: 'unidentified' })
    store.status = 'complete'
    return store
  }

  it('does not offer or replay a recorded check against a photo it did not come from', async () => {
    const store = await recordedUnidentified()
    const ledger = useLedgerStore()
    expect(store.manifestRetryOffered).toBe(false)

    await store.retryManifest(['APHU6586847'])

    expect(store.record?.containerId).toBeNull()
    expect(store.retry.status).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ledger.entries()).toHaveLength(0)
  })

  it('dismissing keeps the first result and marks the offer closed', async () => {
    const store = await recordedUnidentified()
    store.dismissRetry()
    expect(store.retry.dismissed).toBe(true)
    expect(store.record?.containerId).toBeNull()
  })
})
