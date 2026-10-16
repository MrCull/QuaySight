import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation and the crop run on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'
import { recordRun, parsePlanRecording } from '../recording'
import { replayRecording } from '../replay'
import { weightChoices, COYU_WEIGHTS } from '../../__tests__/weightReplies'
import { openRouterSurveyReply, openAiSurveyReply } from '../../__tests__/surveyReplies'
import type { SurveyChoice } from '../../__tests__/surveyReplies'

// Replaying a recording (spec #27, ticket #37). A recording is the raw responses of one live run of the
// whole plan, one per request. Replaying it must give the record the live run gave, through the same
// answer mappers: so the oracle here is a live run through the store with fetch stubbed at the network
// edge, recorded and replayed.

const KEY = 'test-only-openrouter-key-0000'
const OPENAI_KEY = 'test-only-openai-key-0000'
const PHOTO = { name: 'rear-door-coyu-22g1.jpg', orientation: 'square' as const }
const COYU = 'COYU2668130'

const DETAILS: Record<string, SurveyChoice> = {
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
  photo_face: [['rear_doors', 0.96]],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenRouter reply to a question set, with each answer named by what it asks (no box, no cost). */
function keyedReply(answers: Record<string, unknown>) {
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 21000, output_tokens: 0, cost: 0.0005 },
  }
}

const CLEAN_SEVERITY = { '0': 0.94, '1': 0.04, '2': 0.01, '3': 0.005, '4': 0.005 }

/** The door set's answers on OpenRouter: a dented photo-right leaf, bottom third. */
function doorReply() {
  const answers: Record<string, unknown> = {
    image_quality: { type: 'choice', choice: 'good', probabilities: { good: 0.95 } },
    door_end_coverage: { type: 'choice', choice: 'most', probabilities: { most: 0.9 } },
    potentially_significant_damage: { type: 'noul', noul: 0.6 },
  }
  for (const leaf of [1, 2]) {
    for (const band of ['T', 'M', 'B']) {
      const zone = `D${leaf}${band}`
      const dented = zone === 'D2B'
      answers[`${zone}_visibility`] = {
        type: 'choice',
        choice: 'clear',
        probabilities: { clear: 0.95 },
      }
      answers[`${zone}_DT`] = { type: 'noul', noul: dented ? 0.9 : 0.03 }
      answers[`${zone}_severity`] = {
        type: 'score',
        probabilities: dented
          ? { '0': 0.03, '1': 0.07, '2': 0.6, '3': 0.25, '4': 0.05 }
          : CLEAN_SEVERITY,
      }
    }
  }
  return keyedReply(answers)
}

/** The side set's reply for a photo that is no long side: its own coverage says not inspectable. */
function sideReply() {
  return keyedReply({
    side_panel_coverage: {
      type: 'choice',
      choice: 'not_inspectable',
      probabilities: { not_inspectable: 0.95 },
    },
  })
}

/** The same answers in OpenAI's own shape: a list, with predicates and score levels spelt out. */
function openAiShape(reply: ReturnType<typeof keyedReply>) {
  type Keyed = {
    type: string
    noul?: number
    choice?: string
    probabilities?: Record<string, number>
  }
  return {
    model: 'gpt-6-luna',
    usage: { input_tokens: 21000, output_tokens: 0 },
    answers: Object.entries(reply.answers as Record<string, Keyed>).map(([name, a]) => {
      if (a.type === 'noul') return { type: 'predicate', name, probability: a.noul }
      const probabilities = Object.entries(a.probabilities ?? {}).map(([value, probability]) => ({
        value: a.type === 'score' ? Number(value) : value,
        probability,
      }))
      return a.type === 'score'
        ? { type: 'score', name, probabilities }
        : { type: 'choice', name, choice: a.choice, probabilities }
    }),
  }
}

type Replies = Partial<Record<'survey' | 'side' | 'door' | 'crop' | 'weights', unknown>>

function kindOf(body: string): 'survey' | 'side' | 'door' | 'crop' | 'weights' {
  if (body.includes('D1T_DT')) return 'door'
  if (body.includes('Z1T_DT')) return 'side'
  if (body.includes('size_type_code')) return 'survey'
  if (body.includes('id_char_01')) return 'crop'
  return 'weights'
}

