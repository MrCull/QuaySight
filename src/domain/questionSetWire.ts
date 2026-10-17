// Translating a question set into one wire format's request (spec #27, ticket #29; split out in ticket #54).
import { checkLimits } from './questionSetLimits'
import type {
  BoxQuestion,
  InputPart,
  QuestionWireFormat,
  SharedQuestion,
  SharedQuestionSet,
} from './questionSetTypes'

export interface OpenAiDecisionsRequest {
  model: string
  input: { role: 'user'; content: InputPart[] }[]
  questions: Exclude<SharedQuestion, BoxQuestion>[]
}

export type OpenRouterQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'box'; instructions: string }

export interface OpenRouterImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface OpenRouterDecisionsRequest {
  model: string
  state: (string | OpenRouterImagePart)[]
  questions: Record<string, OpenRouterQuestion>
}

export interface WireRequestOptions {
  /** The model id sent on the wire, from the catalogue. */
  model: string
  /** The photo as a data URL with its real MIME type. Replaces every image part's placeholder. */
  imageDataUrl: string
}

/** The questions in OpenRouter's (and TypeSafe System One's) format: a map by name. */
export function toOpenRouterQuestions(
  questions: SharedQuestion[],
): Record<string, OpenRouterQuestion> {
  return Object.fromEntries(
    questions.map((q): [string, OpenRouterQuestion] => {
      switch (q.type) {
        case 'predicate':
          return [q.name, { type: 'noul', instructions: q.instructions }]
        case 'choice':
          return [
            q.name,
            {
              type: 'choice',
              instructions: q.instructions,
              criteria: Object.fromEntries(q.choices.map((c) => [c.value, c.description ?? null])),
            },
          ]
        case 'score':
          return [
            q.name,
            {
              type: 'score',
              instructions: q.instructions,
              criteria: q.levels.map((l) =>
                l.description ? `${l.label}: ${l.description}` : l.label,
              ),
            },
          ]
        case 'box':
          return [q.name, { type: 'box', instructions: q.instructions }]
      }
    }),
  )
}

function toOpenAi(set: SharedQuestionSet, options: WireRequestOptions): OpenAiDecisionsRequest {
  return {
    model: options.model,
    input: set.input.map((message) => ({
      role: message.role,
      content: message.content.map((part) =>
        part.type === 'input_image' ? { ...part, image_url: options.imageDataUrl } : part,
      ),
    })),
    questions: set.questions.filter((q) => q.type !== 'box'),
  }
}

function toOpenRouter(
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenRouterDecisionsRequest {
  // Text parts in a row become one text; image parts lose fields OpenRouter does not take (detail).
  const state: (string | OpenRouterImagePart)[] = []
  for (const part of set.input.flatMap((m) => m.content)) {
    if (part.type === 'input_image') {
      state.push({ type: 'image_url', image_url: { url: options.imageDataUrl } })
      continue
    }
    const last = state[state.length - 1]
    if (typeof last === 'string') state[state.length - 1] = `${last}\n\n${part.text}`
    else state.push(part.text)
  }
  return { model: options.model, state, questions: toOpenRouterQuestions(set.questions) }
}

/**
 * The request body for one photo in a wire format. Throws QuestionSetError, before anything is sent,
 * for a set over the format's question or choice limit, or with a question type it does not take.
 */
export function toWireRequest(
  wire: 'openai-decisions',
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest
export function toWireRequest(
  wire: 'openrouter-decisions',
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenRouterDecisionsRequest
export function toWireRequest(
  wire: QuestionWireFormat,
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest | OpenRouterDecisionsRequest
export function toWireRequest(
  wire: QuestionWireFormat,
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest | OpenRouterDecisionsRequest {
  checkLimits(set, wire)
  return wire === 'openai-decisions' ? toOpenAi(set, options) : toOpenRouter(set, options)
}
