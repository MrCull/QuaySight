// OpenRouter Decisions adapter (spec #16, ticket #22; docs/adr/0001). Pure functions: no fetch, no storage.
// Request and response shapes, model ids, image limits, CORS and error bodies were checked live on
// 16 October 2026; see docs/research/live-api-findings-2026-10-16.md.
//
// One JSON body: `state` holds an instruction text part and the photo as a base64 data-URL part;
// `questions` is a map of typed questions (noul, choice, score, box). OpenRouter's errors carry CORS
// headers, so every failed status is readable in the browser and gets its own message.
import { classifyFailedCall, type ProviderErrorTraits } from './failedCall'
import { ProviderError, providerMessage, redact } from './providerErrors'
import { JevError, mapJevResponse, type JevMapping } from './jev'
import { JEV_STATE_INSTRUCTIONS, jevIdQuestionSet, lunaIdQuestionSet } from './idQuestions'
import { lunaMappingOf, manifestMappingOf, type LunaMapping, type ManifestMapping } from './luna'
import { manifestQuestionSet, type ManifestQuestion } from './manifest'
import {
  UnreadableReplyError,
  readAnswers,
  toWireRequest,
  type AnswersReading,
  type OpenRouterDecisionsRequest,
  type SharedQuestionSet,
} from './questionSet'

export { JEV_STATE_INSTRUCTIONS }

export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
/** Endpoint family key used by the rate schedules and ledger. */
export const OPENROUTER_ENDPOINT_ID = 'decisions'
/** Optional attribution headers OpenRouter reads to name the calling app. They carry nothing secret. */
export const OPENROUTER_ATTRIBUTION_HEADERS = {
  'HTTP-Referer': 'https://quay-sight.com',
  'X-Title': 'Quay Sight',
} as const

/** OpenRouter sends CORS headers on errors as well as on success (checked live 16 Oct 2026). */
export const OPENROUTER_ERROR_TRAITS: ProviderErrorTraits = { errorsCarryCors: true }

/** OpenRouter's request: `state` holds the text and the photo part; `questions` is a map by name. */
export type OpenRouterRequestBody = OpenRouterDecisionsRequest

/**
 * The request for one photo on a Jev model: the Jev ID set, translated for OpenRouter. The key is never
 * part of the body. The box question is asked only when the catalogue declares the model box-capable
 * (the caller passes that flag).
 */
export function buildOpenRouterJevRequest(
  model: string,
  imageDataUrl: string,
  options: { box: boolean },
): OpenRouterRequestBody {
  return toWireRequest(
    'openrouter-decisions',
    jevIdQuestionSet({ image: 'the photo', box: options.box }),
    {
      model,
      imageDataUrl,
    },
  )
}

/**
 * The request for one photo on a Luna Decisions model (ticket #23): the same Luna ID set the direct
 * route asks, translated for OpenRouter. Luna takes no box question. With positions, only those
 * (1-based) are asked, as for the direct re-check.
 */
export function buildOpenRouterLunaRequest(
  model: string,
  imageDataUrl: string,
  positions?: number[],
): OpenRouterRequestBody {
  return toWireRequest('openrouter-decisions', lunaIdQuestionSet(positions), {
    model,
    imageDataUrl,
  })
}

/**
 * The manifest check for one photo on any OpenRouter Decisions model (spec 3.2): the pasted entries
 * as choice questions, each with "not listed", translated for OpenRouter. No box question.
 */
export function buildOpenRouterManifestRequest(
  model: string,
  imageDataUrl: string,
  questions: ManifestQuestion[],
): OpenRouterRequestBody {
  return toWireRequest('openrouter-decisions', manifestQuestionSet(questions), {
    model,
    imageDataUrl,
  })
}

export type OpenRouterErrorKind =
  | 'unreachable'
  | 'bad-key'
  | 'no-credit'
  | 'not-found'
  | 'rate-limited'
  | 'photo-rejected'
  | 'unavailable'
  | 'rejected'
  | 'bad-response'
  | 'photo'

/** A failed OpenRouter call, with a message fit to show the presenter. Never carries the key. */
export class OpenRouterError extends ProviderError<OpenRouterErrorKind> {
  constructor(kind: OpenRouterErrorKind, advice: string, status: number | null = null) {
    super(kind, advice, status)
    this.name = 'OpenRouterError'
  }
}

/** A 400 whose text says the image itself was refused (e.g. Jev's "Invalid image dimensions"). */
function isPhotoComplaint(message: string | null): boolean {
  return message !== null && /\bimage\b/i.test(message)
}

/**
 * A fetch that threw, with no readable response. OpenRouter's errors carry CORS headers, so a thrown
 * fetch is classified unreachable whether or not the browser reports itself online.
 */
export function openRouterFetchFailure(): OpenRouterError {
  return new OpenRouterError(
    'unreachable',
    'Could not reach OpenRouter. Check your connection, then try again.',
  )
}

