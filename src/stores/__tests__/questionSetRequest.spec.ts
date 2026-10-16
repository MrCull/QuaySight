import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import type { PlanRequest } from '../../plan/requestPlan'
import { registerRequest, onlyRequests } from '../../plan/registry'
import { askDecisions } from '../../services/askDecisions'
import { questionSetAsk } from '../../domain/questionSetAsk'
import { questionSet, type SharedAnswer, type SharedQuestionSet } from '../../domain/questionSet'

// How a later ticket adds a request from a shared-format question set (#29 on #28's plan seam): the
// set is written once, sent in each route's wire format, and answers come back typed by meaning.
declare module '../../domain/inspection' {
  interface InspectionRecord {
    testQuality?: Record<string, SharedAnswer>
  }
}

const KEYS = { luna: 'test-only-openai-key-0000', openrouter: 'test-only-openrouter-key-0000' }

const QUALITY_SET = questionSet('Freight container photo. Judge only what is visible.', [
  { type: 'predicate', name: 'tq_door_end', instructions: 'Is the door end in view?' },
  {
    type: 'choice',
    name: 'tq_quality',
    instructions: 'Is the photo good enough to inspect?',
    choices: [{ value: 'good', description: 'Sharp and well lit' }, { value: 'poor' }],
  },
  {
    type: 'score',
    name: 'tq_severity',
    instructions: 'How severe is the worst visible defect?',
    levels: [{ label: 'none' }, { label: 'minor' }, { label: 'major' }],
  },
])

function qualityRequest(set: SharedQuestionSet = QUALITY_SET): PlanRequest {
  const request: PlanRequest<Record<string, SharedAnswer>> = {
    id: 'test-quality',
    purpose: 'Test photo quality',
    stages: ['details'],
    send: (ctx) =>
      askDecisions(
        ctx,
        questionSetAsk(set, (reply) => reply.answers),
      ),
    apply: (record, outcome) =>
      outcome.status === 'answered' ? { ...record, testQuality: outcome.answer } : record,
  }
  return request as PlanRequest
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ID = 'APHU6586847'

/** Replies by route and request: the ID read cleanly, and the quality set's answers. */
function reply(route: 'openai' | 'openrouter', body: string): Response {
  const quality = body.includes('tq_door_end')
  if (route === 'openai') {
    return json({
      model: 'gpt-6-luna',
      answers: quality
        ? [
            { type: 'predicate', name: 'tq_door_end', probability: 0.97 },
            {
              type: 'choice',
              name: 'tq_quality',
              choice: 'good',
              probabilities: [
                { value: 'good', probability: 0.8 },
                { value: 'poor', probability: 0.2 },
              ],
            },
            {
              type: 'score',
              name: 'tq_severity',
              score: 0.2,
              probabilities: [
                { value: 0, label: 'none', probability: 0.85 },
                { value: 1, label: 'minor', probability: 0.1 },
                { value: 2, label: 'major', probability: 0.05 },
              ],
            },
          ]
        : ID.split('').map((ch, i) => ({
            type: 'choice',
            name: `id_char_${String(i + 1).padStart(2, '0')}`,
            choice: ch,
            probabilities: [{ value: ch, probability: 0.98 }],
          })),
    })
  }
  const answers: Record<string, unknown> = {}
  if (quality) {
    answers.tq_door_end = { type: 'noul', noul: 0.97 }
    answers.tq_quality = { type: 'choice', choice: 'good', probabilities: { good: 0.8, poor: 0.2 } }
    answers.tq_severity = {
      type: 'score',
      score: 0.2,
      probabilities: { '0': 0.85, '1': 0.1, '2': 0.05 },
    }
  } else {
    ID.split('').forEach((ch, i) => {
      answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
        type: 'choice',
        choice: ch,
        probabilities: { [ch]: 0.98 },
      }
    })
  }
  return json({
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 900, cost: 0.00004 },
  })
}

import { readId } from '../../plan/requests/readId'
import { idRecheck } from '../../plan/requests/idRecheck'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(readId, idRecheck)
})
afterAll(() => restoreRequests())

describe('a request built from a shared-format question set', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  let undo: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    undo = () => {}
  })

  afterEach(() => {
    undo()
    vi.unstubAllGlobals()
  })

  function run(provider: 'luna' | 'openrouter', set?: SharedQuestionSet) {
    undo = registerRequest(qualityRequest(set))
    const route = provider === 'luna' ? 'openai' : 'openrouter'
    fetchMock = vi.fn<typeof fetch>(async (_input, init) => reply(route, String(init?.body)))
    vi.stubGlobal('fetch', fetchMock)
    const store = useInspectionStore()
    store.setProvider(provider)
    store.setApiKey(KEYS[provider])
    store.setPhoto({
      name: 'rear.jpg',
      url: 'blob:original',
      orientation: 'portrait',
      file: new Blob(['1200x1600'], { type: 'image/jpeg' }),
    })
    return store
  }

  /** The body sent for the quality set. */
  function qualityBody(): Record<string, unknown> {
    const call = fetchMock.mock.calls.find(([, init]) => String(init?.body).includes('tq_door_end'))
    return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>
  }

  const typedAnswers = {
    tq_door_end: { type: 'predicate', probability: 0.97 },
    tq_quality: {
      type: 'choice',
      value: 'good',
      probabilities: { good: 0.8, poor: 0.2 },
      confidence: null,
    },
    tq_severity: {
      type: 'score',
      level: 0,
      label: 'none',
      score: 0.2,
      probabilities: [0.85, 0.1, 0.05],
      confidence: null,
    },
  }

  it('sends the set in OpenAI’s shape to OpenAI and gets typed answers back', async () => {
    const store = run('luna')

    await store.start()

    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://api.openai.com/v1/decisions')
    expect(qualityBody().questions).toEqual(QUALITY_SET.questions)
    expect(store.record?.testQuality).toEqual(typedAnswers)
    expect(store.record?.containerId?.value).toBe(ID)
  })

  it('sends the same set in OpenRouter’s shape to OpenRouter and gets the same typed answers back', async () => {
    const store = run('openrouter')

    await store.start()

    expect(qualityBody().questions).toMatchObject({
      tq_door_end: { type: 'noul' },
      tq_quality: { type: 'choice', criteria: { good: 'Sharp and well lit', poor: null } },
      tq_severity: { type: 'score', criteria: ['none', 'minor', 'major'] },
    })
    expect(store.record?.testQuality).toEqual(typedAnswers)
  })

  it('refuses an over-limit set before sending it, and the rest of the run still lands', async () => {
    const tooMany = questionSet(
      'x',
      Array.from({ length: 201 }, (_, i) => ({
        type: 'predicate' as const,
        name: `tq_door_end_${i}`,
        instructions: 'y',
      })),
    )
    const store = run('openrouter', tooMany)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![1]?.body)).not.toContain('tq_door_end')
    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.testQuality).toBeUndefined()
  })
})
