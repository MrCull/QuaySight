import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

const callLunaMock = vi.fn<(...args: unknown[]) => unknown>()
vi.mock('../../services/luna', () => ({
  callLuna: (...args: unknown[]) => callLunaMock(...args),
}))

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { LunaError } from '../../domain/luna'
import { buildContainerIdReading } from '../../domain/containerId'
import type { ChoiceReading } from '../../domain/luna'

const KEY = 'test-only-key-value-0000'

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

const readAll = (value: string): ChoiceReading[] =>
  value.split('').map((c) => ({ value: c, certainty: 'Confident', runnerUp: null }))
const unreadAt = (value: string): ChoiceReading[] =>
  value
    .split('')
    .map((c) =>
      c === '?'
        ? { value: null, certainty: "Can't tell", runnerUp: null }
        : { value: c, certainty: 'Confident', runnerUp: null },
    )

function liveResult(overrides: Partial<{ resolvedModel: string }> = {}) {
  return {
    containerId: buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Confident' }),
    readings: readAll('APHU6586847'),
    raw: { answers: [] },
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

  it('will not start until a Luna key is entered, then runs live', () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    choosePhoto(store)
    expect(store.canStart).toBe(false)
    store.setApiKey(KEY)
    expect(store.canStart).toBe(true)
    expect(store.mode).toBe('live')
  })

  it('does not send the OpenAI key to OpenRouter, and will not start without an OpenRouter key', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.setProvider('openrouter')
    expect(store.canStart).toBe(false)
    choosePhoto(store)
    await store.start()
    expect(callLunaMock).not.toHaveBeenCalled()
  })

  it('runs one chargeable call through the ledger and records the live result', async () => {
    callLunaMock.mockResolvedValue(liveResult())
    const store = useInspectionStore()
    store.setProvider('luna')
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
    expect(store.record?.model).toBe('gpt-6-luna')
    expect(store.record?.resolvedVersion).toBe('gpt-6-luna-20260922')
    expect(store.record?.rawResponses[0]).toMatchObject({
      capturedFrom: 'provider',
      provider: 'luna',
    })
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
      readings: unreadAt('APHU65868??'),
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
    store.setProvider('luna')
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
    store.setProvider('luna')
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/rate limit/i)
    expect(store.errorMessage).not.toContain(KEY)
    expect(ledger.entries()[0]).toMatchObject({ status: 'failed', costState: 'unavailable' })
  })

  it('clears the key on request and closes the gate again', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.clearApiKey()
    expect(store.apiKey).toBe('')
    expect(store.canStart).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not persist the key to browser storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    expect(setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(store.$state)).toContain(KEY)
    expect(callLunaMock).not.toHaveBeenCalled()
  })

  it('refuses a live run when the photo has no file to send', async () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.setPhoto({ name: 'rear.jpg', url: 'blob:x', orientation: 'landscape' })
    await store.start()
    expect(callLunaMock).not.toHaveBeenCalled()
    expect(store.status).toBe('failed')
    expect(store.errorMessage).toMatch(/choose the photo again/i)
  })
})