/** What the messages say about the model: its catalogue display name and longest accepted side. */
export interface FailureModel {
  /** e.g. "Jev latest". */
  name: string
  maxSide: number
}

/**
 * Turns a non-2xx Decisions response into an actionable message, by status. The key is removed from
 * any echoed provider text.
 */
export function openRouterFailure(
  status: number,
  body: unknown,
  apiKey: string,
  model: FailureModel,
): OpenRouterError {
  const detail = providerMessage(body)
  const modelName = model.name
  if (status === 413 || (status === 400 && isPhotoComplaint(detail))) {
    return new OpenRouterError(
      'photo-rejected',
      `${modelName} rejected the photo for its size or dimensions. It takes photos up to ${model.maxSide.toLocaleString('en-US')} px per side. Try another photo.`,
      status,
    )
  }
  switch (classifyFailedCall({ kind: 'status', status }, OPENROUTER_ERROR_TRAITS)) {
    case 'bad-key':
      return new OpenRouterError(
        'bad-key',
        'OpenRouter rejected the key. Check that it is an OpenRouter key (it starts sk-or-) and is still active, then try again. The key is not stored.',
        status,
      )
    case 'no-credit':
      return new OpenRouterError(
        'no-credit',
        'This OpenRouter key is out of credit. Add credit at openrouter.ai/credits, then try again.',
        status,
      )
    case 'not-found':
      return new OpenRouterError(
        'not-found',
        `OpenRouter does not offer ${modelName} to this key right now. Choose another model, then try again.`,
        status,
      )
    case 'rate-limited':
      return new OpenRouterError(
        'rate-limited',
        'OpenRouter rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
        status,
      )
    case 'unavailable':
      return new OpenRouterError(
        'unavailable',
        `OpenRouter or ${modelName}'s provider is unavailable right now. Try again shortly.`,
        status,
      )
    default:
      return new OpenRouterError(
        'rejected',
        detail
          ? `OpenRouter rejected the request (${status}): ${redact(detail, apiKey)}`
          : `OpenRouter rejected the request (${status}). Check the photo and model, then try again.`,
        status,
      )
  }
}

/**
 * Maps a Decisions response for the Jev question set onto the shared container-ID reading, by meaning.
 * The answer formats are those of System One, so the Jev mapping is reused. The resolved model the
 * response reports (e.g. typesafe/jev-1.14-20261014) and usage.cost are read from the response.
 */
export function mapOpenRouterJevResponse(response: unknown, requestedModel: string): JevMapping {
  try {
    return mapJevResponse(response, requestedModel, 'OpenRouter')
  } catch (error) {
    if (error instanceof JevError) throw new OpenRouterError('bad-response', error.advice)
    throw error
  }
}

export interface OpenRouterLunaMapping extends LunaMapping {
  /** Cost from the response's own usage.cost, or null. Never zero when absent. */
  reportedCostUsd: number | null
}

/** Reads an OpenRouter Decisions reply by meaning, with OpenRouter's wording for a reply it cannot read. */
export function readOpenRouterReply(
  response: unknown,
  set: SharedQuestionSet,
  requestedModel: string,
): AnswersReading {
  try {
    return readAnswers('openrouter-decisions', response, set, requestedModel)
  } catch (error) {
    if (error instanceof UnreadableReplyError) {
      throw new OpenRouterError(
        'bad-response',
        error.kind === 'no-answers'
          ? 'OpenRouter replied without answers. Try again.'
          : 'OpenRouter replied in a shape the app does not recognise.',
      )
    }
    throw error
  }
}

/**
 * Maps a Decisions response for the Luna ID set onto the shared container-ID reading, by meaning, with
 * the same reading rules as the direct route: the same answers give the same record on either route.
 * The resolved model and usage.cost come from the response.
 */
export function mapOpenRouterLunaResponse(
  response: unknown,
  requestedModel: string,
  positions?: number[],
): OpenRouterLunaMapping {
  const reply = readOpenRouterReply(response, lunaIdQuestionSet(positions), requestedModel)
  return { ...lunaMappingOf(reply, positions), reportedCostUsd: reply.reportedCostUsd }
}

export interface OpenRouterManifestMapping extends ManifestMapping {
  /** Cost from the response's own usage.cost, or null. Never zero when absent. */
  reportedCostUsd: number | null
}

/** Maps a Decisions response for the manifest check, on any OpenRouter model. */
export function mapOpenRouterManifestResponse(
  response: unknown,
  requestedModel: string,
  questions: ManifestQuestion[],
): OpenRouterManifestMapping {
  const reply = readOpenRouterReply(response, manifestQuestionSet(questions), requestedModel)
  return { ...manifestMappingOf(reply, questions), reportedCostUsd: reply.reportedCostUsd }
}
