import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { OWNER_CODES } from '../../domain/ownerCodes'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'
import { idCropRead } from '../../plan/requests/idCropRead'
import { jsonResponse, openRouterSurveyReply } from '../../__tests__/surveyReplies'

// Ticket #43 test gaps: the owner-code question on the Jev request, the survey's owner pick carried into
// the re-check and the crop read, and the request plan around it. Replies are hand-written fakes of the
// shapes seen live on 16 Oct 2026. CAXU 692110 9 passes the check digit; CXXU 692110 9 does not.
const KEY = 'test-only-openrouter-key-0000'
const COYU_BOX = { top: 0.1, bottom: 0.14, left: 0.61, right: 0.79 }
const PICK = { owner_code: [['CAXU', 0.95]] as [string, number][] }
const LUNA = 'openai/gpt-6-luna-decisions-20261006'

let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck, idCropRead)
})
afterAll(() => restoreRequests())

type Questions = Record<string, { criteria?: Record<string, unknown> }>
const sentQuestions = (init: RequestInit | undefined) =>
  (JSON.parse(String(init?.body)) as { questions: Questions }).questions

describe('the owner-code question through live runs', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function liveStore(model: string) {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel(model)
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'caxu.jpg',
      url: 'blob:caxu',
      orientation: 'square',
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    return store
  }

  it('asks Jev the owner-code question with the list, and the model owner pick wins over the letters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(openRouterSurveyReply('CXXU6921109', { details: PICK })),
    )
    const store = liveStore('~typesafe/jev-latest')

    await store.start()

    const ask = sentQuestions(fetchMock.mock.calls[0]![1]).owner_code!
    expect(Object.keys(ask.criteria!)).toEqual(['none', ...OWNER_CODES])
    expect(store.record!.containerId).toMatchObject({
      value: 'CAXU6921109',
      checkDigitValid: true,
    })
  })

  it('carries the survey owner pick into the Luna re-check merge', async () => {
    // Position 11 is unread on the first pass; the re-check reads it. The pick CAXU must still stand.
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        jsonResponse(
          String(init?.body).includes('owner_code')
            ? openRouterSurveyReply('CXXU692110?', { model: LUNA, details: PICK })
            : openRouterSurveyReply('CXXU6921109', { model: LUNA }),
        ),
      ),
    )
    const store = liveStore('openai/gpt-6-luna-decisions')

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.record!.rechecks?.[0]).toMatchObject({ outcome: 'resolved' })
    expect(store.record!.containerId).toMatchObject({ value: 'CAXU6921109', checkDigitValid: true })
  })

  it('carries the survey owner pick into the Jev crop read combination', async () => {
    const full = openRouterSurveyReply('CXXU6921109', { box: true, details: PICK })
    ;(full.answers.container_box as { box: unknown }).box = COYU_BOX
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        jsonResponse(
          String(init?.body).includes('container_box')
            ? full
            : openRouterSurveyReply('CXXU6921109'),
        ),
      ),
    )
    const store = liveStore('~typesafe/jev-latest')

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.record!.idCropRead).toMatchObject({ outcome: 'combined' })
    expect(store.record!.containerId).toMatchObject({ value: 'CAXU6921109', checkDigitValid: true })
  })

  it('adds the owner-code question to the one survey request, not a request of its own, and prices it', async () => {
    const reply = openRouterSurveyReply('CAXU6921109', { details: PICK })
    delete (reply.usage as { cost?: number }).cost
    fetchMock.mockResolvedValue(jsonResponse(reply))
    const store = liveStore('~typesafe/jev-latest')

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const questions = sentQuestions(fetchMock.mock.calls[0]![1])
    expect(questions.owner_code).toBeDefined()
    expect(Object.keys(questions).length).toBeLessThanOrEqual(200)
    const [entry] = useLedgerStore().entries()
    expect(entry).toMatchObject({ costState: 'estimated' })
    expect(entry!.costUsd).toBeGreaterThan(0)
  })
})
