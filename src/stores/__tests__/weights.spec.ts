import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { buildInspectionExport } from '../../domain/exports'
import { onlyRequests } from '../../plan/registry'
import { idRecheck } from '../../plan/requests/idRecheck'
import { survey } from '../../plan/requests/survey'
import { weightCheck } from '../../plan/requests/weightCheck'
import {
  COYU_WEIGHTS,
  openAiChoiceReply,
  openRouterChoiceReply,
  weightChoices,
  type PrintedFigures,
} from '../../__tests__/weightReplies'
import {
  jsonResponse as json,
  openAiSurveyReply,
  openRouterSurveyReply,
  type SurveyChoice,
} from '../../__tests__/surveyReplies'

// The weights (spec #27, ticket #34): read in the survey in both kg and lb, compared after conversion,
// and, when they disagree, looked at again once. These tests drive the store with fetch at the network
// edge and check what was sent, what the record says and what the ledger shows.

const OPENAI_KEY = 'test-only-openai-key-0000'
const OPENROUTER_KEY = 'test-only-openrouter-key-0000'
const COYU = 'COYU2668130'

/** Everything the survey asks that is not the weights: a clean 22G1 reading. */
const DETAILS: Record<string, SurveyChoice> = {
  size_type_code: [['22G1', 0.95]],
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

// The weight block on the COYU door, as Jev's box for it, and that box cut from the 1079 x 1080 photo.
const WEIGHT_BOX = { top: 0.4, bottom: 0.62, left: 0.5, right: 0.95 }

type Kind = 'survey' | 'id-crop' | 'weights'

/** Fetch routed by what each call asks; every call is recorded. A route not set answers 500. */
function networkEdge() {
  const routes = new Map<Kind, () => Response | Promise<Response>>()
  const calls: { kind: Kind; body: string }[] = []
  const fetchMock = vi.fn<typeof fetch>((_input, init) => {
    const body = String(init?.body)
    const kind: Kind = body.includes('size_type_code')
      ? 'survey'
      : body.includes('id_char_01')
        ? 'id-crop'
        : 'weights'
    calls.push({ kind, body })
    return Promise.resolve(routes.get(kind)?.() ?? json({ error: 'unrouted' }, 500))
  })
  return {
    fetchMock,
    calls,
    on: (kind: Kind, reply: () => Response | Promise<Response>) => routes.set(kind, reply),
    count: (kind: Kind) => calls.filter((c) => c.kind === kind).length,
    last: (kind: Kind) => calls.filter((c) => c.kind === kind).reverse()[0]!.body,
  }
}

/** The names a request asked, on either wire format. */
function askedNames(body: string): string[] {
  const parsed = JSON.parse(body) as { questions: { name: string }[] | Record<string, unknown> }
  return Array.isArray(parsed.questions)
    ? parsed.questions.map((q) => q.name)
    : Object.keys(parsed.questions)
}

/** The text of the image a request sent: the fake codec's description of it. */
function sentImage(body: string): string {
  const parsed = JSON.parse(body) as {
    state?: [string, { image_url: { url: string } }]
    input?: { content: { type: string; image_url?: string }[] }[]
  }
  const url =
    parsed.state?.[1].image_url.url ??
    parsed.input?.[0]?.content.find((c) => c.type === 'input_image')?.image_url ??
    ''
  return atob(url.slice(url.indexOf(',') + 1))
}

function withTare(tare: { kg: string; lb: string }): PrintedFigures {
  return { ...COYU_WEIGHTS, tare }
}

describe('the weights are read in the survey, in both units', () => {
  let edge: ReturnType<typeof networkEdge>
  let restoreRequests: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    // The damage requests are other tickets' business: keep them out of the fetch counts.
    restoreRequests = onlyRequests(survey, idRecheck, weightCheck)
    edge = networkEdge()
    vi.stubGlobal('fetch', edge.fetchMock)
  })

  afterEach(() => {
    restoreRequests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function photo(store: ReturnType<typeof useInspectionStore>) {
    store.setPhoto({
      name: 'coyu.jpg',
      url: 'blob:coyu',
      orientation: 'square',
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
  }
  function lunaStore() {
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(OPENAI_KEY)
    photo(store)
    return store
  }
  function jevStore() {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('~typesafe/jev-latest')
    store.setApiKey(OPENROUTER_KEY)
    photo(store)
    return store
  }

  /** The survey reply on Luna: the ID, the details and these printed weights. */
  const lunaSurvey = (figures: PrintedFigures) => () =>
    json(openAiSurveyReply(COYU, { details: { ...DETAILS, ...weightChoices(figures) } }))
  const jevSurvey =
    (figures: PrintedFigures, box = true) =>
    () => {
      const reply = openRouterSurveyReply(COYU, {
        details: { ...DETAILS, ...weightChoices(figures) },
        box,
      })
      const answers = reply.answers as Record<string, unknown>
      if (box) answers.weights_box = { type: 'box', box: WEIGHT_BOX, confidence: 0.8 }
      return json(reply)
    }

  it('asks every digit of every figure in the one survey request, within OpenAI limits', async () => {
    edge.on('survey', lunaSurvey(COYU_WEIGHTS))

    await lunaStore().start()

    expect(edge.fetchMock).toHaveBeenCalledTimes(1)
    const names = askedNames(edge.last('survey'))
    // 11 ID characters, 11 details, 37 weight digits.
    expect(names).toEqual(
      expect.arrayContaining([
        'max_gross_kg_thousands',
        'max_gross_lb_ten_thousands',
        'tare_kg_units',
        'tare_lb_hundreds',
        'payload_kg_tens',
        'payload_lb_units',
        'capacity_m3_tenths',
        'capacity_cuft_thousands',
      ]),
    )
    expect(names.filter((n) => /^(max_gross|tare|payload|capacity)_/.test(n))).toHaveLength(37)
    expect(names.length).toBeLessThanOrEqual(200)
    // The weights are not a second request: one ledger line for the survey.
    expect(useLedgerStore().entries()).toHaveLength(1)
  })

  it('reads COYU 30,480 kg / 67,200 lb, 2,180 / 4,810, 28,300 / 62,390 and 33.2 m3 / 1,173 cu ft, in agreement', async () => {
    edge.on('survey', lunaSurvey(COYU_WEIGHTS))
    const store = lunaStore()

    await store.start()

    const w = store.record!.weights!
    expect(w.maxGross).toMatchObject({ valueKg: 30480, valueLb: 67200, units: 'agree' })
    expect(w.tare).toMatchObject({ valueKg: 2180, valueLb: 4810, units: 'agree' })
    expect(w.printedPayload).toMatchObject({ valueKg: 28300, valueLb: 62390, units: 'agree' })
    expect(w.payload).toMatchObject({ valueKg: 28300, valueLb: 62390, provenance: 'calculated' })
    expect(w.capacity).toMatchObject({ valueM3: 33.2, valueCuFt: 1173, units: 'agree' })
    expect(w.maxGross?.certainty).toBe('Confident')
    expect(w.conflict).toBeNull()
    expect(store.record!.status).toBe('complete')
    expect(edge.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reads the weights on Jev the same way, and asks where the weight block is', async () => {
    edge.on('survey', jevSurvey(COYU_WEIGHTS))
    edge.on('id-crop', () => json(openRouterSurveyReply(COYU)))
    const store = jevStore()

    await store.start()

    expect(askedNames(edge.last('survey'))).toContain('weights_box')
    expect(store.record!.weights?.maxGross).toMatchObject({ valueKg: 30480, valueLb: 67200 })
    expect(store.record!.weights?.capacity).toMatchObject({ valueM3: 33.2, valueCuFt: 1173 })
  })

  it('looks at a weight whose kg and lb disagree again, once, with just that weight asked', async () => {
    edge.on('survey', lunaSurvey(withTare({ kg: '2,180', lb: '4,610' })))
    edge.on('weights', () =>
      json(openAiChoiceReply(weightChoices({ tare: { kg: '2,180', lb: '4,810' } }))),
    )
    const store = lunaStore()

    await store.start()

    expect(edge.count('weights')).toBe(1)
    expect(edge.fetchMock).toHaveBeenCalledTimes(2)
    const names = askedNames(edge.last('weights'))
    expect(names).toHaveLength(10)
    expect(names.every((n) => n.startsWith('tare_'))).toBe(true)

    const tare = store.record!.weights!.tare!
    expect(tare).toMatchObject({
      valueKg: 2180,
      valueLb: 4810,
      units: 'agree',
      certainty: 'Confident',
    })
    expect(store.record!.weights!.reread).toBe('settled')
    expect(store.record!.status).toBe('complete')
    // Its own ledger line, plain words.
    const lines = useLedgerStore().entries()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.purpose)).toContain('Checking the weights')
  })

  it('shows Uncertain with both readings when the disagreement persists, and asks no third time', async () => {
    edge.on('survey', lunaSurvey(withTare({ kg: '2,180', lb: '4,610' })))
    edge.on('weights', () =>
      json(openAiChoiceReply(weightChoices({ tare: { kg: '2,180', lb: '4,710' } }))),
    )
    const store = lunaStore()

    await store.start()

    expect(edge.count('weights')).toBe(1)
    const w = store.record!.weights!
    expect(w.tare).toMatchObject({
      units: 'conflict',
      certainty: 'Uncertain',
      printed: { kg: 2180, lb: 4710 },
    })
    expect(w.reread).toBe('still-disagrees')
    expect(store.record!.status).toBe('complete')
  })

  it('keeps the first readings, Uncertain, when the second look fails, and the result stays complete', async () => {
    edge.on('survey', lunaSurvey(withTare({ kg: '2,180', lb: '4,610' })))
    edge.on('weights', () => json({ error: { message: 'boom' } }, 500))
    const store = lunaStore()

    await store.start()

    const w = store.record!.weights!
    expect(w.tare).toMatchObject({
      units: 'conflict',
      certainty: 'Uncertain',
      printed: { kg: 2180, lb: 4610 },
    })
    expect(w.reread).toBe('failed')
    expect(store.record!.status).toBe('complete')
  })

  it('looks at max gross, tare and payload again when printed and calculated payload conflict', async () => {
    edge.on('survey', lunaSurvey({ ...COYU_WEIGHTS, payload: { kg: '28,350', lb: '62,500' } }))
    edge.on('weights', () => json(openAiChoiceReply(weightChoices(COYU_WEIGHTS))))
    const store = lunaStore()

    await store.start()

    expect(edge.count('weights')).toBe(1)
    const names = askedNames(edge.last('weights'))
    expect(names).toHaveLength(30)
    expect(names.some((n) => n.startsWith('capacity_'))).toBe(false)
    const w = store.record!.weights!
    expect(w.payloadConflict).toBeNull()
    expect(w.printedPayload).toMatchObject({ valueKg: 28300, units: 'agree' })
    expect(w.reread).toBe('settled')
  })

  it('flags a payload conflict that the second look does not settle, with the three weights Uncertain', async () => {
    const conflicting = { ...COYU_WEIGHTS, payload: { kg: '28,350', lb: '62,500' } }
    edge.on('survey', lunaSurvey(conflicting))
    edge.on('weights', () => json(openAiChoiceReply(weightChoices(conflicting))))
    const store = lunaStore()

    await store.start()

    const w = store.record!.weights!
    expect(w.payloadConflict).toMatchObject({
      kind: 'differs',
      printedKg: 28350,
      calculatedKg: 28300,
    })
    expect(w.payload?.certainty).toBe('Uncertain')
    expect(w.reread).toBe('still-disagrees')
    expect(w.conflict).toMatch(/28,350 kg/)
  })

  it('asks nothing again when the readings agree, or when a unit was not read at all', async () => {
    edge.on(
      'survey',
      lunaSurvey({ ...COYU_WEIGHTS, tare: { kg: '2,180' }, capacity: { m3: '33.2' } }),
    )
    const store = lunaStore()

    await store.start()

    expect(edge.fetchMock).toHaveBeenCalledTimes(1)
    expect(store.record!.weights!.tare).toMatchObject({
      valueKg: 2180,
      valueLb: 4806,
      printed: { kg: 2180, lb: null },
    })
    expect(store.record!.weights!.reread).toBeUndefined()
  })

  it('crops the second look to the weight block when the model gave a box for it', async () => {
    edge.on('survey', jevSurvey(withTare({ kg: '2,180', lb: '4,610' })))
    edge.on('weights', () =>
      json(openRouterChoiceReply(weightChoices({ tare: { kg: '2,180', lb: '4,810' } }))),
    )
    const store = jevStore()

    await store.start()

    expect(edge.count('weights')).toBe(1)
    expect(sentImage(edge.last('weights'))).toMatch(/^jpeg \d+x\d+ from \d+x\d+ at \d+,\d+$/)
    expect(askedNames(edge.last('weights'))).not.toContain('weights_box')
    expect(store.record!.weights!.tare).toMatchObject({ units: 'agree' })
    // The whole run: the survey and the weights look: two ledger lines, none blocked.
    const lines = useLedgerStore().entries()
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.status === 'complete')).toBe(true)
  })

  it('sends the second look on the whole photo when there is no usable box for the weights', async () => {
    edge.on('survey', jevSurvey(withTare({ kg: '2,180', lb: '4,610' }), false))
    edge.on('weights', () =>
      json(openRouterChoiceReply(weightChoices({ tare: { kg: '2,180', lb: '4,810' } }))),
    )
    const store = jevStore()

    await store.start()

    expect(edge.count('weights')).toBe(1)
    expect(sentImage(edge.last('weights'))).not.toMatch(/ from /)
    expect(store.record!.weights!.tare).toMatchObject({ units: 'agree' })
  })

  it('keeps both units in the exports whatever the display units are', async () => {
    edge.on('survey', lunaSurvey(COYU_WEIGHTS))
    const store = lunaStore()
    await store.start()

    const exported = buildInspectionExport(store.record!)
    const value = (field: string) => exported.values.find((v) => v.field === field)
    expect(value('maxGross')).toMatchObject({ value: 30480, unit: 'kg', provenance: 'printed' })
    expect(value('maxGross.lb')).toMatchObject({ value: 67200, unit: 'lb', provenance: 'printed' })
    expect(value('maxGross.lb')?.uncertainty).toMatch(/kg and lb agree/)
    expect(value('tare.lb')).toMatchObject({ value: 4810, unit: 'lb' })
    expect(value('payload.printed')).toMatchObject({ value: 28300, unit: 'kg' })
    expect(value('payload.printed.lb')).toMatchObject({ value: 62390, unit: 'lb' })
    expect(value('payload')).toMatchObject({ value: 28300, provenance: 'calculated' })
    expect(value('payload.lb')).toMatchObject({ value: 62390, provenance: 'calculated' })
    expect(value('capacity')).toMatchObject({ value: 33.2, unit: 'm3' })
    expect(value('capacity.cuFt')).toMatchObject({ value: 1173, unit: 'cu ft' })
    expect(exported.conflicts).toEqual([])
    expect(exported.unresolved.map((u) => u.field)).not.toEqual(
      expect.arrayContaining(['maxGross']),
    )
  })
})
