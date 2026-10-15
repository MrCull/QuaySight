import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const callLunaMock = vi.fn<(...args: unknown[]) => unknown>()
vi.mock('../../services/luna', () => ({
  callLuna: (...args: unknown[]) => callLunaMock(...args),
}))

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { LunaError } from '../../domain/luna'
import { buildContainerIdReading } from '../../domain/containerId'

const KEY = 'test-only-key-value-0000'

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

function liveResult(overrides: Partial<{ resolvedModel: string }> = {}) {
  return {
    containerId: buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Confident' }),
    resolvedModel: overrides.resolvedModel ?? 'gpt-6-luna-20260922',
    usage: { inputTokens: 15780, outputTokens: null },
    latencyMs: 812,
  }
}

describe('live Luna inspection in the store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    callLunaMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays on the recorded sample until a Luna key is entered', () => {
    const store = useInspectionStore()
    expect(store.mode).toBe('recorded')
    store.setApiKey(KEY)
    expect(store.mode).toBe('live')
  })

  it('never goes live for Jev, and never sends the Luna key to it', async () => {
    const store = useInspectionStore()
    store.setApiKey(KEY)
    store.setProvider('jev')
    expect(store.mode).toBe('recorded')
    choosePhoto(store)
    await store.start()
    expect(callLunaMock).not.toHaveBeenCalled()
  })

  it('runs one chargeable call through the ledger and records the live result', async () => {
    callLunaMock.mockResolvedValue(liveResult())
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(callLunaMock).toHaveBeenCalledTimes(1)
    const options = callLunaMock.mock.calls[0]?.[0] as { apiKey: string; photo: Blob }
    expect(options.apiKey).toBe(KEY)
    expect(options.photo).toBeInstanceOf(Blob)

    expect(store.status).toBe('complete')
    expect(store.record?.source).toBe('live')
    expect(store.record?.model).toBe('gpt-6-luna-20260922')
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
    callLunaMock.mockResolvedValue({
      ...liveResult(),
      containerId: {
        value: 'APHU65868??',
        observedCheckDigit: null,
        calculatedCheckDigit: 0,
        checkDigitValid: false,
        certainty: "Can't tell",
        provenance: 'printed',
      },
    })
    const store = useInspectionStore()
    store.setApiKey(KEY)
    choosePhoto(store)
    await store.start()
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('APHU65868??')
  })

  it('shows the actionable provider message on failure and still records the attempt', async () => {
    callLunaMock.mockRejectedValue(
      new LunaError('http', 'OpenAI rate limit reached. Wait a minute, then try again.', 429),
    )
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/rate limit/i)
    expect(store.errorMessage).not.toContain(KEY)
    expect(ledger.entries()[0]).toMatchObject({ status: 'failed', costState: 'unavailable' })
  })

  it('clears the key on request and returns to the recorded sample', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setApiKey(KEY)
    store.clearApiKey()
    expect(store.apiKey).toBe('')
    expect(store.mode).toBe('recorded')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not persist the key to browser storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setApiKey(KEY)
    expect(setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(store.$state)).toContain(KEY)
    expect(callLunaMock).not.toHaveBeenCalled()
  })

  it('refuses a live run when the photo has no file to send', async () => {
    const store = useInspectionStore()
    store.setApiKey(KEY)
    store.setPhoto({ name: 'rear.jpg', url: 'blob:x', orientation: 'landscape' })
    await store.start()
    expect(callLunaMock).not.toHaveBeenCalled()
    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/choose the photo again/i)
  })
})
