/**
 * Classification of a failed provider call, made before any message is chosen (spec #16, "Error
 * classification"). Pure: the caller supplies what it saw (a thrown fetch and whether the browser reported
 * itself online, or a readable HTTP status) and what is known about the provider's error responses.
 * Each provider adapter maps the class to its own wording; no class carries provider text or the key.
 */

/** What the browser saw of the failed call. */
export type FailedCall =
  /** fetch threw before any response was readable. `online` is the browser's navigator.onLine at that moment. */
  | { kind: 'thrown'; online: boolean }
  /** A response came back readable with this non-2xx status. */
  | { kind: 'status'; status: number }

/** What is known about how the provider answers errors. */
export interface ProviderErrorTraits {
  /**
   * Whether the provider's error responses carry CORS headers. When they don't (OpenAI's Decisions API,
   * checked live 16 Oct 2026), the browser turns every refused call (bad key, no credit, no model access)
   * into a thrown fetch, so a thrown fetch while online means the provider refused the call.
   */
  errorsCarryCors: boolean
}

export type FailedCallClass =
  /** The provider answered with an error the browser could not read: wrong key, no credit or no model access. */
  | 'refused'
  /** The browser could not reach the provider at all. */
  | 'unreachable'
  /** 401 or 403: the key was rejected. */
  | 'bad-key'
  /** 404: the endpoint or model is not available to this key. */
  | 'not-found'
  /** 429: too many requests. */
  | 'rate-limited'
  /** 5xx: the provider is down or overloaded. */
  | 'unavailable'
  /** Any other readable error, usually something about the request itself. */
  | 'rejected'

export function classifyFailedCall(call: FailedCall, traits: ProviderErrorTraits): FailedCallClass {
  if (call.kind === 'thrown') {
    if (!call.online) return 'unreachable'
    return traits.errorsCarryCors ? 'unreachable' : 'refused'
  }
  const { status } = call
  if (status === 401 || status === 403) return 'bad-key'
  if (status === 404) return 'not-found'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'unavailable'
  return 'rejected'
}
