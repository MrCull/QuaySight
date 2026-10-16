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
import { LunaError, type ChoiceReading } from '../../domain/luna'
import { buildContainerIdReading } from '../../domain/containerId'
import { jsonResponse, openAiSurveyReply } from '../../__tests__/surveyReplies'

const KEY = 'test-only-key-value-0000'

// Hand-written: APHU658684 with check digit 7 is the worked example. Positions 7 and 9 are unread on the
// first pass, which is the survey's reading (fetch stubbed); the re-check goes through callLuna (mocked).
const FIRST_PRINTED = 'APHU65?6?47'
const FULL_ID = 'APHU6586847'

function readingsOf(value: string): ChoiceReading[] {
  return value
    .split('')
    .map((c) =>
      c === '?'
        ? { value: null, certainty: "Can't tell", runnerUp: null }
        : { value: c, certainty: 'Confident', runnerUp: null },
    )
}

function recheckResult() {
  return {
    containerId: buildContainerIdReading({ printed: FULL_ID, certainty: 'Confident' }),
    readings: readingsOf(FULL_ID),
    raw: { answers: ['recheck'] },
    resolvedModel: 'gpt-6-luna-20260922',
    usage: { inputTokens: 2100, outputTokens: null },
    latencyMs: 400,
  }
}

/** A re-check reply that reads only the requested positions. Positions 7 and 9 here are the unread ones. */
function recheckReply(overrides: Partial<Record<number, string>> = {}) {
  const readings: ChoiceReading[] = Array.from({ length: 11 }, (_, i) => {
    const value = overrides[i + 1]
    return value
      ? { value, certainty: 'Likely', runnerUp: null }
      : { value: null, certainty: "Can't tell", runnerUp: null }
  })
  return { ...recheckResult(), readings }
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

describe('automatic re-check of unresolved container ID positions (live Luna)', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  /** The survey's first reading of the whole photo. */
  function firstReading(id = FIRST_PRINTED) {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(openAiSurveyReply(id, { model: 'gpt-6-luna-20260922', inputTokens: 15780 })),
    )
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    callLunaMock.mockReset()
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('re-asks only the unread positions once, on the same model, and merges the answer', async () => {
    firstReading()
    callLunaMock.mockResolvedValueOnce(recheckReply({ 7: '8', 9: '8' }))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(callLunaMock).toHaveBeenCalledTimes(1)
    const second = callLunaMock.mock.calls[0]?.[0] as { positions: number[]; apiKey: string }
    expect(second.positions).toEqual([7, 9])
    expect(second.apiKey).toBe(KEY)

    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe(FULL_ID)
    expect(store.record?.containerId?.checkDigitValid).toBe(true)
    expect(store.record?.rechecks).toEqual([
      expect.objectContaining({
        field: 'containerId',
        positions: [7, 9],
        provider: 'luna',
        model: 'gpt-6-luna',
        outcome: 'resolved',
        resolvedPositions: [7, 9],
        resolvedVersion: 'gpt-6-luna-20260922',
      }),
    ])
    expect(store.record?.rechecks?.[0]?.observations).toEqual([
      { position: 7, value: '8', certainty: 'Likely' },
      { position: 9, value: '8', certainty: 'Likely' },
    ])
  })

  it('shows the re-check as its own ledger line on the same model and provider', async () => {
    firstReading()
    callLunaMock.mockResolvedValueOnce(recheckReply({ 7: '8', 9: '8' }))
    const store = useInspectionStore()
    store.setProvider('luna')
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    const entries = ledger.entries()
    expect(entries).toHaveLength(2)
    const recheck = entries.find((e) => e.purpose === 'Closer look at the ID')
    expect(recheck).toMatchObject({
      provider: 'luna',
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      status: 'complete',
    })
    expect(recheck!.id).not.toBe(entries.find((e) => e.purpose === 'Reading markings')!.id)
  })

  it('keeps the first result visible when the re-check fails', async () => {
    firstReading()
    callLunaMock.mockRejectedValueOnce(
      new LunaError('http', 'OpenAI is unavailable right now.', 503),
    )
    const store = useInspectionStore()
    store.setProvider('luna')
    const ledger = useLedgerStore()
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.errorMessage).toBeNull()
    expect(store.record?.containerId?.value).toBe(FIRST_PRINTED)
    expect(store.record?.rechecks?.[0]).toMatchObject({ outcome: 'failed', positions: [7, 9] })
    expect(ledger.entries().find((e) => e.purpose === 'Closer look at the ID')).toMatchObject({
      status: 'failed',
    })
  })

  it('stops at the per-inspection cap with no re-check call and no prompt', async () => {
    firstReading()
    const store = useInspectionStore()
    store.setProvider('luna')
    const ledger = useLedgerStore()
    const gate = vi
      .spyOn(ledger.ledger, 'capStatus')
      .mockReturnValueOnce({ allowed: true })
      .mockReturnValueOnce({ allowed: false, reason: 'requests' })
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(gate).toHaveBeenCalledTimes(2)
    expect(callLunaMock).not.toHaveBeenCalled()
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe(FIRST_PRINTED)
    expect(store.record?.rechecks?.[0]).toMatchObject({
      outcome: 'skipped-cap',
      reason: 'requests',
    })
    expect(store.errorMessage).toBeNull()
  })

  it('keeps the ID stage at work until the re-check settles, so the first reading never shows on its own', async () => {
    let answerRecheck: (value: unknown) => void = () => {}
    firstReading()
    callLunaMock.mockReturnValueOnce(new Promise((resolve) => (answerRecheck = resolve)))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    const run = store.start()
    await vi.waitFor(() => expect(callLunaMock).toHaveBeenCalledTimes(1))
    expect(store.stages[0]?.state).toBe('active')
    expect(store.landed('id')).toBe(false)

    answerRecheck(recheckReply({ 7: '8', 9: '8' }))
    await run
    expect(store.landed('id')).toBe(true)
    expect(store.record?.containerId?.value).toBe(FULL_ID)
  })

  it('Cancel during the re-check keeps the first reading, marked partial', async () => {
    firstReading()
    callLunaMock.mockReturnValueOnce(new Promise(() => {}))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    const run = store.start()
    await vi.waitFor(() => expect(callLunaMock).toHaveBeenCalledTimes(1))
    store.cancel()
    await run

    const signal = (callLunaMock.mock.calls[0]![0] as { signal: AbortSignal }).signal
    expect(signal.aborted).toBe(true)
    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('partial')
    expect(store.record?.containerId?.value).toBe(FIRST_PRINTED)
    expect(store.record?.rechecks?.[0]).toMatchObject({ outcome: 'cancelled', positions: [7, 9] })
    expect(
      useLedgerStore()
        .entries()
        .map((e) => e.status),
    ).toEqual(['complete', 'cancelled'])
  })

  it('makes no re-check when the first pass read every position', async () => {
    firstReading(FULL_ID)
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(callLunaMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.record?.rechecks ?? []).toEqual([])
  })
})
