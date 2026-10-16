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
import { doorDamage } from '../../plan/requests/doorDamage'
import { DOOR_DAMAGE_SET } from '../../domain/doorDamage'

// Door-end damage (#35) through the store, with fetch stubbed at the network edge: the door set goes
// with the survey and the side set on either route, and the face the survey detects chooses which one
// the record shows.

const KEYS = { luna: 'test-only-openai-key-0000', openrouter: 'test-only-openrouter-key-0000' }
const ID = 'COYU2668130'

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
      usage: { input_tokens: 21000, output_tokens: 0 },
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
    usage: { input_tokens: 21000, output_tokens: 0, cost: 0.0005 },
  }
}

/** The survey's answers: the ID read cleanly, and the face. */
function surveyAnswers(face = 'rear_doors'): Record<string, Answer> {
  const answers: Record<string, Answer> = {}
  ID.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = { type: 'choice', value: ch, p: 0.98 }
  })
  answers.photo_face = { type: 'choice', value: face, p: 0.96 }
  return answers
}

const CLEAN_SEVERITY = [0.94, 0.04, 0.01, 0.005, 0.005]

/** The door set's answers: a dented lower photo-right leaf and a bent photo-left locking bar. */
function dentedDoors(): Record<string, Answer> {
  const answers: Record<string, Answer> = {
    image_quality: { type: 'choice', value: 'good' },
    door_end_coverage: { type: 'choice', value: 'most' },
    potentially_significant_damage: { type: 'predicate', p: 0.6 },
    left_leaf_locking_bar_bent: { type: 'predicate', p: 0.8 },
  }
  for (const leaf of [1, 2]) {
    for (const band of ['T', 'M', 'B']) {
      const zone = `D${leaf}${band}`
      const dented = zone === 'D2B'
      answers[`${zone}_visibility`] = { type: 'choice', value: 'clear' }
      answers[`${zone}_DT`] = { type: 'predicate', p: dented ? 0.9 : 0.03 }
      answers[`${zone}_severity`] = {
        type: 'score',
        probabilities: dented ? [0.03, 0.07, 0.6, 0.25, 0.05] : CLEAN_SEVERITY,
      }
    }
  }
  return answers
}

/** The side set's answers for a photo that is no long side: coverage says it cannot be inspected. */
function notASide(): Record<string, Answer> {
  return {
    side_panel_coverage: { type: 'choice', value: 'not_inspectable' },
    Z2B_DT: { type: 'predicate', p: 0.9 },
    Z2B_visibility: { type: 'choice', value: 'clear' },
    Z2B_severity: { type: 'score', probabilities: [0.02, 0.03, 0.3, 0.6, 0.05] },
  }
}

const isSide = (body: string) => body.includes('Z1T_DT')
const isDoor = (body: string) => body.includes('D1T_DT')

