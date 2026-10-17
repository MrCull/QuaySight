import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { registerRequest, onlyRequests } from '../../plan/registry'
import { idRecheck } from '../../plan/requests/idRecheck'
import { survey } from '../../plan/requests/survey'
import type { SurveyAnswer } from '../../domain/survey'
import {
  jsonResponse as json,
  openAiSurveyReply,
  openRouterSurveyReply,
  type SurveyChoice,
} from '../../__tests__/surveyReplies'

// The survey request (spec #27, A; ticket #32): one request per live run asks the container ID and
// every container detail together. These tests drive the store with fetch stubbed at the network edge
// and check what was sent and what the record says.

const OPENAI_KEY = 'test-only-openai-key-0000'
const OPENROUTER_KEY = 'test-only-openrouter-key-0000'

const DETAIL_QUESTIONS = [
  'size_type_code',
  'equipment_reefer',
  'equipment_open_top',
  'equipment_tank',
  'equipment_flat_rack',
  'marking_super_heavy',
  'marking_high_container',
  'marking_overwidth',
  'marking_fumigation',
  'marking_marine_pollutant',
  'dg_placard',
]

const COYU = 'COYU2668130'

/** The 22G1 COYU door photo as a careful reader sees it: no special equipment, no markings, no placard. */
const COYU_DETAILS: Record<string, SurveyChoice> = {
  size_type_code: [
    ['22G1', 0.95],
    ['22G0', 0.03],
  ],
  equipment_reefer: [['no', 0.96]],
  equipment_open_top: [['no', 0.97]],
  equipment_tank: [['no', 0.99]],
  equipment_flat_rack: [['no', 0.99]],
  marking_super_heavy: [['no', 0.95]],
  marking_high_container: [['no', 0.93]],
  marking_overwidth: [['no', 0.96]],
  marking_fumigation: [['no', 0.97]],
  marking_marine_pollutant: [['no', 0.98]],
  dg_placard: [['none', 0.94]],
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'coyu.jpg',
    url: 'blob:coyu',
    orientation: 'square',
    file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
  })
}

interface OpenAiBody {
  model: string
  questions: {
    name: string
    type: string
    instructions: string
    choices?: { value: string; description?: string }[]
  }[]
}
interface OpenRouterBody {
  questions: Record<string, { type: string; instructions: string; criteria?: unknown }>
}

function body<T>(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call = 0): T {
  return JSON.parse(String(fetchMock.mock.calls[call]![1]?.body)) as T
}

