import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'
import { sideDamage } from '../../plan/requests/sideDamage'
import { faceStatus } from '../../domain/damage'
import { buildInspectionExport } from '../../domain/exports'
import { SIDE_DAMAGE_SET } from '../../domain/sideDamage'

// Long-side damage (#33) through the store, with fetch stubbed at the network edge: the side set goes
// with the survey on either route, and the face the survey detects chooses what the record shows.

const KEYS = { luna: 'test-only-openai-key-0000', openrouter: 'test-only-openrouter-key-0000' }
const ID = 'APHU6586847'

type Route = 'openai' | 'openrouter'
type Answer =
  | { type: 'predicate'; p: number }
  | { type: 'choice'; value: string; p?: number }
  | { type: 'score'; probabilities: number[] }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A Decisions reply in the route's own shape. */
function replyBody(route: Route, answers: Record<string, Answer>) {
  if (route === 'openai') {
    return {
      model: 'gpt-6-luna',
      answers: Object.entries(answers).map(([name, a]) => {
        if (a.type === 'predicate') return { type: 'predicate', name, probability: a.p }
        if (a.type === 'choice') {
          return {
            type: 'choice',
            name,
            choice: a.value,
            probabilities: [{ value: a.value, probability: a.p ?? 0.95 }],
          }
        }
        return {
          type: 'score',
          name,
          probabilities: a.probabilities.map((probability, value) => ({ value, probability })),
        }
      }),
      usage: { input_tokens: 31500, output_tokens: 0 },
    }
  }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers: Object.fromEntries(
      Object.entries(answers).map(([name, a]) => {
        if (a.type === 'predicate') return [name, { type: 'noul', noul: a.p }]
        if (a.type === 'choice') {
          return [
            name,
            { type: 'choice', choice: a.value, probabilities: { [a.value]: a.p ?? 0.95 } },
          ]
        }
        return [
          name,
          {
            type: 'score',
            probabilities: Object.fromEntries(a.probabilities.map((p, i) => [String(i), p])),
          },
        ]
      }),
    ),
    usage: { input_tokens: 31500, output_tokens: 0, cost: 0.0007 },
  }
}

/** The survey's answers: the ID read cleanly, and the face. */
function surveyAnswers(face = 'long_side'): Record<string, Answer> {
  const answers: Record<string, Answer> = {}
  ID.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = { type: 'choice', value: ch, p: 0.98 }
  })
  answers.photo_face = { type: 'choice', value: face, p: 0.96 }
  return answers
}

/** The side set's answers for the dented side: a dent across Z2B and Z3B, every zone seen. */
function dentedSide(doorEnd = 'not_identifiable'): Record<string, Answer> {
  const answers: Record<string, Answer> = {
    image_quality: { type: 'choice', value: 'good' },
    side_panel_coverage: { type: 'choice', value: 'most' },
    door_end_in_image: { type: 'choice', value: doorEnd },
    potentially_significant_damage: { type: 'predicate', p: 0.82 },
  }
  for (const n of [1, 2, 3, 4, 5]) {
    for (const half of ['T', 'B']) {
      const zone = `Z${n}${half}`
      const dented = zone === 'Z2B' || zone === 'Z3B'
      answers[`${zone}_visibility`] = { type: 'choice', value: 'clear' }
      answers[`${zone}_DT`] = { type: 'predicate', p: dented ? 0.92 : 0.03 }
      answers[`${zone}_severity`] = {
        type: 'score',
        probabilities: dented ? [0.02, 0.03, 0.4, 0.5, 0.05] : [0.94, 0.04, 0.01, 0.005, 0.005],
      }
    }
  }
  return answers
}

const isSide = (body: string) => body.includes('Z1T_DT')

