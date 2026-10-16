import {
  OPENROUTER_ATTRIBUTION_HEADERS,
  OPENROUTER_ENDPOINT,
  OpenRouterError,
  buildOpenRouterJevRequest,
  buildOpenRouterLunaRequest,
  buildOpenRouterManifestRequest,
  mapOpenRouterJevResponse,
  mapOpenRouterLunaResponse,
  mapOpenRouterManifestResponse,
  openRouterFailure,
  openRouterFetchFailure,
  type FailureModel,
  type OpenRouterLunaMapping,
  type OpenRouterManifestMapping,
  type OpenRouterRequestBody,
} from '../domain/openrouter'
import type { JevMapping } from '../domain/jev'
import type { ManifestQuestion } from '../domain/manifest'
import { photoDataUrl, postDecisions, type DecisionsReply } from './decisions'

interface CallOpenRouterOptions {
  /** The presenter's OpenRouter key. Held by the caller in memory; sent only in the Authorization header to OPENROUTER_ENDPOINT. */
  apiKey: string
  /** The prepared photo: upright, fitted to the model and encoded as JPEG (or PNG). */
  photo: Blob
  /** The OpenRouter model id, e.g. ~typesafe/jev-latest. Sent as given. */
  model: string
  /** What error messages say about the model. */
  describe: FailureModel
  /** Aborts the call in flight. */
  signal?: AbortSignal
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface CallOpenRouterJevOptions extends CallOpenRouterOptions {
  /** Ask the box question. From the catalogue only. */
  box: boolean
}

export interface CallOpenRouterLunaOptions extends CallOpenRouterOptions {
  /** 1-based positions to ask. Omitted for the first pass (all eleven); the re-check passes only its unread positions. */
  positions?: number[]
}

type CallTiming = DecisionsReply

export interface OpenRouterCallResult extends JevMapping, CallTiming {}

export interface OpenRouterLunaCallResult extends OpenRouterLunaMapping, CallTiming {}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png'])

/**
 * One Decisions request to OpenRouter. Throws OpenRouterError with a message fit to show. The key is
 * never placed in the error, the body or any log line. No retries: each call is charged.
 */
async function decide(
  options: CallOpenRouterOptions,
  build: (imageDataUrl: string) => OpenRouterRequestBody,
): Promise<CallTiming> {
  if (!ACCEPTED_TYPES.has(options.photo.type)) {
    throw new OpenRouterError(
      'photo',
      `${options.describe.name} takes JPEG or PNG photos. Choose another photo to run a live inspection.`,
    )
  }
  return postDecisions({
    endpoint: OPENROUTER_ENDPOINT,
    apiKey: options.apiKey,
    headers: OPENROUTER_ATTRIBUTION_HEADERS,
    request: build(await photoDataUrl(options.photo)),
    fetchImpl: options.fetchImpl,
    signal: options.signal,
    // OpenRouter's errors carry CORS headers, so a thrown fetch is unreachable, online or not.
    thrown: () => openRouterFetchFailure(),
    failed: (status, body) => openRouterFailure(status, body, options.apiKey, options.describe),
  })
}

/** One live Decisions call through OpenRouter for one photo, with the Jev question set. */
export async function callOpenRouterJev(
  options: CallOpenRouterJevOptions,
): Promise<OpenRouterCallResult> {
  const done = await decide(options, (image) =>
    buildOpenRouterJevRequest(options.model, image, { box: options.box }),
  )
  return { ...mapOpenRouterJevResponse(done.raw, options.model), ...done }
}

export interface CallOpenRouterManifestOptions extends CallOpenRouterOptions {
  /** The manifest check's questions, from buildManifestQuestions. */
  questions: ManifestQuestion[]
}

export interface OpenRouterManifestCallResult extends OpenRouterManifestMapping, CallTiming {}

/** One live manifest check through OpenRouter (spec 3.2), on the model of the first reading. */
export async function callOpenRouterManifest(
  options: CallOpenRouterManifestOptions,
): Promise<OpenRouterManifestCallResult> {
  const done = await decide(options, (image) =>
    buildOpenRouterManifestRequest(options.model, image, options.questions),
  )
  return {
    ...mapOpenRouterManifestResponse(done.raw, options.model, options.questions),
    ...done,
  }
}

/**
 * One live Decisions call through OpenRouter for one photo, with the Luna question set (ticket #23).
 * With positions, only those are asked and read, as for the direct Luna re-check.
 */
export async function callOpenRouterLuna(
  options: CallOpenRouterLunaOptions,
): Promise<OpenRouterLunaCallResult> {
  const done = await decide(options, (image) =>
    buildOpenRouterLunaRequest(options.model, image, options.positions),
  )
  return {
    ...mapOpenRouterLunaResponse(done.raw, options.model, options.positions),
    ...done,
  }
}
