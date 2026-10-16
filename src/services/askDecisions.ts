import { LUNA_ENDPOINT, lunaFailure, lunaFetchFailure } from '../domain/luna'
import {
  OPENROUTER_ATTRIBUTION_HEADERS,
  OPENROUTER_ENDPOINT,
  OpenRouterError,
  openRouterFailure,
  openRouterFetchFailure,
} from '../domain/openrouter'
import { readReplyMeta } from '../domain/replyMeta'
import type { RequestContext, RequestReply, RunRoute } from '../plan/requestPlan'
import { photoDataUrl, postDecisions } from './decisions'

/** A request's own questions for one photo: how to ask them on a route, and how to read the answer. */
export interface DecisionsAsk<A> {
  /** The request body for this route's wire format. The key is never part of it. */
  build(input: { route: RunRoute; imageDataUrl: string }): unknown
  /** The answer, from the response payload. */
  map(raw: unknown, route: RunRoute): A
}

/** The browser's own view of its connection. Treated as online where the browser does not say. */
function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/**
 * One Decisions request on the run's route, for a plan request made of a question builder and an
 * answer mapper: the photo as a data URL, the key only in the Authorization header to the route's own
 * endpoint, the route's own error wording, and the request's abort signal. No retries: each call is charged.
 */
export async function askDecisions<A>(
  ctx: RequestContext,
  ask: DecisionsAsk<A>,
): Promise<RequestReply<A>> {
  const { route } = ctx
  const openRouter = route.entry.wireFormat === 'openrouter-decisions'
  if (!openRouter && route.entry.wireFormat !== 'openai-decisions') {
    throw new Error(`No live adapter for ${route.model}`)
  }
  if (!/^image\/(jpeg|png)$/.test(ctx.photo.type)) {
    throw new OpenRouterError(
      'photo',
      `${route.describe.name} takes JPEG or PNG photos. Choose another photo to run a live inspection.`,
    )
  }
  const imageDataUrl = await photoDataUrl(ctx.photo)
  const reply = await postDecisions({
    endpoint: openRouter ? OPENROUTER_ENDPOINT : LUNA_ENDPOINT,
    apiKey: ctx.apiKey,
    headers: openRouter ? OPENROUTER_ATTRIBUTION_HEADERS : undefined,
    request: ask.build({ route, imageDataUrl }),
    signal: ctx.signal,
    thrown: () => (openRouter ? openRouterFetchFailure() : lunaFetchFailure(browserOnline())),
    failed: (status, body) =>
      openRouter
        ? openRouterFailure(status, body, ctx.apiKey, route.describe)
        : lunaFailure(status, body, ctx.apiKey),
  })
  return {
    answer: ask.map(reply.raw, route),
    ...readReplyMeta(reply.raw, route.model),
    latencyMs: reply.latencyMs,
    raw: reply.raw,
  }
}
