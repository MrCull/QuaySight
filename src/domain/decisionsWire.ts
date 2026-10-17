// What a provider supplies to the shared Decisions adapter (ticket #58): its endpoint, any extra
// non-secret headers, and its own error wording. The key goes in the Authorization header in the adapter
// only. Pure.
import type { FailureModel } from './openrouter'

export interface DecisionsWire {
  endpoint: string
  /** Extra headers that carry nothing secret, e.g. OpenRouter's attribution headers. */
  headers?: Record<string, string>
  /** The error for a fetch that threw. Its own text is never shown: it could echo request details. */
  thrown(online: boolean): Error
  /** The error for a readable non-2xx response. */
  failed(status: number, body: unknown, apiKey: string, describe: FailureModel): Error
}
