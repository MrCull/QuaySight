// Ticket #53: when one request of a run fails, its cause is kept (on the record and its cost line) and
// shown in plain words. The survey fails in the three ways the browser sees: a thrown fetch, an HTTP
// 500, and a 200 without answers. Another request answers, so the run ends partial. Fetch is stubbed at
// the network edge; the other request answers without one.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'

vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { onlyRequests, registerRequest } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import type { PlanRequest } from '../../plan/requestPlan'
import { buildRawResponsesExport } from '../../domain/exports'
import { recordedInspection } from '../../__tests__/recordedInspection'
import ResultsPanel from '../../components/ResultsPanel.vue'
import ContainerDetails from '../../components/ContainerDetails.vue'
import CostIndicator from '../../components/CostIndicator.vue'

const KEY = 'test-only-openai-key-0000'

/** A request that answers without a network call, so the run has something to keep. */
const sideCheck: PlanRequest<string> = {
  id: 'side-check',
  purpose: 'Side check',
  stages: ['damage'],
  send: async () => ({
    answer: 'ok',
    resolvedModel: 'gpt-6-luna',
    usage: { inputTokens: 10, outputTokens: 0 },
    latencyMs: 5,
    reportedCostUsd: null,
    raw: { side: true },
  }),
  apply: (record) => record,
}

function setOnline(online: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online)
}

describe('a failed request keeps and shows its cause', () => {
  let restore = () => {}
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  let unregister = () => {}

  beforeEach(() => {
    restore = onlyRequests(survey)
    unregister = registerRequest(sideCheck)
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    setOnline(true)
  })
  afterEach(() => {
    unregister()
    restore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function runLuna() {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'coyu.jpg',
      url: 'blob:coyu',
      orientation: 'square',
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    await store.start()
    return store
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('a thrown fetch: the record, the cost line, the notice and the details card say the survey was refused', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const store = await runLuna()

    const record = store.record!
    expect(record.status).toBe('partial')
    expect(record.failures).toEqual([
      expect.objectContaining({
        requestId: 'read',
        stages: ['id', 'details'],
        kind: 'refused',
        cause: 'refused',
        status: null,
        message: expect.stringContaining('OpenAI refused the request'),
      }),
    ])
    const line = useLedgerStore()
      .entries()
      .find((e) => e.id.endsWith('-read'))!
    expect(line.status).toBe('failed')
    expect(line.failure).toMatchObject({ kind: 'refused', cause: 'refused' })

    const notices = mount(ResultsPanel).findAll('.qs-notice--error .qs-notice__body')
    expect(notices.map((n) => n.text())).toEqual([
      'OpenAI refused the request. Everything else found is shown.',
      'OpenAI refused the request. Everything else found is shown.',
    ])
    const details = mount(ContainerDetails, { props: { record } }).text()
    expect(details).toContain('could not be read')
    expect(details).not.toContain('container ID only')
  })

  it('an offline browser says offline', async () => {
    setOnline(false)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const store = await runLuna()
    expect(store.record!.failures![0]).toMatchObject({ kind: 'network', cause: 'offline' })
    expect(mount(ResultsPanel).text()).toContain('The connection was lost.')
  })

  it('an HTTP 500 says the provider is busy, and the cost line shows it', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'boom' } }, 500))
    const store = await runLuna()
    expect(store.record!.failures![0]).toMatchObject({ kind: 'http', cause: 'busy', status: 500 })
    expect(mount(ResultsPanel).text()).toContain('OpenAI is busy or rate-limited.')
    const cost = mount(CostIndicator)
    await cost.get('.qs-cost__toggle').trigger('click')
    expect(cost.get('.qs-cost__table').text()).toContain('busy or rate-limited')
  })

  it('a 429 is busy too', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'slow down' } }, 429))
    const store = await runLuna()
    expect(store.record!.failures![0]).toMatchObject({ cause: 'busy', status: 429 })
  })

  it('a 502 from OpenRouter saying Luna refused a question is a declined photo, not a busy provider', async () => {
    // Live, 25 Oct 2026: OpenRouter has no refusal answer, so one refused question fails the whole call.
    fetchMock.mockResolvedValueOnce(
      json(
        { error: { message: 'OpenAI refused to answer question "id_char_01"', code: 502 } },
        502,
      ),
    )
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('openai/gpt-6-luna-decisions')
    store.setApiKey('sk-or-test-only-0000')
    store.setPhoto({
      name: 'seal.jpg',
      url: 'blob:seal',
      orientation: 'portrait',
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    await store.start()

    expect(store.record!.failures![0]).toMatchObject({
      kind: 'question-refused',
      cause: 'declined',
      status: 502,
      message: expect.stringContaining('GPT-6 Luna Decisions would not answer'),
    })
    const text = mount(ResultsPanel).text()
    expect(text).toContain('The model would not answer about this photo.')
    expect(text).not.toContain('busy')
    const cost = mount(CostIndicator)
    await cost.get('.qs-cost__toggle').trigger('click')
    expect(cost.get('.qs-cost__table').text()).toContain('model would not answer (502)')
  })

  it('a 200 without answers keeps its raw body, and the raw-response download includes it', async () => {
    const body = { model: 'gpt-6-luna', usage: { input_tokens: 5 }, note: 'empty' }
    fetchMock.mockResolvedValueOnce(json(body))
    const store = await runLuna()

    expect(store.record!.failures![0]).toMatchObject({ kind: 'bad-response', cause: 'unreadable' })
    expect(mount(ResultsPanel).text()).toContain('The reply could not be read.')
    const download = buildRawResponsesExport(store.record!)
    expect(download.responses.map((r) => r.body)).toContainEqual(body)
    expect(JSON.stringify(download)).not.toContain(KEY)
  })

  it('a survey that was never asked (an ID-only recording) still says ID only', async () => {
    const record = {
      ...(await recordedInspection('luna', { delayMs: 0 })),
      details: undefined,
      sizeCode: null,
      weights: null,
    }
    const text = mount(ContainerDetails, { props: { record } }).text()
    expect(text).toContain('this run read the container ID only')
  })
})
