import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { onlyRequests, planRequests } from '../../plan/registry'
import { planFor } from '../../plan/requestPlan'
import { planForPhoto } from '../../plan/photoPlan'
import { survey } from '../../plan/requests/survey'
import {
  sideDamage,
  sideDamageFirstHalf,
  sideDamageSecondHalf,
} from '../../plan/requests/sideDamage'
import { findModel, labelsFor } from '../../domain/providers'
import { SIDE_DAMAGE_SET } from '../../domain/sideDamage'

// Liquid d1.2-ultra through the store, with fetch stubbed at the network edge. What differs from Jev:
// the model takes 128 questions a request, so the 132-question side set goes in two requests whose answers
// fold into one reading; and its ID questions name a digit's place from the left only.

const KEY = 'test-only-openrouter-key-0000'
const LIQUID = 'liquid/d1.2-ultra'
const ID = 'APHU6586847'

type Answer =
  | { type: 'predicate'; p: number }
  | { type: 'choice'; value: string; p?: number }
  | { type: 'score'; probabilities: number[] }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function liquidBody(answers: Record<string, Answer>) {
  return {
    model: 'liquid/d1.2-ultra-20261116',
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
    usage: { input_tokens: 4727, output_tokens: 0, cost: 0.0002 },
  }
}

function surveyAnswers(): Record<string, Answer> {
  const answers: Record<string, Answer> = {}
  ID.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = { type: 'choice', value: ch, p: 0.98 }
  })
  answers.photo_face = { type: 'choice', value: 'long_side', p: 0.96 }
  return answers
}

