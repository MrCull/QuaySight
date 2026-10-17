// What the opt-in live specs call: the shared adapter (askDecisions) with the Luna or Jev ID set on a
// catalogue route, flattened to the mapping plus the reply's timing, usage and raw body. Not a spec.
import { lunaIdQuestionSet } from '../../domain/idQuestions'
import { lunaMappingOf, LUNA_MODEL, type LunaMapping } from '../../domain/luna'
import { buildOpenRouterJevRequest, mapOpenRouterJevResponse } from '../../domain/openrouter'
import { findModel, labelsFor } from '../../domain/providers'
import type { ProviderId } from '../../domain/inspection'
import { questionSetAsk } from '../../domain/questionSetAsk'
import type { RequestReply, RunRoute } from '../../plan/requestPlan'
import { askDecisions } from '../askDecisions'

export function liveRoute(provider: ProviderId, model: string): RunRoute {
  const entry = findModel(provider, model)
  if (!entry) throw new Error(`${model} is not in the ${provider} catalogue`)
  return {
    provider,
    model,
    entry,
    endpoint: 'decisions',
    describe: { name: labelsFor(provider, model).model, maxSide: entry.photoLimits.maxSide },
  }
}

interface LiveOptions {
  apiKey: string
  photo: Blob
  fetchImpl?: typeof fetch
}

type Flat<A> = A & Omit<RequestReply<A>, 'answer'>

function flat<A extends object>(reply: RequestReply<A>): Flat<A> {
  const { answer, ...rest } = reply
  return { ...answer, ...rest }
}

/** The Luna ID set (all positions, or just these) on OpenAI direct, or on OpenRouter when `model` is given. */
export async function liveLuna(
  options: LiveOptions & { model?: string; positions?: number[] },
): Promise<Flat<LunaMapping>> {
  const route = options.model
    ? liveRoute('openrouter', options.model)
    : liveRoute('luna', LUNA_MODEL)
  const reply = await askDecisions(
    { route, apiKey: options.apiKey, photo: options.photo, fetchImpl: options.fetchImpl },
    questionSetAsk(lunaIdQuestionSet(options.positions), (r) => lunaMappingOf(r, options.positions)),
  )
  return flat(reply)
}

/** The Jev ID set on OpenRouter, with the box question where the catalogue allows it. */
export async function liveJev(options: LiveOptions & { model: string }) {
  const route = liveRoute('openrouter', options.model)
  const reply = await askDecisions(
    { route, apiKey: options.apiKey, photo: options.photo, fetchImpl: options.fetchImpl },
    {
      build: ({ imageDataUrl }) =>
        buildOpenRouterJevRequest(route.model, imageDataUrl, { box: route.entry.box }),
      map: (raw) => mapOpenRouterJevResponse(raw, route.model),
    },
  )
  return flat(reply)
}
