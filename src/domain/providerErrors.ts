// What every live provider error shares (spec #16, "Error classification"): the message is ours, never
// carries the key, and says that partial results are kept. Pure: no fetch, no storage.

/** The closing sentence of every live error message. */
export const PARTIAL_RESULTS_KEPT = 'Any partial result is kept.'

/** Anything shaped like a provider key (OpenAI `sk-…`, OpenRouter `sk-or-…`). */
export const KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g

/** Provider text made safe to show: the presenter's key and anything key-shaped removed, then shortened. */
export function redact(text: string, apiKey: string): string {
  let safe = text
  if (apiKey) safe = safe.split(apiKey).join('[key removed]')
  return safe.replace(KEY_PATTERN, '[key removed]').slice(0, 200)
}

/** The provider's own `error.message` from an error body, or null when there is none. */
export function providerMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}

/**
 * A failed live call, with a message fit to show the presenter. `advice` says what went wrong and what
 * to do; `message` adds that partial results are kept. Never carries the key.
 */
export class ProviderError<Kind extends string = string> extends Error {
  readonly kind: Kind
  readonly status: number | null
  /** The message without the closing sentence, for a panel that says what is kept in its own words. */
  readonly advice: string

  constructor(kind: Kind, advice: string, status: number | null = null) {
    super(`${advice} ${PARTIAL_RESULTS_KEPT}`)
    this.name = 'ProviderError'
    this.kind = kind
    this.status = status
    this.advice = advice
  }
}
