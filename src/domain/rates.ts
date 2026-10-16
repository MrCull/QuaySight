import type { ProviderId } from './inspection'
import { OPENROUTER_ENDPOINT_ID } from './openrouter'
import { getProvider } from './providers'

// Separately maintained cost configuration (spec 8.5, 11.6). Edit here, not in code.
// Every schedule is timestamped by effectiveFrom and keyed by provider, model and endpoint.
//
// PLACEHOLDER VALUES: none of these numbers has been verified against live provider billing pages
// in this change. Verify each one against the provider's pricing documentation before any live demo,
// then set placeholder to false and update source and effectiveFrom.
// A null rate means "unknown": the ledger shows a partial estimate, never zero.

export interface RateSchedule {
  provider: ProviderId
  model: string
  endpoint: string
  /** ISO date (YYYY-MM-DD) from which this schedule applies. */
  effectiveFrom: string
  /** Where the number came from, for the maintainer. */
  source: string
  placeholder: boolean
  inputUsdPerMillionTokens: number | null
  outputUsdPerMillionTokens: number | null
}

export interface SpendCaps {
  maxRequestsPerInspection: number
  maxSpendUsdPerInspection: number
}

export const rateSchedules: RateSchedule[] = [
  {
    provider: 'luna',
    model: 'gpt-6-luna',
    endpoint: 'decisions',
    effectiveFrom: '2026-10-01',
    source:
      'PLACEHOLDER: spec 8.5/11.6 documented baseline (US$0.10 per 1M input tokens, no output charge at Decisions). Not re-verified against OpenAI pricing.',
    placeholder: true,
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0,
  },
  // Jev through OpenRouter: every TypeSafe model the catalogue lists under OpenRouter. Used only when a
  // response carries no usage.cost; OpenRouter's reported cost is preferred (spec #16, Cost).
  ...getProvider('openrouter')
    .models.filter((m) => m.maker === 'TypeSafe')
    .map((m): RateSchedule => ({
      provider: 'openrouter',
      model: m.id,
      endpoint: OPENROUTER_ENDPOINT_ID,
      effectiveFrom: '2026-10-16',
      source:
        'OpenRouter usage.cost on live Jev calls, 16 Oct 2026: 1,844 input + 75 output tokens cost $0.000077448, i.e. $0.042 per Mtok input and output free. Matches docs.typesafe.ai/models ($42 per Btok). Re-check before a demo.',
      placeholder: false,
      inputUsdPerMillionTokens: 0.042,
      outputUsdPerMillionTokens: 0,
    })),
  // GPT-6 Luna Decisions through OpenRouter (ticket #23). Used only when a response carries no usage.cost.
  {
    provider: 'openrouter',
    model: 'openai/gpt-6-luna-decisions',
    endpoint: OPENROUTER_ENDPOINT_ID,
    effectiveFrom: '2026-10-16',
    source:
      'OpenRouter usage.cost on a live Luna Decisions call, 16 Oct 2026: 3,355 input + 0 output tokens cost $0.0003355, i.e. $0.10 per Mtok input and output free. Matches the direct OpenAI baseline. Re-check before a demo.',
    placeholder: false,
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0,
  },
]

/**
 * Per-inspection cap (spec 8.3, 11.5). PLACEHOLDER values, to be set by the presenter.
 * A live run's plan (spec #27) makes up to six requests: the survey, the long-side and door-end damage
 * sets, then one of the crop read or Luna's re-check, and the weight re-read. Eight leaves room for a
 * manifest check and one Try again.
 */
export const spendCaps: SpendCaps = {
  maxRequestsPerInspection: 8,
  maxSpendUsdPerInspection: 0.05,
}

/** Latest schedule for provider/model/endpoint that is effective on or before `at`. */
export function findRate(
  schedules: RateSchedule[],
  provider: ProviderId,
  model: string,
  endpoint: string,
  at: Date,
): RateSchedule | undefined {
  const day = at.toISOString().slice(0, 10)
  return schedules
    .filter(
      (s) =>
        s.provider === provider &&
        s.model === model &&
        s.endpoint === endpoint &&
        s.effectiveFrom <= day,
    )
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]
}
