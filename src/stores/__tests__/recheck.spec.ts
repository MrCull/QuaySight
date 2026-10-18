import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { jsonResponse, openAiSurveyReply } from '../../__tests__/surveyReplies'

const KEY = 'test-only-key-value-0000'

// Hand-written: APHU658684 with check digit 7 is the worked example. Positions 7 and 9 are unread on the
// first pass, which is the survey's reading (fetch stubbed); the re-check is a second fetch (stubbed).
const FIRST_PRINTED = 'APHU65?6?47'
const FULL_ID = 'APHU6586847'

/** An OpenAI reply to a re-check that reads only the given positions (1-based, value by position). */
function recheckReply(overrides: Partial<Record<number, string>> = {}) {
  return jsonResponse({
    model: 'gpt-6-luna-20260922',
    answers: Object.entries(overrides).map(([position, value]) => ({
      type: 'choice',
      name: `id_char_${position.padStart(2, '0')}`,
      choice: value,
      probabilities: [{ value, probability: 0.8 }],
    })),
    usage: { input_tokens: 2100 },
  })
}

/** The re-check is the run's second request: the survey is the first. */
function recheckCall(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
  return {
    positions: (JSON.parse(String(init.body)).questions as { name: string }[]).map((q) =>
      Number(q.name.slice(-2)),
    ),
    apiKey: String((init.headers as Record<string, string>).Authorization).replace('Bearer ', ''),
    signal: init.signal as AbortSignal,
  }
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear.jpg',
    url: 'blob:x',
    orientation: 'landscape',
    file: new Blob(['x'], { type: 'image/jpeg' }),
  })
}

import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck)
})
afterAll(() => restoreRequests())

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
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('re-asks only the unread positions once, on the same model, and merges the answer', async () => {
    firstReading()
    fetchMock.mockResolvedValueOnce(recheckReply({ 7: '8', 9: '8' }))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = recheckCall(fetchMock)
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
    fetchMock.mockResolvedValueOnce(recheckReply({ 7: '8', 9: '8' }))
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'down' } }, 503))
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe(FIRST_PRINTED)
    expect(store.record?.rechecks?.[0]).toMatchObject({
      outcome: 'skipped-cap',
      reason: 'requests',
    })
    expect(store.errorMessage).toBeNull()
  })

  it('keeps the ID stage at work until the re-check settles, so the first reading never shows on its own', async () => {
    let answerRecheck: (value: Response) => void = () => {}
    firstReading()
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (answerRecheck = resolve)))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    const run = store.start()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(store.stages[0]?.state).toBe('active')
    expect(store.landed('id')).toBe(false)

    answerRecheck(recheckReply({ 7: '8', 9: '8' }))
    await run
    expect(store.landed('id')).toBe(true)
    expect(store.record?.containerId?.value).toBe(FULL_ID)
  })

  it('makes no re-check when the first pass read every position', async () => {
    firstReading(FULL_ID)
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.record?.rechecks ?? []).toEqual([])
  })
})