describe('door-end damage on a live run', () => {
  let restore: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    restore = onlyRequests(survey, idRecheck, sideDamage, doorDamage)
  })

  afterEach(() => {
    restore()
    vi.unstubAllGlobals()
  })

  function run(
    provider: 'luna' | 'openrouter',
    replies: {
      survey?: () => Response
      side?: () => Response
      door?: () => Response
    } = {},
  ) {
    const route: Route = provider === 'luna' ? 'openai' : 'openrouter'
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = String(init?.body)
      if (isDoor(body)) return replies.door?.() ?? json(replyBody(route, dentedDoors()))
      if (isSide(body)) return replies.side?.() ?? json(replyBody(route, notASide()))
      return replies.survey?.() ?? json(replyBody(route, surveyAnswers()))
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = useInspectionStore()
    store.setProvider(provider)
    store.setApiKey(KEYS[provider])
    store.setPhoto({
      name: 'rear-door-coyu-22g1.jpg',
      url: 'blob:doors',
      orientation: 'landscape',
      file: new Blob(['1079x800'], { type: 'image/jpeg' }),
    })
    const bodyOf = (which: 'door' | 'side') => {
      const call = fetchMock.mock.calls.find(([, init]) =>
        (which === 'door' ? isDoor : isSide)(String(init?.body)),
      )
      return { url: String(call?.[0]), body: JSON.parse(String(call?.[1]?.body)) }
    }
    return { store, fetchMock, bodyOf }
  }

  it('sends the door set beside the survey and the side set through OpenRouter, translated', async () => {
    const { store, fetchMock, bodyOf } = run('openrouter')

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const door = bodyOf('door')
    expect(door.url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(Object.keys(door.body.questions)).toHaveLength(DOOR_DAMAGE_SET.questions.length)
    expect(door.body.questions.D2B_DT).toMatchObject({ type: 'noul' })
    expect(door.body.questions.D2B_severity).toMatchObject({ type: 'score' })
    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.status).toBe('complete')
  })

  it('shows the door findings for the rear-doors face, ignoring the side set’s', async () => {
    const { store } = run('openrouter')

    await store.start()

    const damage = store.record?.damage
    expect(damage?.photos).toEqual([{ photo: 'rear-door-coyu-22g1.jpg', face: 'rear' }])
    expect(damage?.findings.map((f) => f.location)).toEqual([
      'Photo-right door leaf, bottom third',
      'Locking bar on the photo-left door leaf',
    ])
    expect(damage?.findings[0]).toMatchObject({
      face: 'rear',
      component: 'panel',
      severity: 'minor',
      visibility: 'clear',
      types: [{ code: 'DT', probability: 0.9 }],
    })
    expect(damage?.findings[1]).toMatchObject({ component: 'locking-bar', severity: null })
    expect(damage?.zones).toHaveLength(6)
    expect(damage).toMatchObject({
      imageQuality: 'good',
      coverage: 'most',
      significantProbability: 0.6,
    })
    expect(damage?.findings.some((f) => f.face === 'long-side')).toBe(false)
  })

  it('sends the door set to OpenAI in OpenAI’s own shape, with the same result', async () => {
    const { store, bodyOf } = run('luna')

    await store.start()

    const door = bodyOf('door')
    expect(door.url).toBe('https://api.openai.com/v1/decisions')
    expect(door.body.questions).toEqual(DOOR_DAMAGE_SET.questions)
    expect(store.record?.damage?.findings[0]?.zone).toMatchObject({ u0: 0.5, u1: 0.95 })
  })

  it('shows the side findings for a long side, ignoring the door set’s', async () => {
    const side: Record<string, Answer> = {
      side_panel_coverage: { type: 'choice', value: 'full' },
      Z2B_visibility: { type: 'choice', value: 'clear' },
      Z2B_DT: { type: 'predicate', p: 0.9 },
      Z2B_severity: { type: 'score', probabilities: [0.02, 0.03, 0.3, 0.6, 0.05] },
    }
    const { store } = run('openrouter', {
      survey: () => json(replyBody('openrouter', surveyAnswers('long_side'))),
      side: () => json(replyBody('openrouter', side)),
    })

    await store.start()

    expect(store.record?.damage?.photos).toEqual([
      { photo: 'rear-door-coyu-22g1.jpg', face: 'long-side' },
    ])
    expect(store.record?.damage?.findings.map((f) => f.face)).toEqual(['long-side'])
  })

  it('records the door request as its own ledger line and raw response', async () => {
    const { store } = run('openrouter')

    await store.start()

    const line = useLedgerStore()
      .entries()
      .find((l) => l.purpose === 'Checking the door end for damage')
    expect(line).toMatchObject({ id: `${store.record!.id}-door-damage`, status: 'complete' })
    expect(store.record?.rawResponses.map((r) => r.passId)).toContain(
      `${store.record!.id}-door-damage`,
    )
    expect(store.record?.damage?.passId).toBe(`${store.record!.id}-door-damage`)
  })

  it('keeps the ID when the door request fails, and says the damage check failed', async () => {
    const { store } = run('openrouter', {
      door: () => json({ error: { message: 'Upstream error', code: 502 } }, 502),
    })

    await store.start()

    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.damage).toBeNull()
    expect(store.record?.status).toBe('partial')
    expect(store.stages.find((s) => s.id === 'damage')?.state).toBe('failed')
  })

  it('says damage is not assessed for this view when the survey sees the roof', async () => {
    const { store } = run('openrouter', {
      survey: () => json(replyBody('openrouter', surveyAnswers('roof'))),
    })

    await store.start()

    expect(store.record?.damage?.findings).toEqual([])
    expect(store.record?.damage?.notAssessed?.reason).toMatch(/roof/)
  })

  it('takes nothing from the door set when its own coverage says the door end is not inspectable', async () => {
    const answers = dentedDoors()
    answers.door_end_coverage = { type: 'choice', value: 'not_inspectable' }
    const { store } = run('luna', { door: () => json(replyBody('openai', answers)) })

    await store.start()

    expect(store.record?.damage?.findings).toEqual([])
    expect(store.record?.damage?.notAssessed?.reason).toMatch(/door end is not inspectable/)
  })
})
