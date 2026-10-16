// A shared-format question set as one Decisions request on a run's route (ticket #29). Pure.
//
// The result has the build/map shape a request plan's Decisions call takes: `build` translates the set
// for the route's wire format (refusing a set over the route's limits before anything is sent), and
// `map` reads the reply by meaning, with the route's own wording for a reply it cannot read, then hands
// the typed answers to the request's own reader.
import type { WireFormat } from './providers'
import { readOpenAiReply } from './luna'
import { readOpenRouterReply } from './openrouter'
import {
  QuestionSetError,
  toWireRequest,
  type AnswersReading,
  type OpenAiDecisionsRequest,
  type OpenRouterDecisionsRequest,
  type QuestionWireFormat,
  type SharedQuestionSet,
} from './questionSet'

/** What the ask needs of a run's route: the model id sent and its catalogue wire format. */
export interface AskRoute {
  model: string
  entry: { wireFormat: WireFormat }
}

export interface QuestionSetAsk<A> {
  build(input: {
    route: AskRoute
    imageDataUrl: string
  }): OpenAiDecisionsRequest | OpenRouterDecisionsRequest
  map(raw: unknown, route: AskRoute): A
}

function wireOf(route: AskRoute): QuestionWireFormat {
  const wire = route.entry.wireFormat
  if (wire === 'openai-decisions' || wire === 'openrouter-decisions') return wire
  throw new QuestionSetError(`${route.model} is not reached through a Decisions endpoint.`)
}

/**
 * One request for a shared-format question set. `read` turns the typed answers (by question name,
 * with the resolved model, usage and any reported cost) into the request's own result.
 */
export function questionSetAsk<A>(
  set: SharedQuestionSet,
  read: (reply: AnswersReading, route: AskRoute) => A,
): QuestionSetAsk<A> {
  return {
    build: ({ route, imageDataUrl }) =>
      toWireRequest(wireOf(route), set, { model: route.model, imageDataUrl }),
    map: (raw, route) => {
      const reply =
        wireOf(route) === 'openai-decisions'
          ? readOpenAiReply(raw, set, route.model)
          : readOpenRouterReply(raw, set, route.model)
      return read(reply, route)
    },
  }
}
