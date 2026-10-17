// What is kept of a request that failed, so the presenter sees why in plain words and a maintainer can
// diagnose it afterwards (ticket #53). Pure. Never carries the key: the message is the provider error's
// own advice, which is already ours and key-free.
import { ProviderError } from './providerErrors'

/** The cause in plain words: what the presenter is told. */
export type FailureCause = 'busy' | 'refused' | 'unreadable' | 'offline' | 'unknown'

/** The failure of one request, as kept on a cost-list line. */
export interface RequestFailure {
  /** The provider error's own kind (`http`, `network`, `refused`, `bad-response`, `rate-limited`, …), or `unknown`. */
  kind: string
  cause: FailureCause
  /** The message fit to show, without the closing "partial result is kept" sentence. */
  message: string
  /** The HTTP status when a readable response carried one. */
  status: number | null
}

/** A failure on the inspection record: which request, and so which stages it left unfinished. */
export interface RequestFailureNote extends RequestFailure {
  requestId: string
  stages: readonly ('id' | 'details' | 'damage')[]
}

const OFFLINE_KINDS = new Set(['network', 'unreachable'])
const UNREADABLE_KINDS = new Set(['bad-response'])
const BUSY_KINDS = new Set(['rate-limited', 'unavailable'])

function causeOf(kind: string, status: number | null): FailureCause {
  if (OFFLINE_KINDS.has(kind)) return 'offline'
  if (UNREADABLE_KINDS.has(kind)) return 'unreadable'
  if (BUSY_KINDS.has(kind) || status === 429 || (status !== null && status >= 500)) return 'busy'
  if (kind === 'unknown') return 'unknown'
  return 'refused'
}

/** The kind, cause and message of a failed request's error. Anything that is not a provider error is `unknown`. */
export function describeFailure(error: unknown): RequestFailure {
  if (error instanceof ProviderError) {
    return {
      kind: error.kind,
      cause: causeOf(error.kind, error.status),
      message: error.advice,
      status: error.status,
    }
  }
  return {
    kind: 'unknown',
    cause: 'unknown',
    message: 'The request did not finish.',
    status: null,
  }
}

/** The reply that arrived but could not be mapped, kept for the raw-response download. Undefined when there was none. */
export function unreadableBody(error: unknown): { body: unknown } | null {
  return error instanceof ProviderError && error.rawBody !== undefined
    ? { body: error.rawBody }
    : null
}

/** The cause as a short sentence for a notice, naming the provider's own message where it helps. */
export function causeSentence(failure: RequestFailure): string {
  switch (failure.cause) {
    case 'busy':
      return `${providerName(failure.message)} is busy or rate-limited.`
    case 'unreadable':
      return 'The reply could not be read.'
    case 'offline':
      return 'The connection was lost.'
    case 'refused':
      return `${providerName(failure.message)} refused the request.`
    default:
      return 'The request did not finish.'
  }
}

/** "OpenAI" or "OpenRouter", from the start of the provider's own message; "The provider" otherwise. */
function providerName(message: string): string {
  const named = /^(OpenRouter|OpenAI)\b/.exec(message)
  return named ? named[1]! : 'The provider'
}
