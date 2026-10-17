import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { chosenLength } from '../../domain/chosenLength'
import { buildInspectionExport } from '../../domain/exports'
import {
  jsonResponse as json,
  openAiSurveyReply,
  openRouterSurveyReply,
  type SurveyChoice,
} from '../../__tests__/surveyReplies'

// The survey's length question (ticket #46): the store is driven with fetch stubbed at the network edge,
// and the length it settles on, and where that came from, is read off the record and its export.

const COYU = 'COYU2668130'

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'coyu.jpg',
    url: 'blob:coyu',
    orientation: 'square',
    file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
  })
}

const CODE_22G1_CONFIDENT: SurveyChoice = [
  ['22G1', 0.95],
  ['22G0', 0.03],
]
const CODE_22G1_WEAK: SurveyChoice = [
  ['22G1', 0.6],
  ['22G0', 0.35],
]
const LENGTH_40: SurveyChoice = [
  ['40_ft', 0.95],
  ['20_ft', 0.03],
]
const LENGTH_45: SurveyChoice = [
  ['45_ft', 0.93],
  ['40_ft', 0.04],
]

describe('container length from the survey', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  let restoreRequests = () => {}

  beforeEach(() => {
    restoreRequests = onlyRequests(survey)
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    restoreRequests()
    vi.unstubAllGlobals()
  })

  function lunaStore() {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey('test-only-openai-key-0000')
    choosePhoto(store)
    return store
  }

  async function runWith(details: Record<string, SurveyChoice>) {
    fetchMock.mockResolvedValueOnce(json(openAiSurveyReply(COYU, { details })))
    const store = lunaStore()
    await store.start()
    return store.record!
  }

  it('asks "about how long" with 20, 40 and 45 ft on Luna', async () => {
    fetchMock.mockResolvedValueOnce(json(openAiSurveyReply(COYU)))
    await lunaStore().start()
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      questions: { name: string; instructions: string; choices: { value: string }[] }[]
    }
    const q = sent.questions.find((x) => x.name === 'container_length')!
    expect(q.instructions).toMatch(/about how long/i)
    expect(q.choices.map((c) => c.value)).toEqual(
      expect.arrayContaining(['20_ft', '40_ft', '45_ft']),
    )
  })

  it('asks it on Jev too', async () => {
    fetchMock.mockResolvedValueOnce(json(openRouterSurveyReply(COYU, { box: true })))
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('~typesafe/jev-latest')
    store.setApiKey('test-only-openrouter-key-0000')
    choosePhoto(store)
    await store.start()
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      questions: Record<string, { type: string }>
    }
    expect(sent.questions.container_length).toMatchObject({ type: 'choice' })
  })

  it('uses a Confident ISO code length, even when the model answered 40', async () => {
    const record = await runWith({
      size_type_code: CODE_22G1_CONFIDENT,
      container_length: LENGTH_40,
    })
    expect(chosenLength(record)).toEqual({ feet: 20, source: 'iso-code' })
    expect(buildInspectionExport(record).containerLength).toEqual({
      feet: 20,
      source: 'iso-code',
    })
  })

  it('uses the model answer when the ISO code is below Confident', async () => {
    const record = await runWith({ size_type_code: CODE_22G1_WEAK, container_length: LENGTH_45 })
    expect(chosenLength(record)).toEqual({ feet: 45, source: 'model' })
    expect(buildInspectionExport(record).containerLength).toEqual({ feet: 45, source: 'model' })
  })

  it('uses the model answer when no ISO code was read', async () => {
    const record = await runWith({
      size_type_code: [['not_visible', 0.95]],
      container_length: [['20_ft', 0.94]],
    })
    expect(buildInspectionExport(record).containerLength).toEqual({ feet: 20, source: 'model' })
  })

  it('draws 40 ft and says it was the default when there is no code and no usable answer', async () => {
    const record = await runWith({
      size_type_code: [['not_visible', 0.95]],
      container_length: [['unknown', 0.9]],
    })
    expect(buildInspectionExport(record).containerLength).toEqual({ feet: 40, source: 'default' })
  })
})
