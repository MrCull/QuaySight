import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas. A fake photo is a blob whose text is its size; a fake JPEG's
// text is "jpeg <w>x<h>", and a fake crop's is "jpeg <w>x<h> from <region w>x<region h> at <x>,<y>".
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { buildInspectionExport } from '../../domain/exports'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'
import { idCropRead } from '../../plan/requests/idCropRead'
import { regions } from '../../plan/requests/regions'

const KEY = 'test-only-openrouter-key-0000'
// The box Jev latest gives for COYU 266813 0 on the 1079 x 1080 photo, 16 Oct 2026. Still asked, to show the
// enlarged close-up; the zoomed read no longer starts from it.
const COYU_BOX = { top: 0.1, bottom: 0.14, left: 0.61, right: 0.79 }
// The numbered regions name marks 3 and 4 (top row, right half) for the ID. That area (x 0.5 to 1, y 0 to 0.25)
// with a 0.25 margin, cut from the 1079 x 1080 photo and scaled to Jev's 1,568 px side.
const COYU_MARKS = { id_mark: '3', id_mark_2: '4' }
const COYU_CROP = 'jpeg 1568x940 from 675x405 at 404,0'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * An OpenRouter Jev answer set reading `id`, each character at `p` unless `at` says otherwise
 * (position → [character, probability]), with a box when given.
 */
function jevBody(
  id: string,
  options: {
    p?: number
    at?: Record<number, [string, number]>
    box?: { top: number; bottom: number; left: number; right: number } | null
    boxConfidence?: number
  } = {},
) {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    const [choice, p] = options.at?.[i + 1] ?? [ch, options.p ?? 0.99]
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice,
      probabilities: { [choice]: p, unreadable: Number((1 - p).toFixed(2)) },
      confidence: p,
    }
  })
  answers.full_number_visible = { type: 'noul', noul: 0.95 }
  if (options.box) {
    answers.container_box = {
      type: 'box',
      box: options.box,
      confidence: options.boxConfidence ?? 0.77,
    }
  }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1844, output_tokens: 75, cost: 0.0001 },
  }
}

/** An OpenRouter reply to the numbered-regions request naming these marks (name → mark); the rest are none. */
function regionsBody(marks: Record<string, string> = COYU_MARKS, p = 0.8) {
  const answers: Record<string, unknown> = {}
  for (const [name, mark] of Object.entries(marks)) {
    answers[name] = { type: 'choice', choice: mark, probabilities: { [mark]: p }, confidence: p }
  }
  return { model: 'typesafe/jev-1.14-20261014', answers, usage: { input_tokens: 1800, output_tokens: 60, cost: 0.0001 } }
}

interface Held {
  release: (response: Response) => void
  signal: AbortSignal | null
}

type Kind = 'regions' | 'full' | 'crop'

/**
 * Fetch at the network edge, routed by what each call asks: the full-photo read asks where the ID is,
 * the crop read does not. A held call answers only when released, and rejects when its signal aborts.
 */
function networkEdge() {
  const held: Record<Kind, Held[]> = { regions: [], full: [], crop: [] }
  const auto = new Map<Kind, () => Response>()
  const calls: { kind: Kind; body: string; signal: AbortSignal | null }[] = []
  const fetchMock = vi.fn<typeof fetch>((_input, init) => {
    const body = String(init?.body)
    const kind: Kind = body.includes('id_mark')
      ? 'regions'
      : body.includes('container_box')
        ? 'full'
        : 'crop'
    calls.push({ kind, body, signal: init?.signal ?? null })
    const reply = auto.get(kind)
    if (reply) return Promise.resolve(reply())
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? null
      signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      )
      held[kind].push({ release: resolve, signal })
    })
  })
  return {
    fetchMock,
    calls,
    answer: (kind: Kind, reply: () => Response) => auto.set(kind, reply),
    held: (kind: Kind) => held[kind],
  }
}

/** The text of the image a request sent: the fake codec's description of it. */
function sentImage(body: string): string {
  const parsed = JSON.parse(body) as { state: [string, { image_url: { url: string } }] }
  const url = parsed.state[1].image_url.url
  return atob(url.slice(url.indexOf(',') + 1))
}

