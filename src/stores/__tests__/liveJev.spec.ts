import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const callJevMock = vi.fn<(...args: unknown[]) => unknown>()
const callLunaMock = vi.fn<(...args: unknown[]) => unknown>()
vi.mock('../../services/jev', () => ({
  callJev: (...args: unknown[]) => callJevMock(...args),
}))
vi.mock('../../services/luna', () => ({
  callLuna: (...args: unknown[]) => callLunaMock(...args),
}))

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { JevError } from '../../domain/jev'
import { buildContainerIdReading } from '../../domain/containerId'

const JEV_KEY = 'test-only-jev-key-0000'
const LUNA_KEY = 'test-only-luna-key-0000'

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

function jevResult(overrides: Partial<{ resolvedModel: string }> = {}) {
  return {
    containerId: buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Likely' }),
    resolvedModel: overrides.resolvedModel ?? 'jev-1.13.0',
    usage: { inputTokens: 1234, outputTokens: 0 },
    reportedCostUsd: null,
    box: null,
    latencyMs: 640,
    raw: { model: overrides.resolvedModel ?? 'jev-1.13.0', answers: {} },
  }
}

describe('live Jev inspection in the store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    callJevMock.mockReset()
    callLunaMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('goes live for Jev only with a Jev key, and keeps keys per provider', () => {
    const store = useInspectionStore()
    store.setProvider('jev')
    expect(store.canStart).toBe(false)
    store.setApiKey(JEV_KEY)
    expect(store.mode).toBe('live')
    store.setProvider('luna')
    expect(store.apiKey).toBe('')
    expect(store.canStart).toBe(false)
  })

  it('never sends the Luna key to Jev, and the Jev key to Luna', async () => {
    const store = useInspectionStore()
    store.setApiKey(LUNA_KEY)
    store.setProvider('jev')
    choosePhoto(store)
    await store.start()
    expect(callJevMock).not.toHaveBeenCalled()
    expect(callLunaMock).not.toHaveBeenCalled()
    expect(store.canStart).toBe(false)
  })

  it('calls Jev with the requested model and records the resolved version and provider raw response', async () => {
    callJevMock.mockResolvedValue(jevResult())
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setProvider('jev')
    store.setApiKey(JEV_KEY)
    choosePhoto(store)

    await store.start()

    expect(callJevMock).toHaveBeenCalledTimes(1)
    const options = callJevMock.mock.calls[0]?.[0] as { apiKey: string; model: string; photo: Blob }
    expect(options.apiKey).toBe(JEV_KEY)
    expect(options.model).toBe('jev-latest')
    expect(options.photo).toBeInstanceOf(Blob)
    expect(callLunaMock).not.toHaveBeenCalled()

    expect(store.status).toBe('complete')
    expect(store.record).toMatchObject({
      source: 'live',
      provider: 'jev',
      model: 'jev-latest',
      resolvedVersion: 'jev-1.13.0',
    })
    expect(store.record?.rawResponses[0]).toMatchObject({
      capturedFrom: 'provider',
      provider: 'jev',
    })
    expect(store.record?.containerId?.value).toBe('APHU6586847')

    expect(ledger.entries()[0]).toMatchObject({
      provider: 'jev',
      endpoint: 'system-one',
      model: 'jev-latest',
      resolvedModel: 'jev-1.13.0',
      status: 'complete',
    })
  })

  it('shows a Jev failure message and never the key', async () => {
    callJevMock.mockRejectedValue(
      new JevError('http', 'TypeSafe rejected the key. Jev needs a TypeSafe console key.', 401),
    )
    const store = useInspectionStore()
    store.setProvider('jev')
    store.setApiKey(JEV_KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/console key/)
    expect(store.errorMessage).not.toContain(JEV_KEY)
  })
})
