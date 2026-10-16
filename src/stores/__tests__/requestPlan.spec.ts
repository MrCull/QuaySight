import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import { useSetupStore } from '../setup'
import type { PlanRequest } from '../../plan/requestPlan'
import { registerRequest } from '../../plan/registry'
import { readId } from '../../plan/requests/readId'
import { askDecisions } from '../../services/askDecisions'

// A test-only part of the record, added the way a request module adds its own (no edit to the record type).
declare module '../../domain/inspection' {
  interface InspectionRecord {
    testSeal?: { seal: number; idSeen: string | null }
  }
}

const KEY = 'test-only-openrouter-key-0000'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenRouter Jev answer set reading the given ID. */
function jevBody(id = 'APHU6586847') {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: 0.97, unreadable: 0.03 },
      confidence: 0.94,
    }
  })
  answers.full_number_visible = { type: 'noul', noul: 0.96 }
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1844, output_tokens: 75, cost: 0.000077448 },
  }
}

/** The test-only request's answer: one noul, in OpenRouter's shape. */
const sealBody = (noul = 0.91) => ({
  model: 'typesafe/jev-1.14-20261014',
  answers: { test_seal_visible: { type: 'noul', noul } },
  usage: { input_tokens: 900, output_tokens: 5, cost: 0.00004 },
})

/**
 * A request a later ticket could add from its own module: a question builder, an answer mapper, a
 * stage and the record field it fills. Nothing in the store names it.
 */
function sealRequest(
  overrides: Partial<PlanRequest<{ seal: number; idSeen: string | null }>> = {},
) {
  const request: PlanRequest<{ seal: number; idSeen: string | null }> = {
    id: 'test-seal',
    purpose: 'Test seal check',
    stages: ['details'],
    send: (ctx) =>
      askDecisions(ctx, {
        build: ({ route, imageDataUrl }) => ({
          model: route.model,
          state: [{ type: 'image_url', image_url: { url: imageDataUrl } }],
          questions: {
            test_seal_visible: {
              type: 'noul',
              instructions: 'Is a customs seal visible?',
              // A dependent request can build on its prerequisite's answer.
              context: ctx.answer(readId)?.containerId.value ?? null,
            },
          },
        }),
        map: (raw) => {
          const answers = (raw as { answers: { test_seal_visible: { noul: number } } }).answers
          return {
            seal: answers.test_seal_visible.noul,
            idSeen: ctx.answer(readId)?.containerId.value ?? null,
          }
        },
      }),
    apply: (record, outcome) =>
      outcome.status === 'answered' ? { ...record, testSeal: outcome.answer } : record,
    ...overrides,
  }
  return request
}

interface Held {
  release: (response: Response) => void
  signal: AbortSignal | null
}

/**
 * Fetch at the network edge. Each call is routed by what it asks: the seal question or the ID.
 * A held call answers only when released, and rejects as a real fetch does when its signal aborts.
 */
function networkEdge() {
  const held = new Map<'seal' | 'id', Held[]>([
    ['seal', []],
    ['id', []],
  ])
  const auto = new Map<'seal' | 'id', () => Response>()
  const order: ('seal' | 'id')[] = []
  const fetchMock = vi.fn<typeof fetch>((_input, init) => {
    const kind = String(init?.body).includes('test_seal_visible') ? 'seal' : 'id'
    order.push(kind)
    const reply = auto.get(kind)
    if (reply) return Promise.resolve(reply())
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? null
      signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      )
      held.get(kind)!.push({ release: resolve, signal })
    })
  })
  return {
    fetchMock,
    order,
    answer: (kind: 'seal' | 'id', reply: () => Response) => auto.set(kind, reply),
    held: (kind: 'seal' | 'id') => held.get(kind)!,
  }
}

