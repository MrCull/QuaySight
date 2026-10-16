import { describe, it, expect, vi } from 'vitest'
import {
  CostLedger,
  estimateCost,
  formatUsd,
  runChargeable,
  type ChargeableOutcome,
  type LedgerEntry,
} from '../ledger'
import { findRate, rateSchedules, type RateSchedule } from '../rates'

const NOW = new Date('2026-10-16T10:00:00Z')

// Independent fixture rate: the spec's documented Luna baseline (US$0.10 per 1M input tokens).
const lunaRate: RateSchedule = {
  provider: 'luna',
  model: 'gpt-6-luna',
  endpoint: 'decisions',
  effectiveFrom: '2026-10-01',
  source: 'test fixture',
  placeholder: true,
  inputUsdPerMillionTokens: 0.1,
  outputUsdPerMillionTokens: 0,
}

const jevNoRate: RateSchedule = {
  provider: 'openrouter',
  model: 'typesafe/jev-1.14',
  endpoint: 'decisions',
  effectiveFrom: '2026-10-01',
  source: 'test fixture',
  placeholder: true,
  inputUsdPerMillionTokens: null,
  outputUsdPerMillionTokens: null,
}

const caps = { maxRequestsPerInspection: 3, maxSpendUsdPerInspection: 0.05 }

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'req-1',
    inspectionId: 'insp-1',
    purpose: 'Reading markings',
    provider: 'luna',
    endpoint: 'decisions',
    model: 'gpt-6-luna',
    resolvedModel: 'gpt-6-luna-2026-10-01',
    status: 'complete',
    startedAt: NOW.toISOString(),
    latencyMs: 2400,
    usage: { inputTokens: 15780, outputTokens: 0 },
    costUsd: 0.001578,
    costState: 'estimated',
    rateEffectiveFrom: '2026-10-01',
    ...overrides,
  }
}

describe('rates configuration', () => {
  it('finds the rate for a provider, model and endpoint effective at a date', () => {
    const rate = findRate(rateSchedules, 'luna', 'gpt-6-luna', 'decisions', NOW)
    expect(rate?.inputUsdPerMillionTokens).toBe(0.1)
    expect(rate?.placeholder).toBe(true)
  })

  it('does not apply Luna pricing to Jev', () => {
    const rate = findRate(rateSchedules, 'openrouter', 'typesafe/jev-1.14', 'decisions', NOW)
    expect(rate?.provider).toBe('openrouter')
    expect(rate?.inputUsdPerMillionTokens).toBe(0.042)
    expect(rate?.inputUsdPerMillionTokens).not.toBe(0.1)
  })

  it('has a timestamped rate for every Jev model OpenRouter offers', () => {
    for (const model of ['~typesafe/jev-latest', 'typesafe/jev-1.14', 'typesafe/jev-1.13']) {
      const rate = findRate(rateSchedules, 'openrouter', model, 'decisions', NOW)
      expect(rate?.effectiveFrom).toBe('2026-10-16')
      expect(rate?.placeholder).toBe(false)
    }
  })

  it('reproduces the cost OpenRouter reported for a live Jev call (16 Oct 2026)', () => {
    // resp-or-typesafe_jev-latest: 1,844 input and 75 output tokens, usage.cost 0.000077448.
    const rate = findRate(rateSchedules, 'openrouter', '~typesafe/jev-latest', 'decisions', NOW)
    expect(estimateCost({ inputTokens: 1844, outputTokens: 75 }, rate).costUsd).toBeCloseTo(
      0.000077448,
      12,
    )
  })

  it('ignores a rate that is not yet effective', () => {
    expect(
      findRate(rateSchedules, 'luna', 'gpt-6-luna', 'decisions', new Date('2020-01-01')),
    ).toBeUndefined()
  })

  it('picks the latest rate effective at the date when several are timestamped', () => {
    const schedules = [
      { ...lunaRate, effectiveFrom: '2026-01-01', inputUsdPerMillionTokens: 0.2 },
      { ...lunaRate, effectiveFrom: '2026-10-01', inputUsdPerMillionTokens: 0.1 },
    ]
    expect(
      findRate(schedules, 'luna', 'gpt-6-luna', 'decisions', NOW)?.inputUsdPerMillionTokens,
    ).toBe(0.1)
  })
})

