import { describe, it, expect } from 'vitest'
import type { ChargeableRequest, ChargeableResult, LedgerEntry } from '../../domain/ledger'
import { liveRoute } from '../../services/__tests__/liveCalls'
import { runPlan, type PlanRequest, type RequestReply } from '../requestPlan'

const reply = <A>(answer: A): RequestReply<A> => ({
  answer,
  resolvedModel: 'm',
  usage: null,
  latencyMs: 0,
  reportedCostUsd: null,
  raw: {},
})

/** A request that answers `answer`, or fails when `answer` is an Error. */
function request(id: string, answer: unknown, extra: Partial<PlanRequest> = {}): PlanRequest {
  return {
    id,
    purpose: id,
    stages: ['details'],
    send: async () => {
      if (answer instanceof Error) throw answer
      return reply(answer)
    },
    apply: (record) => record,
    ...extra,
  }
}

async function charge(r: ChargeableRequest): Promise<ChargeableResult> {
  const entry = {} as LedgerEntry
  try {
    await r.call()
    return { status: 'ran', entry }
  } catch (error) {
    return { status: 'failed', entry, error }
  }
}

async function run(requests: PlanRequest[]): Promise<string[]> {
  const order: string[] = []
  await runPlan({
    requests,
    route: liveRoute('openrouter', '~typesafe/jev-latest'),
    apiKey: 'k',
    photo: new Blob(),
    inspectionId: 'i',
    charge,
    onState: () => {},
    onSettled: (s) => order.push(`${s.request.id}:${s.outcome.status}`),
  }).done
  return order
}

describe('a request that waits for another to settle (settledAfter)', () => {
  it('starts after it answers, and reads its answer', async () => {
    const first = request('first', 'a')
    let seen: unknown
    const waiting = request('waiting', 'b', {
      settledAfter: [first],
      send: async (ctx) => {
        seen = ctx.answer(first)
        return reply('b')
      },
    })
    expect(await run([first, waiting])).toEqual(['first:answered', 'waiting:answered'])
    expect(seen).toBe('a')
  })

  it('still starts when it fails, unlike a prerequisite', async () => {
    const first = request('first', new Error('no'))
    const waiting = request('waiting', 'b', { settledAfter: [first] })
    expect(await run([first, waiting])).toEqual(['first:failed', 'waiting:answered'])
  })

  it("waits for, and reads, a copy of it, as several photos' plans run copies (photoPlan.ts)", async () => {
    const first = request('first', 'a')
    let seen: unknown
    const waiting = request('waiting', 'b', {
      settledAfter: [first],
      send: async (ctx) => {
        seen = ctx.answer(first)
        return reply('b')
      },
    })
    const slowCopy = {
      ...first,
      send: () => new Promise<RequestReply<unknown>>((r) => setTimeout(() => r(reply('a')), 5)),
    }
    expect(await run([slowCopy, waiting])).toEqual(['first:answered', 'waiting:answered'])
    expect(seen).toBe('a')
  })

  it('does not wait for a request that is not in the run', async () => {
    const absent = request('absent', 'a')
    expect(await run([request('waiting', 'b', { settledAfter: [absent] })])).toEqual([
      'waiting:answered',
    ])
  })
})