/** Lets pending promise chains run (photo preparation, the plan, the ledger). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a live run as a request plan', () => {
  let edge: ReturnType<typeof networkEdge>
  let unregister: (() => void)[]

  beforeEach(() => {
    setActivePinia(createPinia())
    edge = networkEdge()
    vi.stubGlobal('fetch', edge.fetchMock)
    unregister = []
  })

  afterEach(() => {
    unregister.forEach((undo) => undo())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function liveStore() {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'rear.jpg',
      url: 'blob:original',
      orientation: 'portrait',
      file: new Blob(['1536x2048'], { type: 'image/jpeg' }),
    })
    return store
  }

  function add(request: PlanRequest<never> | PlanRequest<{ seal: number; idSeen: string | null }>) {
    unregister.push(registerRequest(request as PlanRequest))
  }

  it('runs an added request with its own question builder, answer mapper, stage and ledger line', async () => {
    add(sealRequest())
    edge.answer('id', () => json(jevBody()))
    edge.answer('seal', () => json(sealBody(0.91)))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    expect(store.record?.testSeal?.seal).toBe(0.91)
    expect(edge.fetchMock).toHaveBeenCalledTimes(2)
    for (const [input, init] of edge.fetchMock.mock.calls) {
      expect(String(input)).toBe('https://openrouter.ai/api/alpha/decisions')
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`)
    }
    const lines = useLedgerStore().entries()
    expect(lines.map((l) => l.purpose).sort()).toEqual(['Reading markings', 'Test seal check'])
    expect(lines.every((l) => l.status === 'complete' && l.inspectionId === store.record?.id)).toBe(
      true,
    )
    expect(store.record?.rawResponses).toHaveLength(2)
    expect(store.stages.map((s) => [s.id, s.state])).toEqual([
      ['id', 'done'],
      ['details', 'done'],
      ['damage', 'not-in-run'],
    ])
  })

  it('starts independent requests together, before either answers', async () => {
    add(sealRequest())
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.order).toHaveLength(2))
    expect(edge.held('id')).toHaveLength(1)
    expect(edge.held('seal')).toHaveLength(1)
    expect(store.stages.map((s) => s.state)).toEqual(['active', 'active', 'not-in-run'])

    edge.held('seal')[0]!.release(json(sealBody()))
    await vi.waitFor(() => expect(store.stages[1]?.state).toBe('done'))
    // One stage lands while the other is still at work.
    expect(store.stages[0]?.state).toBe('active')
    expect(store.landed('details')).toBe(true)
    expect(store.landed('id')).toBe(false)

    edge.held('id')[0]!.release(json(jevBody()))
    await run
    expect(store.record?.status).toBe('complete')
  })

  it('starts a dependent request only when its prerequisite has answered, with that answer', async () => {
    add(sealRequest({ after: [readId] }))
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.held('id')).toHaveLength(1))
    await settle()
    expect(edge.order).toEqual(['id'])

    edge.held('id')[0]!.release(json(jevBody()))
    await vi.waitFor(() => expect(edge.held('seal')).toHaveLength(1))
    const sealCall = edge.fetchMock.mock.calls[1]![1]!
    expect(String(sealCall.body)).toContain('"context":"APHU6586847"')
    edge.held('seal')[0]!.release(json(sealBody()))
    await run

    expect(store.record?.testSeal).toEqual({ seal: 0.91, idSeen: 'APHU6586847' })
  })

  it('Cancel aborts what is in flight, keeps what arrived and marks the result partial', async () => {
    add(sealRequest())
    edge.answer('id', () => json(jevBody()))
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.held('seal')).toHaveLength(1))
    await vi.waitFor(() => expect(store.stages[0]?.state).toBe('done'))

    store.cancel()
    await run

    expect(edge.held('seal')[0]!.signal?.aborted).toBe(true)
    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('partial')
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    expect(store.record?.testSeal).toBeUndefined()
    expect(store.stages.map((s) => s.state)).toEqual(['done', 'cancelled', 'not-in-run'])

    const lines = useLedgerStore().entries()
    expect(lines.find((l) => l.purpose === 'Test seal check')).toMatchObject({
      status: 'cancelled',
      costUsd: null,
      costState: 'unavailable',
    })
    expect(lines.find((l) => l.purpose === 'Reading markings')?.status).toBe('complete')
    // The aborted call is counted as a request of unknown cost: never free.
    expect(useLedgerStore().inspectionTotals(store.record!.id)).toMatchObject({
      requests: 2,
      incomplete: true,
    })
  })

  it('Cancel before anything answered ends the run cancelled, with no result and every line cancelled', async () => {
    add(sealRequest())
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.order).toHaveLength(2))
    store.cancel()
    await run

    expect(store.status).toBe('cancelled')
    expect(store.record).toBeNull()
    expect(store.errorMessage).toBeNull()
    expect(
      useLedgerStore()
        .entries()
        .map((l) => l.status),
    ).toEqual(['cancelled', 'cancelled'])
    // The photo stays, so the presenter can run it again.
    expect(store.canStart).toBe(true)
  })

  it('New inspection aborts every request in flight, and no late answer lands', async () => {
    add(sealRequest())
    const store = liveStore()

    const run = store.start()
    await vi.waitFor(() => expect(edge.order).toHaveLength(2))
    store.newInspection()
    // The provider answers anyway, too late.
    edge.held('id')[0]!.release(json(jevBody()))
    edge.held('seal')[0]!.release(json(sealBody()))
    await run
    await settle()

    expect([...edge.held('id'), ...edge.held('seal')].every((h) => h.signal?.aborted)).toBe(true)
    expect(store.record).toBeNull()
    expect(store.status).toBe('idle')
    expect(
      useLedgerStore()
        .entries()
        .map((l) => l.status),
    ).toEqual(['cancelled', 'cancelled'])
  })

  it.each([
    ['provider', (setup: ReturnType<typeof useSetupStore>) => setup.chooseProvider('luna')],
    ['model', (setup: ReturnType<typeof useSetupStore>) => setup.chooseModel('typesafe/jev-1.14')],
  ])('a %s change aborts every request in flight', async (_change, choose) => {
    const store = liveStore()
    const run = store.start()
    await vi.waitFor(() => expect(edge.held('id')).toHaveLength(1))

    choose(useSetupStore())
    edge.held('id')[0]!.release(json(jevBody()))
    await run

    expect(edge.held('id')[0]!.signal?.aborted).toBe(true)
    expect(store.record).toBeNull()
    expect(useLedgerStore().entries()[0]?.status).toBe('cancelled')
  })

  it('shows a failed part as that stage failing, and keeps every part that answered', async () => {
    add(sealRequest())
    edge.answer('id', () => json(jevBody()))
    edge.answer('seal', () => json({ error: { message: 'Upstream error' } }, 502))
    const store = liveStore()

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.status).toBe('partial')
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    expect(store.stages.map((s) => s.state)).toEqual(['done', 'failed', 'not-in-run'])
    const lines = useLedgerStore().entries()
    expect(lines.map((l) => [l.purpose, l.status]).sort()).toEqual([
      ['Reading markings', 'complete'],
      ['Test seal check', 'failed'],
    ])
  })

  it('applies the per-inspection cost cap across all of a run’s requests', async () => {
    // Seven requests at once against a cap of six: the in-flight ones count, so the last is never sent.
    for (let i = 0; i < 6; i += 1) {
      add(sealRequest({ id: `test-seal-${i}`, purpose: `Test seal check ${i}` }))
    }
    edge.answer('id', () => json(jevBody()))
    edge.answer('seal', () => json(sealBody()))
    const store = liveStore()

    await store.start()

    expect(edge.fetchMock).toHaveBeenCalledTimes(6)
    expect(useLedgerStore().inspectionTotals(store.record!.id).requests).toBe(6)
    expect(store.record?.status).toBe('partial')
    expect(store.stages[1]?.state).toBe('failed')
  })

  it('never sends a dependent request whose prerequisite failed', async () => {
    add(sealRequest({ after: [readId] }))
    edge.answer('id', () => json({ error: { message: 'Upstream error' } }, 502))
    const store = liveStore()

    await store.start()

    expect(edge.order).toEqual(['id'])
    expect(store.status).toBe('failed')
    expect(useLedgerStore().entries()).toHaveLength(1)
  })
})
