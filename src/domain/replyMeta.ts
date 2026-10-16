import type { Usage } from './ledger'

// What every Decisions response says about itself, on either route: the model that answered, the
// usage and (OpenRouter) the cost it reports. Read defensively: an absent figure is null, never zero.

export interface ReplyMeta {
  /** The model/version the response names, or the requested model when it names none. */
  resolvedModel: string
  usage: Usage | null
  /** usage.cost where the response reports it (OpenRouter), or null. */
  reportedCostUsd: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

export function readReplyMeta(raw: unknown, requestedModel: string): ReplyMeta {
  const body = asRecord(raw)
  const model = body?.model
  const usage = asRecord(body?.usage)
  const inputTokens = usage ? numberField(usage, ['input_tokens', 'prompt_tokens']) : null
  return {
    resolvedModel: typeof model === 'string' && model.trim() ? model.trim() : requestedModel,
    usage:
      usage && inputTokens !== null
        ? { inputTokens, outputTokens: numberField(usage, ['output_tokens', 'completion_tokens']) }
        : null,
    reportedCostUsd: usage ? numberField(usage, ['cost']) : null,
  }
}
