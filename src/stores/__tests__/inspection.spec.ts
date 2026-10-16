import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { InspectionRecord } from '../../domain/inspection'

// Demo runs replay a sample's recording; the mock holds or releases each one.
const runMock = vi.fn<(sample: string, options?: unknown) => Promise<InspectionRecord>>()
vi.mock('../../domain/demoSamples', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../domain/demoSamples')>()),
  runDemoSample: (...args: [string, unknown?]) => runMock(...args),
}))

import { useInspectionStore } from '../inspection'

function recordFor(provider: 'luna' | 'openrouter'): InspectionRecord {
  return {
    schemaVersion: 1,
    id: `r-${provider}`,
    provider,
    model: provider === 'luna' ? 'gpt-6-luna' : 'typesafe/jev-1.14',
    resolvedVersion: provider === 'luna' ? 'gpt-6-luna' : 'typesafe/jev-1.14',
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

  it('starts on OpenRouter with its recommended model, Jev latest, idle, no photo', () => {
    const store = useInspectionStore()
    expect(store.provider).toBe('openrouter')
    expect(store.model).toBe('~typesafe/jev-latest')
    expect(store.status).toBe('idle')
    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
  })

  it('switching provider selects that provider recommended model', () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    expect(store.model).toBe('gpt-6-luna')
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

  it('in demo mode, runs the chosen sample\'s recording and stores the record', async () => {
    runMock.mockResolvedValueOnce(recordFor('luna'))
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('rear-aphu')
    await store.start()
    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0]?.[0]).toBe('rear-aphu')
    expect(store.status).toBe('complete')
    expect(store.record?.provider).toBe('luna')
  })

  it('repeated start clicks while running do not start a second run', async () => {
    const pending = deferred<InspectionRecord>()
    runMock.mockReturnValueOnce(pending.promise)
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('rear-aphu')
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

  it('choosing another sample mid-run cancels the run so its result is ignored', async () => {
    const pending = deferred<InspectionRecord>()
    runMock.mockReturnValueOnce(pending.promise)
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('rear-aphu')
    const run = store.start()
    store.chooseSample('side-dented')
    pending.resolve(recordFor('luna'))
    await run
    expect(store.status).toBe('idle')
    expect(store.record).toBeNull()
  })

  it('after a cancelled run, starting again on the new sample works', async () => {
    runMock.mockResolvedValueOnce(recordFor('luna')).mockResolvedValueOnce(recordFor('luna'))
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('rear-aphu')
    await store.start()
    store.chooseSample('rear-chsu')
    expect(store.status).toBe('idle')
    await store.start()
    expect(runMock).toHaveBeenCalledTimes(2)
    expect(runMock.mock.calls[1]?.[0]).toBe('rear-chsu')
  })
})

describe('inspection store: key gate', () => {
  const photo = { name: 'a.jpg', url: 'blob:a', orientation: 'landscape' as const }

  beforeEach(() => {
    setActivePinia(createPinia())
    runMock.mockReset()
  })

  it('does not start without a key for the selected provider', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    expect(store.canStart).toBe(false)
    await store.start()
    expect(runMock).not.toHaveBeenCalled()
    expect(store.status).toBe('idle')
  })

  it('does not accept a key for another provider as the gate', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    store.setProvider('luna')
    store.setApiKey('test-key')
    store.setProvider('openrouter')
    expect(store.canStart).toBe(false)
    await store.start()
    expect(store.status).toBe('idle')
  })

  it('a key entered outside demo mode runs live, never recorded', () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    store.setApiKey('test-key')
    expect(store.canStart).toBe(true)
    expect(store.mode).toBe('live')
  })

  it('clearing the key closes the gate again', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    store.setApiKey('test-key')
    store.clearApiKey()
    await store.start()
    expect(runMock).not.toHaveBeenCalled()
  })
})
