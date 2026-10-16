import type { ProviderId } from './inspection'
import { findRate, type RateSchedule, type SpendCaps } from './rates'

// Live cost ledger (spec 8.5, 11.6). Estimates only: never an invoice.
// Recorded samples never reach this module; only chargeable calls go through runChargeable.

export type CostState = 'estimated' | 'partial' | 'unavailable'

export interface Usage {
  inputTokens: number | null
  outputTokens: number | null
}

export interface LedgerEntry {
  /** Request id. Used to count each request once. */
  id: string
  inspectionId: string
  purpose: string
  provider: ProviderId
  endpoint: string
  /** Model as requested. */
  model: string
  /** Exact model/version the provider reported, or the requested model when none was reported. */
  resolvedModel: string
  status: 'complete' | 'failed'
  startedAt: string
  latencyMs: number
  usage: Usage | null
  costUsd: number | null
  costState: CostState
  rateEffectiveFrom: string | null
}

export interface Totals {
  requests: number
  inspections: number
  /** Sum of known costs, or null when no request has a known cost. */
  costUsd: number | null
  /** True when any request has partial or unavailable cost. */
  incomplete: boolean
  latencyMs: number
}

export interface ChargeableOutcome {
  resolvedModel: string
  usage: Usage | null
  latencyMs: number
  /** Cost the provider reported in its own response, when it does. Null means not reported, never zero. */
  reportedCostUsd?: number | null
}

export function estimateCost(
  usage: Usage | null,
  rate: RateSchedule | undefined,
): { costUsd: number | null; costState: CostState } {
  if (!rate || rate.inputUsdPerMillionTokens === null) {
    return { costUsd: null, costState: 'unavailable' }
  }
  if (!usage || usage.inputTokens === null) {
    return { costUsd: null, costState: 'unavailable' }
  }
  const outputRate = rate.outputUsdPerMillionTokens
  if (outputRate === null) return { costUsd: null, costState: 'unavailable' }
  if (usage.outputTokens === null && outputRate > 0) {
    return { costUsd: null, costState: 'partial' }
  }
  const outputTokens = usage.outputTokens ?? 0
  const costUsd =
    (usage.inputTokens * rate.inputUsdPerMillionTokens + outputTokens * outputRate) / 1_000_000
  return { costUsd, costState: 'estimated' }
}

/** Four decimals below one dollar, so $0.0016 never reads as $0.00. */
export function formatUsd(value: number | null): string {
  if (value === null) return 'Cost unavailable'
  return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}

export type CapReason = 'requests' | 'spend'

export class CostLedger {
  private readonly byId = new Map<string, LedgerEntry>()
  private readonly pending = new Map<string, number>()

  constructor(
    private readonly caps: SpendCaps,
    private readonly rates: RateSchedule[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Adds a completed or failed request. Re-recording the same id is ignored. */
  record(entry: LedgerEntry): boolean {
    if (this.byId.has(entry.id)) return false
    this.byId.set(entry.id, entry)
    return true
  }

  entries(): LedgerEntry[] {
    return [...this.byId.values()]
  }

  timestamp(): Date {
    return this.now()
  }

  rateFor(provider: ProviderId, model: string, endpoint: string): RateSchedule | undefined {
    return findRate(this.rates, provider, model, endpoint, this.now())
  }

  inspectionTotals(inspectionId: string): Totals {
    return totalsOf(
      this.entries().filter((e) => e.inspectionId === inspectionId),
      1,
    )
  }

  sessionTotals(): Totals {
    const all = this.entries()
    return totalsOf(all, new Set(all.map((e) => e.inspectionId)).size)
  }

  /** Whether another chargeable call may start for this inspection. In-flight calls count. */
  capStatus(inspectionId: string): { allowed: true } | { allowed: false; reason: CapReason } {
    const mine = this.entries().filter((e) => e.inspectionId === inspectionId)
    const inFlight = this.pending.get(inspectionId) ?? 0
    if (mine.length + inFlight >= this.caps.maxRequestsPerInspection) {
      return { allowed: false, reason: 'requests' }
    }
    // Every chargeable call counts toward the request cap above, known cost or not (spec 8.5).
    // The spend cap applies to known cost only: unknown cost is not counted as zero here, and the
    // totals show it as incomplete instead, so an unknown-usage provider is still limited by requests.
    const spent = mine.reduce((sum, e) => (e.costUsd === null ? sum : sum + e.costUsd), 0)
    if (spent >= this.caps.maxSpendUsdPerInspection) {
      return { allowed: false, reason: 'spend' }
    }
    return { allowed: true }
  }

  reserve(inspectionId: string): void {
    this.pending.set(inspectionId, (this.pending.get(inspectionId) ?? 0) + 1)
  }

  release(inspectionId: string): void {
    this.pending.set(inspectionId, Math.max(0, (this.pending.get(inspectionId) ?? 0) - 1))
  }
}

export interface ChargeableRequest {
  id: string
  inspectionId: string
  purpose: string
  provider: ProviderId
  endpoint: string
  model: string
  call: () => Promise<ChargeableOutcome>
}

export type ChargeableResult =
  | { status: 'ran'; entry: LedgerEntry }
  | { status: 'failed'; entry: LedgerEntry; error: unknown }
  | { status: 'blocked'; reason: CapReason }

/** The only way a live chargeable call enters the ledger. Blocked calls are never invoked. */
export async function runChargeable(
  ledger: CostLedger,
  request: ChargeableRequest,
): Promise<ChargeableResult> {
  const gate = ledger.capStatus(request.inspectionId)
  if (!gate.allowed) return { status: 'blocked', reason: gate.reason }

  const startedAt = ledger.timestamp().toISOString()
  const rate = ledger.rateFor(request.provider, request.model, request.endpoint)
  const base = {
    id: request.id,
    inspectionId: request.inspectionId,
    purpose: request.purpose,
    provider: request.provider,
    endpoint: request.endpoint,
    model: request.model,
    startedAt,
    rateEffectiveFrom: rate?.effectiveFrom ?? null,
  }
  ledger.reserve(request.inspectionId)
  try {
    const outcome = await request.call()
    const reported = typeof outcome.reportedCostUsd === 'number' ? outcome.reportedCostUsd : null
    const { costUsd, costState } =
      reported !== null ? { costUsd: reported, costState: 'estimated' as CostState } : estimateCost(outcome.usage, rate)
    const entry: LedgerEntry = {
      ...base,
      resolvedModel: outcome.resolvedModel,
      status: 'complete',
      latencyMs: outcome.latencyMs,
      usage: outcome.usage,
      costUsd,
      costState,
    }
    ledger.record(entry)
    return { status: 'ran', entry }
  } catch (error) {
    const entry: LedgerEntry = {
      ...base,
      resolvedModel: request.model,
      status: 'failed',
      latencyMs: 0,
      usage: null,
      costUsd: null,
      costState: 'unavailable',
    }
    ledger.record(entry)
    return { status: 'failed', entry, error }
  } finally {
    ledger.release(request.inspectionId)
  }
}

function totalsOf(entries: LedgerEntry[], inspections: number): Totals {
  const known = entries.filter((e) => e.costUsd !== null)
  return {
    requests: entries.length,
    inspections,
    costUsd: known.length === 0 ? null : known.reduce((sum, e) => sum + (e.costUsd ?? 0), 0),
    incomplete: entries.some((e) => e.costState !== 'estimated'),
    latencyMs: entries.reduce((sum, e) => sum + e.latencyMs, 0),
  }
}