/** Answers for every side question: a dent across Z2B and Z3B, every zone seen. */
function dentedSide(): Record<string, Answer> {
  const answers: Record<string, Answer> = {}
  for (const q of SIDE_DAMAGE_SET.questions) {
    answers[q.name] =
      q.type === 'predicate'
        ? { type: 'predicate', p: 0.03 }
        : q.type === 'score'
          ? { type: 'score', probabilities: [0.94, 0.04, 0.01, 0.005, 0.005] }
          : q.type === 'choice'
            ? { type: 'choice', value: q.choices[0]!.value }
            : { type: 'predicate', p: 0.03 }
  }
  Object.assign(answers, {
    image_quality: { type: 'choice', value: 'good' },
    side_panel_coverage: { type: 'choice', value: 'most' },
    door_end_in_image: { type: 'choice', value: 'not_identifiable' },
    potentially_significant_damage: { type: 'predicate', p: 0.82 },
  })
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

interface Sent {
  state: unknown[]
  questions: Record<string, { type: string; instructions: string }>
}

describe('Liquid d1.2-ultra on a live run', () => {
  let restore: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    restore = onlyRequests(survey, sideDamage, sideDamageFirstHalf, sideDamageSecondHalf)
  })

  afterEach(() => {
    restore()
    vi.unstubAllGlobals()
  })

  /** `failSecond`: the second side request answers 502. */
  function run(options: { failFirst?: boolean; failSecond?: boolean } = {}) {
    const sideCalls: Sent[] = []
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Sent & { model: string }
      if ('photo_face' in body.questions) return json(liquidBody(surveyAnswers()))
      sideCalls.push(body)
      const failing = sideCalls.length === 1 ? options.failFirst : options.failSecond
      if (failing) return json({ error: { message: 'Upstream error', code: 502 } }, 502)
      const all = dentedSide()
      return json(
        liquidBody(Object.fromEntries(Object.keys(body.questions).map((n) => [n, all[n]!]))),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel(LIQUID)
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'side-dented-grey.jpg',
      url: 'blob:side',
      orientation: 'landscape',
      file: new Blob(['1600x1200'], { type: 'image/jpeg' }),
    })
    return { store, fetchMock, sideCalls }
  }

  it('sends the side set in two requests (128 questions, then the last 4), with the same photo and instructions, and reads one damage result', async () => {
    const { store, sideCalls } = run()

    await store.start()

    expect(sideCalls).toHaveLength(2)
    expect(sideCalls.map((c) => Object.keys(c.questions).length)).toEqual([128, 4])
    expect(sideCalls[0]!.state).toEqual(sideCalls[1]!.state)
    expect(sideCalls.flatMap((c) => Object.keys(c.questions))).toEqual(
      SIDE_DAMAGE_SET.questions.map((q) => q.name),
    )
    expect(sideCalls.every((c) => Object.values(c.questions).every((q) => q.type !== 'box'))).toBe(
      true,
    )

    const damage = store.record?.damage
    expect(damage?.findings.map((f) => f.component)).toEqual(['panel', 'panel'])
    expect(damage?.findings.map((f) => f.zone)).toEqual([
      { u0: 0.2, u1: 0.4, v0: 0.5, v1: 1 },
      { u0: 0.4, u1: 0.6, v0: 0.5, v1: 1 },
    ])
    expect(damage).toMatchObject({
      imageQuality: 'good',
      coverage: 'most',
      significantProbability: 0.82,
    })
    expect(store.record?.status).toBe('complete')
  })

  it('starts the second side request after the first, and gives each its own ledger line and raw response', async () => {
    const { store, fetchMock } = run()

    await store.start()

    const id = store.record!.id
    const lines = useLedgerStore().entries()
    expect(lines.map((l) => l.id)).toEqual(
      expect.arrayContaining([`${id}-side-damage-a`, `${id}-side-damage-b`]),
    )
    expect(lines.filter((l) => l.purpose === 'Checking the long side for damage')).toHaveLength(2)
    expect(lines.every((l) => l.costUsd === 0.0002)).toBe(true)
    expect(store.record?.rawResponses.map((r) => r.passId)).toEqual(
      expect.arrayContaining([`${id}-side-damage-a`, `${id}-side-damage-b`]),
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(store.record?.resolvedVersion).toBe('liquid/d1.2-ultra-20261116')
  })

  it('keeps the zones the first request answered when the second fails, and leaves the rail, post and casting checks unread', async () => {
    const { store } = run({ failSecond: true })

    await store.start()

    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.status).toBe('partial')
    expect(store.record?.failures?.map((f) => f.requestId)).toEqual(['side-damage-b'])
    expect(store.record?.damage?.findings.map((f) => f.component)).toEqual(['panel', 'panel'])
    expect(store.record?.damage?.zones?.every((z) => z.visibility === 'clear')).toBe(true)
  })

  it('keeps the last four checks when the first request fails, and reads no zone as clear', async () => {
    const { store } = run({ failFirst: true })

    await store.start()

    expect(store.record?.containerId?.value).toBe(ID)
    expect(store.record?.status).toBe('partial')
    expect(store.record?.failures?.map((f) => f.requestId)).toEqual(['side-damage-a'])
    const damage = store.record?.damage
    expect(damage).not.toBeNull()
    // A zone the failed request never answered has no visibility reading: unread, never "clear".
    expect(damage?.zones?.every((z) => z.visibility === null)).toBe(true)
    expect(damage?.findings ?? []).toEqual([])
  })

  it('names a digit’s place from the left only in the ID questions', async () => {
    const { store, fetchMock } = run()

    await store.start()

    const read = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String(init?.body)) as Sent)
      .find((b) => 'id_char_07' in b.questions)!
    expect(read.questions.id_char_07!.instructions).toContain(
      'third digit of the six-digit group, counting from its left-hand end',
    )
    expect(read.questions.id_char_07!.instructions).not.toContain('right-hand end')
    expect('container_box' in read.questions).toBe(false)
  })
})

describe('the request plan on Liquid d1.2-ultra', () => {
  const route = (model: string) => {
    const entry = findModel('openrouter', model)!
    return {
      provider: 'openrouter' as const,
      model,
      entry,
      endpoint: 'decisions',
      describe: { name: labelsFor('openrouter', model).model, maxSide: entry.photoLimits.maxSide },
    }
  }
  const ids = (model: string, several: boolean) =>
    planForPhoto(planRequests(), route(model), several).map((r) => r.id)

  it('asks the side set in two halves on Liquid and in one request on Jev', () => {
    for (const several of [false, true]) {
      expect(ids(LIQUID, several)).toEqual(
        expect.arrayContaining(['side-damage-a', 'side-damage-b']),
      )
      expect(ids(LIQUID, several)).not.toContain('side-damage')
      expect(ids('~typesafe/jev-latest', several)).toContain('side-damage')
      expect(ids('~typesafe/jev-latest', several)).not.toContain('side-damage-a')
    }
    expect(planFor(planRequests(), route('typesafe/jev-1.14')).map((r) => r.id)).not.toContain(
      'side-damage-b',
    )
  })

  it('leaves the other requests as they are', () => {
    const rest = (model: string) => ids(model, false).filter((id) => !id.startsWith('side-damage'))
    expect(rest(LIQUID)).toEqual(rest('~typesafe/jev-latest'))
  })
})