describe('long-side damage on a live run', () => {
  let restore: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    restore = onlyRequests(survey, idRecheck, sideDamage)
  })

  afterEach(() => {
    restore()
    vi.unstubAllGlobals()
  })

  function run(
    provider: 'luna' | 'openrouter',
    replies: { survey?: () => Response; side?: () => Response } = {},
  ) {
    const route: Route = provider === 'luna' ? 'openai' : 'openrouter'
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = String(init?.body)
      if (isSide(body)) return replies.side?.() ?? json(replyBody(route, dentedSide()))
      return replies.survey?.() ?? json(replyBody(route, surveyAnswers()))
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = useInspectionStore()
    store.setProvider(provider)
    store.setApiKey(KEYS[provider])
    store.setPhoto({
      name: 'side-dented-grey.jpg',
      url: 'blob:side',
      orientation: 'landscape',
      file: new Blob(['1600x1200'], { type: 'image/jpeg' }),
    })
    const bodyOf = (side: boolean) => {
      const call = fetchMock.mock.calls.find(([, init]) => isSide(String(init?.body)) === side)
      return { url: String(call?.[0]), body: JSON.parse(String(call?.[1]?.body)) }
    }
    return { store, fetchMock, bodyOf }
  }

  it('sends the side set beside the survey through OpenRouter, translated, and places the dent in the bottom-middle zones', async () => {
    const { store, fetchMock, bodyOf } = run('openrouter')

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const side = bodyOf(true)
    expect(side.url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(Object.keys(side.body.questions)).toHaveLength(132)
    expect(side.body.questions.Z2B_DT).toMatchObject({ type: 'noul' })
    expect(JSON.stringify(side.body.state)).not.toContain('20-foot')
    expect(bodyOf(false).body.questions.photo_face).toMatchObject({ type: 'choice' })

    const damage = store.record?.damage
    expect(damage?.findings.map((f) => f.location)).toEqual([
      'Photo column 2 of 5 from the left, lower half of the side sheet',
      'Photo column 3 of 5 from the left, lower half of the side sheet',
    ])
    expect(damage?.findings[0]).toMatchObject({
      face: 'right',
      component: 'panel',
      severity: 'moderate',
      visibility: 'clear',
      types: [{ code: 'DT', probability: 0.92 }],
    })
    expect(damage).toMatchObject({
      photos: [{ photo: 'side-dented-grey.jpg', face: 'right' }],
      sideInference: { side: 'right', basis: 'defaulted' },
      imageQuality: 'good',
      coverage: 'most',
      significantProbability: 0.82,
    })
    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.status).toBe('complete')
  })

  it('sends the side set to OpenAI in OpenAI’s own shape, with the same result', async () => {
    const { store, bodyOf } = run('luna')

    await store.start()

    const side = bodyOf(true)
    expect(side.url).toBe('https://api.openai.com/v1/decisions')
    expect(side.body.questions).toEqual(SIDE_DAMAGE_SET.questions)
    expect(store.record?.damage?.findings.map((f) => f.zone)).toEqual([
      { u0: 0.2, u1: 0.4, v0: 0.5, v1: 1 },
      { u0: 0.4, u1: 0.6, v0: 0.5, v1: 1 },
    ])
  })

  it.each([
    ['image_left', 'left', 'inferred', 'from the door end'],
    ['image_right', 'right', 'inferred', 'from the front end'],
    ['not_identifiable', 'right', 'defaulted', 'from the left'],
  ] as const)(
    'with the door end %s, puts the findings on the %s side (%s)',
    async (doorEnd, side, basis, words) => {
      const { store } = run('openrouter', {
        side: () => json(replyBody('openrouter', dentedSide(doorEnd))),
      })

      await store.start()

      const damage = store.record?.damage
      expect(damage?.photos).toEqual([{ photo: 'side-dented-grey.jpg', face: side }])
      expect(damage?.sideInference).toEqual({ side, basis })
      expect(damage?.findings.map((f) => f.face)).toEqual([side, side])
      expect(damage?.findings[0]?.location).toContain(words)
      expect(damage?.zones?.every((z) => z.face === side)).toBe(true)
      const other = side === 'left' ? 'right' : 'left'
      expect(faceStatus(damage!, side)).toBe('photographed')
      expect(faceStatus(damage!, other)).toBe('not-seen')
      expect(buildInspectionExport(store.record!).damage.sideInference).toEqual({ side, basis })
    },
  )

  it('records the side request as its own ledger line and raw response', async () => {
    const { store } = run('openrouter')

    await store.start()

    const lines = useLedgerStore().entries()
    const line = lines.find((l) => l.purpose === 'Checking the long side for damage')
    expect(line).toMatchObject({ id: `${store.record!.id}-side-damage`, status: 'complete' })
    expect(store.record?.rawResponses.map((r) => r.passId)).toContain(
      `${store.record!.id}-side-damage`,
    )
    expect(store.record?.damage?.passId).toBe(`${store.record!.id}-side-damage`)
  })

  it('keeps the ID when the damage request fails, and says the damage check failed', async () => {
    const { store } = run('openrouter', {
      side: () => json({ error: { message: 'Upstream error', code: 502 } }, 502),
    })

    await store.start()

    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.damage).toBeNull()
    expect(store.record?.status).toBe('partial')
    expect(store.stages.find((s) => s.id === 'damage')?.state).toBe('failed')
    expect(store.stages.find((s) => s.id === 'id')?.state).toBe('done')
  })

  it('says damage is not assessed for this view when the survey sees the roof', async () => {
    const { store } = run('openrouter', {
      survey: () => json(replyBody('openrouter', surveyAnswers('roof'))),
    })

    await store.start()

    expect(store.record?.damage?.findings).toEqual([])
    expect(store.record?.damage?.notAssessed?.reason).toMatch(/roof/)
  })

  it('takes nothing from the side set when its own coverage says the side is not inspectable', async () => {
    const answers = dentedSide()
    answers.side_panel_coverage = { type: 'choice', value: 'not_inspectable' }
    const { store } = run('luna', { side: () => json(replyBody('openai', answers)) })

    await store.start()

    expect(store.record?.damage?.findings).toEqual([])
    expect(store.record?.damage?.notAssessed?.reason).toMatch(/not inspectable/)
  })
})
