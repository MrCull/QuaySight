import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { InspectionRecord } from '../../domain/inspection'

const runMock = vi.fn<(provider: string, options?: unknown) => Promise<InspectionRecord>>()
vi.mock('../../domain/recordedRun', () => ({
  runRecordedInspection: (...args: [string, unknown?]) => runMock(...args),
}))

import { useInspectionStore } from '../inspection'

function recordFor(provider: 'luna' | 'jev'): InspectionRecord {
  return {
    schemaVersion: 1,
    id: `r-${provider}`,
    provider,
    model: provider === 'luna' ? 'gpt-6-luna' : 'jev-1.14.0',
    resolvedVersion: provider === 'luna' ? 'gpt-6-luna' : 'jev-1.14.0',
    rawResponses: [],
    source: 'recorded',
    status: 'complete',
    photo: null,
    containerId: {
      value: 'APHU6586847',
      observedCheckDigit: 7,
      calculatedCheckDigit: 7,
      checkDigitValid: true,
      certainty: 'Confident',
      provenance: 'printed',
    },
    damage: null,
    sizeCode: null,
    weights: null,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('inspection store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    runMock.mockReset()
  })

  it('starts on Luna with its recommended model, idle, no photo', () => {
    const store = useInspectionStore()
    expect(store.provider).toBe('luna')
    expect(store.model).toBe('gpt-6-luna')
    expect(store.status).toBe('idle')
    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
  })

  it('switching provider selects that provider recommended model', () => {
    const store = useInspectionStore()
    store.setProvider('jev')
    expect(store.model).toBe('jev-latest')
  })

  it('replacing the photo replaces the single photo', () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setPhoto({ name: 'b.jpg', url: 'blob:b', orientation: 'portrait' })
    expect(store.photo?.name).toBe('b.jpg')
    expect(store.photo?.orientation).toBe('portrait')
  })

  it('starting without a photo does nothing', async () => {
    const store = useInspectionStore()
    await store.start()
    expect(runMock).not.toHaveBeenCalled()
    expect(store.status).toBe('idle')
  })

  it('runs the recorded fixture for the chosen provider and stores the record', async () => {
    runMock.mockResolvedValueOnce(recordFor('jev'))
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setProvider('jev')
    await store.start()
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0]?.[0]).toBe('jev')
    expect(store.status).toBe('complete')
    expect(store.record?.provider).toBe('jev')
    expect(store.record?.photo?.name).toBe('a.jpg')
  })

  it('repeated start clicks while running do not start a second run', async () => {
    const pending = deferred<InspectionRecord>()
    runMock.mockReturnValueOnce(pending.promise)
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const first = store.start()
    const second = store.start()
    const third = store.start()
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('running')
    pending.resolve(recordFor('luna'))
    await Promise.all([first, second, third])
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('complete')
  })

  it('replacing the photo mid-run cancels the run so its result is ignored', async () => {
    const pending = deferred<InspectionRecord>()
    runMock.mockReturnValueOnce(pending.promise)
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const run = store.start()
    store.setPhoto({ name: 'b.jpg', url: 'blob:b', orientation: 'portrait' })
    pending.resolve(recordFor('luna'))
    await run
    expect(store.status).toBe('idle')
    expect(store.record).toBeNull()
  })

  it('after a cancelled run, starting again on the new photo works', async () => {
    runMock.mockResolvedValueOnce(recordFor('luna')).mockResolvedValueOnce(recordFor('luna'))
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    await store.start()
    store.setPhoto({ name: 'b.jpg', url: 'blob:b', orientation: 'portrait' })
    expect(store.status).toBe('idle')
    await store.start()
    expect(runMock).toHaveBeenCalledTimes(2)
    expect(store.record?.photo?.name).toBe('b.jpg')
  })
})