describe('cost estimate', () => {
  it('prices 15,780 input tokens at the Luna baseline as about $0.001578', () => {
    const result = estimateCost({ inputTokens: 15780, outputTokens: 0 }, lunaRate)
    expect(result.costState).toBe('estimated')
    expect(result.costUsd).toBeCloseTo(0.001578, 9)
    expect(formatUsd(result.costUsd)).toBe('$0.0016')
  })

  it('reports unavailable, not zero, when the rate is unknown', () => {
    expect(estimateCost({ inputTokens: 1000, outputTokens: 10 }, jevNoRate)).toEqual({
      costUsd: null,
      costState: 'unavailable',
    })
  })

  it('reports unavailable, not zero, when the provider returned no usage', () => {
    expect(estimateCost(null, lunaRate)).toEqual({ costUsd: null, costState: 'unavailable' })
  })

  it('reports partial when a billed token count is missing', () => {
    const rate = { ...lunaRate, outputUsdPerMillionTokens: 1 }
    expect(estimateCost({ inputTokens: 1000, outputTokens: null }, rate)).toEqual({
      costUsd: null,
      costState: 'partial',
    })
  })
})

describe('formatUsd', () => {
  it('shows four decimals below one dollar so tiny costs are not $0.00', () => {
    expect(formatUsd(0.0016)).toBe('$0.0016')
    expect(formatUsd(0.0187)).toBe('$0.0187')
    expect(formatUsd(0)).toBe('$0.0000')
  })

  it('shows two decimals from one dollar up', () => {
    expect(formatUsd(1.5)).toBe('$1.50')
  })

  it('returns an explicit unavailable label for unknown cost, never zero', () => {
    expect(formatUsd(null)).toBe('Cost unavailable')
  })
})

describe('CostLedger totals', () => {
  it('counts a completed request once, even when recorded twice', () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    ledger.record(entry())
    ledger.record(entry())
    expect(ledger.sessionTotals().requests).toBe(1)
    expect(ledger.sessionTotals().costUsd).toBeCloseTo(0.001578, 9)
  })

  it('sums container and session totals across providers and models', () => {
    const ledger = new CostLedger(caps, [lunaRate, jevNoRate], () => NOW)
    ledger.record(entry({ id: 'a', inspectionId: 'insp-1', costUsd: 0.001 }))
    ledger.record(entry({ id: 'b', inspectionId: 'insp-2', costUsd: 0.002 }))
    expect(ledger.inspectionTotals('insp-1').costUsd).toBeCloseTo(0.001, 9)
    expect(ledger.sessionTotals().costUsd).toBeCloseTo(0.003, 9)
    expect(ledger.sessionTotals().inspections).toBe(2)
  })

  it('marks totals incomplete and keeps the known part when some usage is unknown', () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    ledger.record(entry({ id: 'a', costUsd: 0.001 }))
    ledger.record(entry({ id: 'b', costUsd: null, costState: 'unavailable', usage: null }))
    const totals = ledger.sessionTotals()
    expect(totals.incomplete).toBe(true)
    expect(totals.costUsd).toBeCloseTo(0.001, 9)
    expect(totals.requests).toBe(2)
  })

  it('reports no cost, not zero, when every request has unknown cost', () => {
    const ledger = new CostLedger(caps, [jevNoRate], () => NOW)
    ledger.record(entry({ id: 'a', costUsd: null, costState: 'unavailable', usage: null }))
    expect(ledger.sessionTotals()).toMatchObject({ costUsd: null, incomplete: true, requests: 1 })
  })

  it('says how much of a total is a rate-table estimate: none, part or all of it', () => {
    const reported = new CostLedger(caps, [lunaRate], () => NOW)
    reported.record(entry({ id: 'a', costState: 'reported' }))
    expect(reported.sessionTotals().estimate).toBe('none')

    const mixed = new CostLedger(caps, [lunaRate], () => NOW)
    mixed.record(entry({ id: 'a', costState: 'reported' }))
    mixed.record(entry({ id: 'b', costState: 'estimated' }))
    expect(mixed.sessionTotals().estimate).toBe('part')

    const estimated = new CostLedger(caps, [lunaRate], () => NOW)
    estimated.record(entry({ id: 'a', costState: 'estimated' }))
    expect(estimated.sessionTotals().estimate).toBe('all')
  })

  it('is not incomplete when every request is estimated', () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    ledger.record(entry())
    expect(ledger.sessionTotals().incomplete).toBe(false)
  })

  it('keeps a provider-reported cost as reported, not as an estimate, and counts it as complete', async () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    const result = await runChargeable(ledger, {
      id: 'or-1',
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna',
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: async () => ({
        resolvedModel: 'gpt-6-luna-2026-10-01',
        usage: { inputTokens: 15780, outputTokens: 0 },
        latencyMs: 10,
        reportedCostUsd: 0.000077448,
      }),
    })
    expect(result.status === 'ran' && result.entry).toMatchObject({
      costUsd: 0.000077448,
      costState: 'reported',
    })
    expect(ledger.sessionTotals()).toMatchObject({ costUsd: 0.000077448, incomplete: false })
  })
})

