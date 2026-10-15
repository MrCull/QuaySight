import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'

function startUnidentified() {
  const store = useInspectionStore()
  store.setProvider('luna')
  store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
  store.scenario = 'unidentified'
  return store
}

describe('inspection store: manifest retry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  async function retry(store: ReturnType<typeof useInspectionStore>, ids: string[]) {
    const pending = store.retryManifest(ids)
    await vi.advanceTimersByTimeAsync(1600)
    await pending
  }

  async function runFirst(store: ReturnType<typeof useInspectionStore>) {
    const pending = store.start()
    await vi.advanceTimersByTimeAsync(1600)
    await pending
  }

  it('replaces the ID in place and keeps the other findings', async () => {
    const store = startUnidentified()
    await runFirst(store)
    expect(store.record?.containerId).toBeNull()
    const id = store.record?.id

    await retry(store, ['APHU6586847'])
    expect(store.record?.containerId?.provenance).toBe('manifest')
    expect(store.record?.containerId?.manifestChecked).toBe(true)
    expect(store.record?.id).toBe(id)
    expect(store.record?.provider).toBe('luna')
    expect(store.retry.status).toBe('idle')
    vi.useRealTimers()
  })

  it('leaves the first result unchanged and reports the error on failure', async () => {
    const store = startUnidentified()
    await runFirst(store)
    store.retryFails = true

    await retry(store, ['APHU6586847'])
    expect(store.record?.containerId).toBeNull()
    expect(store.retry.status).toBe('error')
    expect(store.retry.message).toContain('Rate limit reached')
    vi.useRealTimers()
  })

  it('keeps the entries so Try again can send them again', async () => {
    const store = startUnidentified()
    await runFirst(store)
    store.retryFails = true
    await retry(store, ['APHU6586847'])
    store.retryFails = false
    await retry(store, store.retry.ids)
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    vi.useRealTimers()
  })

  it('does not run for an empty list or when the ID is already identified', async () => {
    const store = startUnidentified()
    await runFirst(store)
    await retry(store, [])
    expect(store.retry.status).toBe('idle')
    expect(store.record?.containerId).toBeNull()
    vi.useRealTimers()
  })

  it('does not enter the live ledger or touch the cap for a recorded retry', async () => {
    const store = startUnidentified()
    const ledger = useLedgerStore()
    await runFirst(store)
    const before = ledger.entries().length
    await retry(store, ['APHU6586847'])
    expect(ledger.entries().length).toBe(before)
    expect(ledger.ledger.capStatus(store.record?.id ?? '')).toEqual({ allowed: true })
    vi.useRealTimers()
  })

  it('dismissing keeps the first result and marks the offer closed', async () => {
    const store = startUnidentified()
    await runFirst(store)
    store.dismissRetry()
    expect(store.retry.dismissed).toBe(true)
    expect(store.record?.containerId).toBeNull()
    vi.useRealTimers()
  })
})