describe('the zoomed read of the container ID, from the numbered regions (Jev)', () => {
  let edge: ReturnType<typeof networkEdge>
  let restoreRequests = () => {}

  beforeEach(() => {
    // This spec covers the ID requests; the damage request has its own spec.
    restoreRequests = onlyRequests(survey, regions, idRecheck, idCropRead)
    setActivePinia(createPinia())
    edge = networkEdge()
    edge.answer('regions', () => json(regionsBody()))
    vi.stubGlobal('fetch', edge.fetchMock)
  })

  afterEach(() => {
    restoreRequests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function liveStore(model = '~typesafe/jev-latest') {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel(model)
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'rear-door-coyu-22g1.jpg',
      url: 'blob:original',
      orientation: 'square',
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    return store
  }

  it('re-reads the ID from a crop around the box, scaled up within the model limits, after the full-photo read answers', async () => {
    edge.answer('full', () => json(jevBody('COYU2661130', { box: COYU_BOX })))
    edge.answer('crop', () => json(jevBody('COYU2668130')))
    const store = liveStore()

    await store.start()

    expect(edge.calls.map((c) => c.kind)).toEqual(['full', 'regions', 'crop'])
    expect(sentImage(edge.calls[0]!.body)).toBe('jpeg 1079x1080')
    expect(sentImage(edge.calls[1]!.body)).toBe('jpeg 1079x1080 marked 25')
    expect(sentImage(edge.calls[2]!.body)).toBe(COYU_CROP)
    // The same group-position character questions, without asking for the box again.
    const crop = JSON.parse(edge.calls[2]!.body) as {
      model: string
      questions: Record<string, { instructions: string }>
    }
    expect(crop.model).toBe('~typesafe/jev-latest')
    expect(crop.questions.id_char_08?.instructions).toContain(
      'Read only the fourth digit of the six-digit group',
    )
    expect(crop.questions.container_box).toBeUndefined()
    for (const [input, init] of edge.fetchMock.mock.calls) {
      expect(String(input)).toBe('https://openrouter.ai/api/alpha/decisions')
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`)
    }
  })

  it('combines the two readings into one: the more confident character wins and the disagreement is recorded', async () => {
    edge.answer('full', () =>
      json(jevBody('COYU2668130', { at: { 8: ['1', 0.62] }, box: COYU_BOX })),
    )
    edge.answer('crop', () => json(jevBody('COYU2668130')))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('complete')
    expect(store.record?.containerId).toMatchObject({
      value: 'COYU2668130',
      certainty: 'Confident',
      checkDigitValid: true,
    })
    expect(store.record?.idCropRead).toMatchObject({
      outcome: 'combined',
      marks: [3, 4],
      crop: { x: 404, y: 0, width: 675, height: 405, sentWidth: 1568, sentHeight: 940 },
      disagreements: [
        {
          position: 8,
          full: { value: '1', certainty: 'Likely' },
          crop: { value: '8', certainty: 'Confident' },
          kept: 'crop',
        },
      ],
    })
    // The disagreement goes in the export, not on screen.
    expect(buildInspectionExport(store.record!).idCropRead?.disagreements).toHaveLength(1)
    expect(store.record?.rawResponses.map((r) => r.passId)).toEqual([
      `${store.record?.id}-read`,
      `${store.record?.id}-regions`,
      `${store.record?.id}-crop`,
    ])
  })

  it('keeps the box on the ID reading, after the crop read combines its readings too', async () => {
    edge.answer('full', () => json(jevBody('COYU2661130', { box: COYU_BOX })))
    edge.answer('crop', () => json(jevBody('COYU2668130')))
    const store = liveStore()

    await store.start()

    expect(store.record?.containerId?.box).toEqual({ ...COYU_BOX, confidence: 0.77 })
  })

  it('carries no box on the ID reading when none was usable', async () => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX, boxConfidence: 0.3 })))
    edge.answer('crop', () => json(jevBody('COYU2668130')))
    const store = liveStore()

    await store.start()

    expect(store.record?.containerId).not.toHaveProperty('box')
  })

  it('records the crop read as its own ledger line, with its own reported cost', async () => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX })))
    edge.answer('crop', () => json(jevBody('COYU2668130')))
    const store = liveStore()

    await store.start()

    const lines = useLedgerStore().entries()
    expect(lines.map((l) => [l.id, l.purpose, l.status, l.costUsd])).toEqual([
      [`${store.record?.id}-read`, 'Reading markings', 'complete', 0.0001],
      [`${store.record?.id}-regions`, 'Locating the markings', 'complete', 0.0001],
      [`${store.record?.id}-crop`, 'Reading the ID up close', 'complete', 0.0001],
    ])
  })

  it.each([
    ['no mark for the ID', { id_mark: 'none' }, 0.9],
    ['a mark the model is barely sure of', COYU_MARKS, 0.05],
  ])('makes no zoomed read when the regions give %s', async (_case, marks, p) => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX })))
    edge.answer('regions', () => json(regionsBody(marks, p)))
    const store = liveStore()

    await store.start()

    expect(edge.calls.map((c) => c.kind)).toEqual(['full', 'regions'])
    expect(store.record?.containerId?.value).toBe('COYU2668130')
    expect(store.record?.idCropRead).toBeUndefined()
  })

  it('makes no zoomed read when the regions request fails, and the result stays complete', async () => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX })))
    edge.answer('regions', () => json({ error: { message: 'Upstream error' } }, 502))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(edge.calls.map((c) => c.kind)).toEqual(['full', 'regions'])
    expect(store.record?.regions).toMatchObject({ outcome: 'failed', found: null })
    expect(store.record?.containerId?.value).toBe('COYU2668130')
  })

  it('asks the numbered regions on Jev 1.13 too, where no box question is taken', async () => {
    edge.fetchMock.mockImplementation((_input, init) => {
      const body = String(init?.body)
      return Promise.resolve(json(body.includes('id_mark') ? regionsBody() : jevBody('COYU2668130')))
    })
    const store = liveStore('typesafe/jev-1.13')

    await store.start()

    const bodies = edge.fetchMock.mock.calls.map((c) => String(c[1]?.body))
    expect(bodies.filter((b) => b.includes('container_box'))).toHaveLength(0)
    expect(bodies.some((b) => b.includes('id_mark'))).toBe(true)
    expect(store.record?.idCropRead).toMatchObject({ outcome: 'combined', marks: [3, 4] })
  })

  it('keeps the full-photo reading, and a complete result, when the crop read fails', async () => {
    edge.answer('full', () => json(jevBody('COYU2661130', { box: COYU_BOX })))
    edge.answer('crop', () => json({ error: { message: 'Upstream error' } }, 502))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('COYU2661130')
    expect(store.record?.idCropRead).toMatchObject({ outcome: 'failed', disagreements: [] })
    expect(
      useLedgerStore()
        .entries()
        .map((l) => l.status),
    ).toEqual(['complete', 'complete', 'failed'])
  })

  it('aborts the crop read in flight on Cancel and keeps the full-photo reading', async () => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX })))
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.held('crop')).toHaveLength(1))
    store.cancel()
    await run

    expect(edge.held('crop')[0]!.signal?.aborted).toBe(true)
    expect(store.record?.containerId?.value).toBe('COYU2668130')
    expect(store.record?.status).toBe('partial')
    expect(store.record?.idCropRead).toMatchObject({ outcome: 'cancelled' })
    const crop = useLedgerStore()
      .entries()
      .find((l) => l.purpose === 'Reading the ID up close')
    expect(crop).toMatchObject({ status: 'cancelled', costUsd: null })
  })

  it('makes no crop request when the per-inspection request cap is already reached', async () => {
    edge.answer('full', () => json(jevBody('COYU2668130', { box: COYU_BOX })))
    const store = liveStore()
    vi.spyOn(useLedgerStore().ledger, 'capStatus')
      .mockReturnValueOnce({ allowed: true })
      .mockReturnValueOnce({ allowed: true })
      .mockReturnValueOnce({ allowed: false, reason: 'requests' })

    await store.start()

    expect(edge.calls.map((c) => c.kind)).toEqual(['full', 'regions'])
    expect(store.record?.containerId?.value).toBe('COYU2668130')
    expect(store.record?.idCropRead).toMatchObject({ outcome: 'skipped-cap', reason: 'requests' })
  })
})