describe('CostLedger cap', () => {
  it('stops further chargeable calls once the per-inspection request cap is reached', async () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 2, maxSpendUsdPerInspection: 1 },
      [lunaRate],
      () => NOW,
    )
    const fakeCall = vi.fn<() => Promise<ChargeableOutcome>>(async () => ({
      resolvedModel: 'gpt-6-luna-2026-10-01',
      usage: { inputTokens: 100, outputTokens: 0 },
      latencyMs: 10,
    }))
    const base = {
      inspectionId: 'insp-1',
      purpose: 'Looking for damage',
      provider: 'luna' as const,
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: fakeCall,
    }
    const results = []
    for (let i = 0; i < 4; i++) {
      results.push(await runChargeable(ledger, { ...base, id: `req-${i}` }))
    }
    expect(results.map((r) => r.status)).toEqual(['ran', 'ran', 'blocked', 'blocked'])
    expect(fakeCall).toHaveBeenCalledTimes(2)
    expect(results[2]).toMatchObject({ status: 'blocked', reason: 'requests' })
    expect(ledger.sessionTotals().requests).toBe(2)
  })

  it('stops further chargeable calls at the request cap when usage is unknown, as Luna usage is', async () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 2, maxSpendUsdPerInspection: 0.05 },
      [lunaRate],
      () => NOW,
    )
    const unknownUsage = vi.fn<() => Promise<ChargeableOutcome>>(async () => ({
      resolvedModel: 'gpt-6-luna',
      usage: null,
      latencyMs: 10,
    }))
    const base = {
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna' as const,
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: unknownUsage,
    }
    const results = []
    for (let i = 0; i < 3; i++) {
      results.push(await runChargeable(ledger, { ...base, id: `unknown-${i}` }))
    }
    expect(results.map((r) => r.status)).toEqual(['ran', 'ran', 'blocked'])
    expect(unknownUsage).toHaveBeenCalledTimes(2)
    expect(results[2]).toMatchObject({ status: 'blocked', reason: 'requests' })
    // Unknown cost is not zero: the totals stay incomplete and show no known cost.
    expect(ledger.sessionTotals()).toMatchObject({ requests: 2, costUsd: null, incomplete: true })
  })

  it('counts failed calls with unknown cost against the request cap', async () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 2, maxSpendUsdPerInspection: 0.05 },
      [lunaRate],
      () => NOW,
    )
    const failing = vi.fn<() => Promise<ChargeableOutcome>>(async () => {
      throw new Error('OpenAI is unavailable right now.')
    })
    const base = {
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna' as const,
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: failing,
    }
    await runChargeable(ledger, { ...base, id: 'fail-1' })
    await runChargeable(ledger, { ...base, id: 'fail-2' })
    const third = await runChargeable(ledger, { ...base, id: 'fail-3' })
    expect(third).toMatchObject({ status: 'blocked', reason: 'requests' })
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('unknown cost is not counted as spend and leaves the totals incomplete', () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 5, maxSpendUsdPerInspection: 0.0001 },
      [lunaRate],
      () => NOW,
    )
    ledger.record(entry({ id: 'u-1', usage: null, costUsd: null, costState: 'unavailable' }))
    expect(ledger.capStatus('insp-1')).toEqual({ allowed: true })
    expect(ledger.inspectionTotals('insp-1')).toMatchObject({ costUsd: null, incomplete: true })
  })

  it('stops further chargeable calls once the per-inspection spend cap is reached', async () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 10, maxSpendUsdPerInspection: 0.0001 },
      [lunaRate],
      () => NOW,
    )
    const fakeCall = vi.fn<() => Promise<ChargeableOutcome>>(async () => ({
      resolvedModel: 'gpt-6-luna-2026-10-01',
      usage: { inputTokens: 5000, outputTokens: 0 },
      latencyMs: 10,
    }))
    const base = {
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna' as const,
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: fakeCall,
    }
    await runChargeable(ledger, { ...base, id: 'req-1' })
    const second = await runChargeable(ledger, { ...base, id: 'req-2' })
    expect(second).toMatchObject({ status: 'blocked', reason: 'spend' })
    expect(fakeCall).toHaveBeenCalledTimes(1)
  })

  it('counts an in-flight call against the cap so concurrent clicks cannot overshoot it', async () => {
    const ledger = new CostLedger(
      { maxRequestsPerInspection: 1, maxSpendUsdPerInspection: 1 },
      [lunaRate],
      () => NOW,
    )
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const slow = vi.fn<() => Promise<ChargeableOutcome>>(async () => {
      await gate
      return {
        resolvedModel: 'gpt-6-luna-2026-10-01',
        usage: { inputTokens: 1, outputTokens: 0 },
        latencyMs: 1,
      }
    })
    const base = {
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna' as const,
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: slow,
    }
    const first = runChargeable(ledger, { ...base, id: 'a' })
    const second = await runChargeable(ledger, { ...base, id: 'b' })
    release()
    await first
    expect(second).toMatchObject({ status: 'blocked', reason: 'requests' })
    expect(slow).toHaveBeenCalledTimes(1)
  })

  it('records a failed call as a request with unknown cost, not zero', async () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    const result = await runChargeable(ledger, {
      id: 'x',
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna',
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      call: async () => {
        throw new Error('provider down')
      },
    })
    expect(result).toMatchObject({ status: 'failed' })
    const totals = ledger.sessionTotals()
    expect(totals.requests).toBe(1)
    expect(totals.incomplete).toBe(true)
    expect(totals.costUsd).toBeNull()
  })

  it('records an aborted call as cancelled with unknown cost, never free, without waiting for it', async () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    const controller = new AbortController()
    // A call that never answers: the abort alone must settle it.
    const pending = runChargeable(ledger, {
      id: 'x',
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna',
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      signal: controller.signal,
      call: () => new Promise<ChargeableOutcome>(() => {}),
    })
    controller.abort()
    const result = await pending
    expect(result).toMatchObject({
      status: 'cancelled',
      entry: { status: 'cancelled', costUsd: null, costState: 'unavailable' },
    })
    expect(ledger.sessionTotals()).toMatchObject({ requests: 1, costUsd: null, incomplete: true })
  })

  it('a call whose own failure follows an abort is still recorded as cancelled', async () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    const controller = new AbortController()
    const result = await runChargeable(ledger, {
      id: 'x',
      inspectionId: 'insp-1',
      purpose: 'Reading markings',
      provider: 'luna',
      endpoint: 'decisions',
      model: 'gpt-6-luna',
      signal: controller.signal,
      call: async () => {
        controller.abort()
        throw new Error('The operation was aborted')
      },
    })
    expect(result).toMatchObject({ status: 'cancelled', entry: { status: 'cancelled' } })
  })

  it('a recorded sample never enters the ledger because it never calls runChargeable', () => {
    const ledger = new CostLedger(caps, [lunaRate], () => NOW)
    expect(ledger.entries()).toHaveLength(0)
    expect(ledger.sessionTotals()).toMatchObject({ requests: 0, costUsd: null, inspections: 0 })
  })
})
