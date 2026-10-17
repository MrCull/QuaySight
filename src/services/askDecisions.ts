import type { DecisionsWire } from '../domain/decisionsWire'
import { LUNA_WIRE } from '../domain/luna'
import { OPENROUTER_WIRE, OpenRouterError } from '../domain/openrouter'
import { ProviderError } from '../domain/providerErrors'
import { readReplyMeta } from '../domain/replyMeta'
import { stampFailure } from '../domain/requestFailure'
import type { RequestContext, RequestReply, RunRoute } from '../plan/requestPlan'
import { photoDataUrl, postDecisions } from './decisions'

/** A request's own questions for one photo: how to ask them on a route, and how to read the answer. */
export interface DecisionsAsk<A> {
  /** The request body for this route's wire format. The key is never part of it. */
  build(input: { route: RunRoute; imageDataUrl: string }): unknown
  /** The answer, from the response payload. */
  map(raw: unknown, route: RunRoute): A
}

/**
 * What one request is sent with: the plan's request context, or for a request made outside the plan
 * (the manifest check) the same without a signal.
 */
export type AskContext = Pick<RequestContext, 'route' | 'apiKey' | 'photo'> & {
  /** Aborts the call in flight. */
  signal?: AbortSignal
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/** The browser's own view of its connection. Treated as online where the browser does not say. */
function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/** The provider's own settings for a route: endpoint, extra headers and error wording. */
function wireOf(route: RunRoute): DecisionsWire {
  switch (route.entry.wireFormat) {
    case 'openrouter-decisions':
      return OPENROUTER_WIRE
    case 'openai-decisions':
      return LUNA_WIRE
    default:
      throw new Error(`No live adapter for ${route.model}`)
  }
}

/**
 * The one send-and-read path for every live provider call, on the run's route: the photo as a data URL,
 * the key only in the Authorization header to the route's own endpoint, the route's own error wording,
 * and the abort signal. A failure leaves here with its cause stamped, once. No retries: each call is charged.
 */
export async function askDecisions<A>(
  ctx: AskContext,
  ask: DecisionsAsk<A>,
): Promise<RequestReply<A>> {
  try {
    return await send(ctx, ask)
  } catch (error) {
    stampFailure(error)
    throw error
  }
}

async function send<A>(ctx: AskContext, ask: DecisionsAsk<A>): Promise<RequestReply<A>> {
  const { route } = ctx
  const wire = wireOf(route)
  if (!/^image\/(jpeg|png)$/.test(ctx.photo.type)) {
    throw new OpenRouterError(
      'photo',
      `${route.describe.name} takes JPEG or PNG photos. Choose another photo to run a live inspection.`,
    )
  }
  const imageDataUrl = await photoDataUrl(ctx.photo)
  const reply = await postDecisions({
    endpoint: wire.endpoint,
    apiKey: ctx.apiKey,
    headers: wire.headers,
    request: ask.build({ route, imageDataUrl }),
    fetchImpl: ctx.fetchImpl,
    signal: ctx.signal,
    thrown: () => wire.thrown(browserOnline()),
    failed: (status, body) => wire.failed(status, body, ctx.apiKey, route.describe),
  })
  let answer: A
  try {
    answer = ask.map(reply.raw, route)
  } catch (error) {
    // A reply that arrived but could not be mapped: keep its body for the raw-response download.
    if (error instanceof ProviderError) error.rawBody = reply.raw
    throw error
  }
  return {
    answer,
    ...readReplyMeta(reply.raw, route.model),
    latencyMs: reply.latencyMs,
    raw: reply.raw,
  }
}