describe('the survey request reads the container details with the ID', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  let restoreRequests = () => {}

  beforeEach(() => {
    // This spec covers the survey; the damage request has its own spec.
    restoreRequests = onlyRequests(survey, idRecheck)
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
    store.setApiKey(OPENAI_KEY)
    choosePhoto(store)
    return store
  }

  function jevStore() {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('~typesafe/jev-latest')
    store.setApiKey(OPENROUTER_KEY)
    choosePhoto(store)
    return store
  }

  it('asks the ID and every detail in one OpenAI request, within its limits, with object choices', async () => {
    fetchMock.mockResolvedValueOnce(json(openAiSurveyReply(COYU, { details: COYU_DETAILS })))
    const store = lunaStore()

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = body<OpenAiBody>(fetchMock)
    const names = sent.questions.map((q) => q.name)
    expect(names.slice(0, 11)).toEqual(
      Array.from({ length: 11 }, (_, i) => `id_char_${String(i + 1).padStart(2, '0')}`),
    )
    expect(names).toEqual(expect.arrayContaining(DETAIL_QUESTIONS))
    expect(sent.questions.length).toBeLessThanOrEqual(200)
    for (const q of sent.questions) {
      expect(q.choices?.length ?? 0).toBeLessThanOrEqual(255)
      for (const c of q.choices ?? [])
        expect(c).toEqual(expect.objectContaining({ value: expect.any(String) }))
    }
    const code = sent.questions.find((q) => q.name === 'size_type_code')!
    expect(code.choices!.map((c) => c.value)).toEqual(
      expect.arrayContaining(['22G1', '45G1', '42R1', 'other', 'unreadable', 'not_visible']),
    )
    for (const name of DETAIL_QUESTIONS.filter(
      (n) => n.startsWith('equipment_') || n.startsWith('marking_'),
    )) {
      const q = sent.questions.find((x) => x.name === name)!
      expect(q.choices!.map((c) => c.value)).toEqual(['yes', 'no', 'unknown'])
    }
    // A high-container caution is a height warning; the overwidth question says not to count it.
    const overwidth = sent.questions.find((q) => q.name === 'marking_overwidth')!
    expect(overwidth.instructions).toMatch(/high-container/i)
    expect(useLedgerStore().entries()).toHaveLength(1)
  })

  it('maps the answers into the record: the printed code, what it decodes to, the checks and the markings', async () => {
    fetchMock.mockResolvedValueOnce(json(openAiSurveyReply(COYU, { details: COYU_DETAILS })))
    const store = lunaStore()

    await store.start()

    const record = store.record!
    expect(record.containerId?.value).toBe(COYU)
    expect(record.sizeCode).toMatchObject({
      code: '22G1',
      certainty: 'Confident',
      length: { feet: 20 },
      height: { label: '8 ft 6 in standard', highCube: false },
      type: { label: 'General purpose' },
    })
    const details = record.details!
    expect(details.sizeCode).toMatchObject({
      state: 'read',
      code: '22G1',
      certainty: 'Confident',
      source: 'printed',
      alternative: null,
    })
    expect(details.sizeCode.decoded?.summary).toBe('20 ft standard height, general purpose')
    expect(details.equipment.reefer).toEqual({
      answer: 'no',
      certainty: 'Confident',
      source: 'observed',
      conflict: null,
    })
    expect(details.markings.highContainer).toMatchObject({ answer: 'no', certainty: 'Not seen' })
    expect(details.markings.overwidth).toMatchObject({ answer: 'no', certainty: 'Not seen' })
    expect(details.dgPlacard).toEqual({
      answer: 'none',
      dgClass: null,
      symbol: null,
      certainty: 'Not seen',
    })
    // This reply answered no weight digit: the weights are asked and unread (Can't tell), never zero.
    expect(record.weights).toMatchObject({
      maxGross: null,
      tare: null,
      payload: null,
      capacity: null,
      unread: { maxGross: 'unclear', tare: 'unclear', capacity: 'unclear' },
    })
    expect(store.stages.find((s) => s.id === 'details')?.state).toBe('done')
    expect(store.landed('details')).toBe(true)
  })

  it('asks the same survey through OpenRouter on Jev, with the ID box, and reads it the same way', async () => {
    fetchMock.mockResolvedValueOnce(
      json(openRouterSurveyReply(COYU, { details: COYU_DETAILS, box: true })),
    )
    const store = jevStore()

    await store.start()

    const sent = body<OpenRouterBody>(fetchMock)
    expect(Object.keys(sent.questions)).toEqual(expect.arrayContaining(DETAIL_QUESTIONS))
    expect(sent.questions.container_box).toMatchObject({ type: 'box' })
    expect(sent.questions.equipment_tank?.criteria).toEqual(
      expect.objectContaining({ yes: expect.any(String), no: expect.any(String) }),
    )
    expect(Object.keys(sent.questions).length).toBeLessThanOrEqual(200)

    expect(store.record?.containerId?.value).toBe(COYU)
    expect(store.record?.details?.sizeCode).toMatchObject({ state: 'read', code: '22G1' })
    expect(store.record?.details?.equipment.flatRack.answer).toBe('no')
  })

  it("gives a request that follows it the ID's per-position readings and, on Jev, where the ID is", async () => {
    let seen: SurveyAnswer | undefined
    const undo = registerRequest({
      id: 'follows-survey',
      purpose: 'Test only',
      stages: ['id'],
      after: [survey],
      needed: (plan) => {
        seen = plan.answer(survey)
        return false
      },
      send: () => Promise.reject(new Error('not needed')),
      apply: (record) => record,
    })
    try {
      fetchMock.mockResolvedValueOnce(
        json(openRouterSurveyReply(COYU, { details: COYU_DETAILS, box: true })),
      )
      await jevStore().start()
    } finally {
      undo()
    }

    expect(seen?.readings).toHaveLength(11)
    expect(seen?.box).toMatchObject({
      top: expect.any(Number),
      bottom: expect.any(Number),
      left: expect.any(Number),
      right: expect.any(Number),
    })
  })

  it('flags a check that disagrees with the decoded code, and lowers its certainty', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        openAiSurveyReply(COYU, {
          details: {
            ...COYU_DETAILS,
            size_type_code: [['42R1', 0.93]],
            equipment_reefer: [['no', 0.95]],
          },
        }),
      ),
    )
    const store = lunaStore()

    await store.start()

    const reefer = store.record!.details!.equipment.reefer
    expect(reefer.answer).toBe('no')
    expect(reefer.certainty).toBe('Uncertain')
    expect(reefer.conflict).toMatch(/42R1/)
    expect(store.record!.sizeCode?.type.label).toBe('Reefer')
  })

  it('reads a DG placard as its class and symbol only', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        openAiSurveyReply(COYU, { details: { ...COYU_DETAILS, dg_placard: [['class_3', 0.91]] } }),
      ),
    )
    const store = lunaStore()

    await store.start()

    expect(store.record!.details!.dgPlacard).toEqual({
      answer: 'placard',
      dgClass: 3,
      symbol: 'Flame',
      certainty: 'Confident',
    })
  })

  it.each([
    ['not_visible', 'not-visible', 'Not seen'],
    ['unreadable', 'unreadable', "Can't tell"],
    ['other', 'other', 'Likely'],
  ] as const)(
    'keeps a code answered %s as such, never a forced common code',
    async (answer, state, certainty) => {
      fetchMock.mockResolvedValueOnce(
        json(
          openAiSurveyReply(COYU, {
            details: { ...COYU_DETAILS, size_type_code: [[answer, 0.8]] },
          }),
        ),
      )
      const store = lunaStore()

      await store.start()

      expect(store.record!.details!.sizeCode).toMatchObject({ state, code: null, certainty })
      expect(store.record!.sizeCode).toBeNull()
    },
  )

  it('leaves a detail the reply did not answer unread, never filled in', async () => {
    // A reply with ID answers only, as from a model that ignored the rest.
    fetchMock.mockResolvedValueOnce(json(openAiSurveyReply(COYU)))
    const store = lunaStore()

    await store.start()

    const details = store.record!.details!
    expect(details.sizeCode).toMatchObject({
      state: 'unclear',
      code: null,
      certainty: "Can't tell",
    })
    expect(details.equipment.tank).toMatchObject({ answer: null, certainty: "Can't tell" })
    expect(details.markings.superHeavy).toMatchObject({ answer: null, certainty: "Can't tell" })
    expect(details.dgPlacard).toMatchObject({ answer: null, certainty: "Can't tell" })
    expect(store.record!.sizeCode).toBeNull()
  })

  it('reads a code it is unsure of as its best value with the plausible alternative', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        openAiSurveyReply(COYU, {
          details: {
            ...COYU_DETAILS,
            size_type_code: [
              ['45G1', 0.55],
              ['42G1', 0.4],
            ],
          },
        }),
      ),
    )
    const store = lunaStore()

    await store.start()

    expect(store.record!.details!.sizeCode).toMatchObject({
      state: 'read',
      code: '45G1',
      certainty: 'Uncertain',
      alternative: '42G1',
    })
  })
})