describe('replaying a recorded run of the whole plan', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function liveRun(provider: 'openrouter' | 'luna', replies: Replies = {}) {
    fetchMock.mockImplementation(async (_input, init) => {
      const kind = kindOf(String(init?.body))
      const given = replies[kind]
      if (given) return json(given)
      switch (kind) {
        case 'survey':
          return json(
            provider === 'luna'
              ? openAiSurveyReply(COYU, { details: { ...DETAILS, ...weightChoices(COYU_WEIGHTS) } })
              : openRouterSurveyReply(COYU, {
                  box: true,
                  details: { ...DETAILS, ...weightChoices(COYU_WEIGHTS) },
                }),
          )
        case 'side':
          return json(provider === 'luna' ? openAiShape(sideReply()) : sideReply())
        case 'door':
          return json(provider === 'luna' ? openAiShape(doorReply()) : doorReply())
        default:
          return json(openRouterSurveyReply(COYU))
      }
    })
    const store = useInspectionStore()
    store.setProvider(provider)
    if (provider === 'openrouter') store.setModel('~typesafe/jev-latest')
    store.setApiKey(provider === 'luna' ? OPENAI_KEY : KEY)
    store.setPhoto({
      name: PHOTO.name,
      url: 'blob:coyu',
      orientation: PHOTO.orientation,
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    await store.start()
    expect(store.record?.status).toBe('complete')
    const live = store.record!
    const recording = recordRun(live, useLedgerStore().entries(), {
      photo: `samples/${PHOTO.name}`,
      recordedAt: '2026-10-17T09:00:00.000Z',
    })
    return { live, recording }
  }

  it('gives the record the live run gave: ID, details, weights, face, damage and crop read', async () => {
    const { live, recording } = await liveRun('openrouter')

    const replayed = replayRecording(recording, { id: live.id, photo: PHOTO })

    // What the run found, as literals (independent of the replay path).
    expect(replayed.containerId?.value).toBe(COYU)
    expect(replayed.details?.sizeCode.code).toBe('22G1')
    expect(replayed.photoFace?.face).toBe('rear-doors')
    expect(replayed.weights?.maxGross).toMatchObject({ valueKg: 30480, valueLb: 67200 })
    expect(replayed.damage?.findings.map((f) => f.location)).toEqual([
      'Photo-right door leaf, bottom third',
    ])
    expect(replayed.idCropRead?.outcome).toBe('combined')
    // And the same as the live run, field for field.
    for (const key of [
      'containerId',
      'details',
      'sizeCode',
      'weights',
      'photoFace',
      'damage',
      'idCropRead',
      'resolvedVersion',
      'provider',
      'model',
    ] as const) {
      expect({ [key]: replayed[key] }).toEqual({ [key]: live[key] })
    }
  })

  it('is a recorded demonstration: no live source, saved bodies kept, complete', async () => {
    const { live, recording } = await liveRun('openrouter')

    const replayed = replayRecording(recording, { id: 'demo-coyu-1', photo: PHOTO })

    expect(replayed).toMatchObject({ id: 'demo-coyu-1', source: 'recorded', status: 'complete' })
    expect(replayed.photo).toEqual(PHOTO)
    expect(replayed.rawResponses.map((r) => r.body)).toEqual(live.rawResponses.map((r) => r.body))
    expect(replayed.rawResponses.map((r) => r.passId)).toEqual(
      live.rawResponses.map((r) => r.passId.replace(live.id, 'demo-coyu-1')),
    )
    expect(new Set(replayed.rawResponses.map((r) => r.capturedFrom))).toEqual(
      new Set(['recorded-fixture']),
    )
  })

  it('replays on OpenAI too, where there is no box and so no crop read', async () => {
    const { live, recording } = await liveRun('luna')

    const replayed = replayRecording(recording, { id: live.id, photo: PHOTO })

    expect(replayed.idCropRead).toBeUndefined()
    expect(replayed.containerId).toEqual(live.containerId)
    expect(replayed.details).toEqual(live.details)
    expect(replayed.damage).toEqual(live.damage)
    expect(replayed.weights).toEqual(live.weights)
  })

  it('replays the weights second look when the recorded run needed one', async () => {
    // The pounds on max gross are misread by a digit: kg and lb disagree, so the weights are asked again.
    const misread = weightChoices({
      ...COYU_WEIGHTS,
      maxGross: { kg: '30,480', lb: '67,900' },
    })
    const { live, recording } = await liveRun('openrouter', {
      survey: openRouterSurveyReply(COYU, { box: true, details: { ...DETAILS, ...misread } }),
      weights: openRouterSurveyReply(COYU, { details: weightChoices(COYU_WEIGHTS) }),
    })
    expect(live.weights?.reread).toBe('settled')

    const replayed = replayRecording(recording, { id: 'demo-coyu-3', photo: PHOTO })

    expect(recording.entries.map((e) => e.request)).toContain('weights')
    expect(replayed.weights).toEqual(live.weights)
    expect(replayed.weights?.maxGross?.valueLb).toBe(67200)
  })

  it('carries each request’s latency and cost beside its response, from the ledger', async () => {
    const { recording } = await liveRun('openrouter')

    const read = recording.entries.find((e) => e.request === 'read')!
    expect(read.costUsd).toBe(0.0003)
    expect(read.latencyMs).toEqual(expect.any(Number))
    expect(recording.provider).toBe('openrouter')
    expect(recording.model).toBe('~typesafe/jev-latest')
    expect(recording.photo).toBe('samples/rear-door-coyu-22g1.jpg')
    expect(recording.recordedAt).toBe('2026-10-17T09:00:00.000Z')
  })

  it('refuses to record a run that did not complete', async () => {
    const { live } = await liveRun('openrouter')

    expect(() =>
      recordRun({ ...live, status: 'partial' }, useLedgerStore().entries(), {
        photo: 'samples/x.jpg',
        recordedAt: '2026-10-17T09:00:00.000Z',
      }),
    ).toThrow(/complete/)
  })

  it('survives a JSON round trip and refuses a recording that contains a key', async () => {
    const { recording } = await liveRun('openrouter')

    const parsed = parsePlanRecording(JSON.parse(JSON.stringify(recording)))
    expect(parsed).toEqual(recording)

    const leaky = JSON.parse(JSON.stringify(recording))
    // Built at run time so that this file holds no key-shaped text itself.
    leaky.entries[0].response.note = `Authorization: Bearer ${['sk', 'or', 'v1', 'abcdef0123456789abcdef'].join('-')}`
    expect(() => parsePlanRecording(leaky)).toThrow(/key/i)
  })
})
