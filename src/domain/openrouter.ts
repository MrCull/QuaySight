// OpenRouter Decisions adapter (spec #16, ticket #22; docs/adr/0001). Pure functions: no fetch, no storage.
// Request and response shapes, model ids, image limits, CORS and error bodies were checked live on
// 16 October 2026; see docs/research/live-api-findings-2026-10-16.md.
//
// One JSON body: `state` holds an instruction text part and the photo as a base64 data-URL part;
// `questions` is a map of typed questions (noul, choice, score, box). OpenRouter's errors carry CORS
// headers, so every failed status is readable in the browser and gets its own message.
import { classifyFailedCall, type ProviderErrorTraits } from './failedCall'
import { JevError, jevQuestions, mapJevResponse, type JevMapping, type JevQuestion } from './jev'
import {
  LUNA_IDENTIFICATION_INSTRUCTIONS,
  buildIdQuestions,
  mapLunaManifestResponse,
  mapLunaResponse,
  type LunaMapping,
  type ManifestMapping,
} from './luna'
import { MANIFEST_STATE_INSTRUCTIONS, type ManifestQuestion } from './manifest'

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

export interface OpenRouterImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface OpenRouterRequestBody {
  model: string
  state: [string, OpenRouterImagePart]
  /** OpenRouter's question format: the same noul, choice (criteria map), score (criteria list) and box types Jev uses. */
  questions: Record<string, JevQuestion>
}

/** The text part sent ahead of the photo. */
export const JEV_STATE_INSTRUCTIONS =
  'Freight container photo. Judge only what is visible in the photo. Answer every question about this one photo.'

/**
 * The request for one photo on a Jev model. The key is never part of the body. The box question is
 * asked only when the catalogue declares the model box-capable (the caller passes that flag).
 */
export function buildOpenRouterJevRequest(
  model: string,
  imageDataUrl: string,
  options: { box: boolean },
): OpenRouterRequestBody {
  return {
    model,
    state: [JEV_STATE_INSTRUCTIONS, { type: 'image_url', image_url: { url: imageDataUrl } }],
    questions: jevQuestions({ image: 'the photo', box: options.box }),
  }
}

/**
 * The request for one photo on a Luna Decisions model (ticket #23). The Luna question set is reused as
 * it is, check-digit guidance included: its instruction text goes ahead of the photo, and each
 * position question is translated from OpenAI's choice array into OpenRouter's criteria map. Luna
 * takes no box question. With positions, only those (1-based) are asked, as for the direct re-check.
 */
export function buildOpenRouterLunaRequest(
  model: string,
  imageDataUrl: string,
  positions?: number[],
): OpenRouterRequestBody {
  const questions: Record<string, JevQuestion> = {}
  for (const question of buildIdQuestions(positions)) {
    questions[question.name] = {
      type: 'choice',
      instructions: question.instructions,
      criteria: Object.fromEntries(question.choices.map((c) => [c.value, c.description])),
    }
  }
  return {
    model,
    state: [
      LUNA_IDENTIFICATION_INSTRUCTIONS,
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
    questions,
  }
}

/**
 * The manifest check for one photo on any OpenRouter Decisions model (spec 3.2): the pasted entries
 * as choice questions, each with "not listed", translated into OpenRouter's criteria map. The same
 * request shape for Jev and Luna Decisions models; no box question.
 */
export function buildOpenRouterManifestRequest(
  model: string,
  imageDataUrl: string,
  questions: ManifestQuestion[],
): OpenRouterRequestBody {
  const asked: Record<string, JevQuestion> = {}
  for (const question of questions) {
    asked[question.name] = {
      type: 'choice',
      instructions: question.instructions,
      criteria: Object.fromEntries(question.options.map((o) => [o.value, o.description])),
    }
  }
  return {
    model,
    state: [MANIFEST_STATE_INSTRUCTIONS, { type: 'image_url', image_url: { url: imageDataUrl } }],
    questions: asked,
  }
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

/** An error with a message fit to show the presenter. Never carries the key. */
export class OpenRouterError extends Error {
  readonly kind: OpenRouterErrorKind
  readonly status: number | null

  constructor(kind: OpenRouterErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'OpenRouterError'
    this.kind = kind
    this.status = status
  }
}

const KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g

function redact(text: string, apiKey: string): string {
  let safe = text
  if (apiKey) safe = safe.split(apiKey).join('[key removed]')
  return safe.replace(KEY_PATTERN, '[key removed]').slice(0, 200)
}

function providerMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
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
    'Could not reach OpenRouter. Check your connection, then try again. Any partial result is kept.',
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
      `${modelName} rejected the photo for its size or dimensions. It takes photos up to ${model.maxSide.toLocaleString('en-US')} px per side. Try another photo. Any partial result is kept.`,
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
        'This OpenRouter key is out of credit. Add credit at openrouter.ai/credits, then try again. Any partial result is kept.',
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
        `OpenRouter or ${modelName}'s provider is unavailable right now. Try again shortly. Any partial result is kept.`,
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
    if (error instanceof JevError) throw new OpenRouterError('bad-response', error.message)
    throw error
  }
}

export interface OpenRouterLunaMapping extends LunaMapping {
  /** Cost from the response's own usage.cost, or null. Never zero when absent. */
  reportedCostUsd: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readCost(usage: unknown): number | null {
  const cost = asRecord(usage)?.cost
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : null
}

/**
 * Maps a Decisions response for the Luna question set onto the shared container-ID reading. OpenRouter's
 * answers (a map by question name, probabilities a map by option) are translated into OpenAI's shape
 * (an array of named answers, probabilities a list) and read by the direct Luna mapping, so the same
 * answers give the same record on either route. The resolved model and usage.cost come from the response.
 */
export function mapOpenRouterLunaResponse(
  response: unknown,
  requestedModel: string,
  positions?: number[],
): OpenRouterLunaMapping {
  const { body, translated } = toOpenAiShape(response)
  return {
    ...mapLunaResponse(translated, requestedModel, positions),
    reportedCostUsd: readCost(body.usage),
  }
}

/**
 * OpenRouter's answers (a map by question name, probabilities a map by option) in OpenAI's shape (a
 * list of named answers, probabilities a list), so the direct Luna mappings read either route alike.
 */
function toOpenAiShape(response: unknown): {
  body: Record<string, unknown>
  translated: Record<string, unknown>
} {
  const body = asRecord(response)
  if (!body) {
    throw new OpenRouterError(
      'bad-response',
      'OpenRouter replied in a shape the app does not recognise.',
    )
  }
  const answers = asRecord(body.answers)
  if (!answers)
    throw new OpenRouterError('bad-response', 'OpenRouter replied without answers. Try again.')

  const list = Object.entries(answers).map(([name, answer]) => {
    const record = asRecord(answer) ?? {}
    const probabilities = asRecord(record.probabilities)
    return {
      ...record,
      name,
      probabilities: probabilities
        ? Object.entries(probabilities).map(([value, probability]) => ({ value, probability }))
        : [],
    }
  })
  return { body, translated: { ...body, answers: list } }
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
  const { body, translated } = toOpenAiShape(response)
  return {
    ...mapLunaManifestResponse(translated, requestedModel, questions),
    reportedCostUsd: readCost(body.usage),
  }
}
