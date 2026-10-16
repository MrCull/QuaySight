import {
  LUNA_ENDPOINT,
  LUNA_MODEL,
  LunaError,
  buildLunaManifestRequest,
  buildLunaRequest,
  lunaFailure,
  lunaFetchFailure,
  mapLunaManifestResponse,
  mapLunaResponse,
  type LunaMapping,
  type ManifestMapping,
} from '../domain/luna'
import type { ManifestQuestion } from '../domain/manifest'
import { photoDataUrl, postDecisions, type DecisionsReply } from './decisions'

export interface CallLunaOptions {
  /** The presenter's OpenAI key. Held by the caller in memory; sent only in the Authorization header to LUNA_ENDPOINT. */
  apiKey: string
  /** The photo as chosen. Its MIME type must be one the endpoint accepts; it is sent as declared. */
  photo: Blob
  /** 1-based positions to ask. Omitted for the first pass (all eleven); the re-check passes only its unread positions. */
  positions?: number[]
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface LunaCallResult extends LunaMapping, DecisionsReply {}

/** The browser's own view of its connection. Treated as online where the browser does not say. */
function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/** The photo as a data URL. A file that is not an image, or cannot be read, is refused before any request. */
async function lunaPhoto(photo: Blob): Promise<string> {
  if (!photo.type.startsWith('image/')) {
    throw new LunaError(
      'bad-response',
      'Choose a JPEG, PNG or WebP photo to run a live inspection.',
    )
  }
  try {
    return await photoDataUrl(photo)
  } catch {
    throw new LunaError('bad-response', 'That photo could not be read.')
  }
}

/**
 * One live Decisions call for one photo. Throws LunaError with a message fit to show. The key is never
 * placed in the error, the body or any log line.
 */
export async function callLuna(options: CallLunaOptions): Promise<LunaCallResult> {
  const imageDataUrl = await lunaPhoto(options.photo)
  const done = await decide(options, buildLunaRequest(imageDataUrl, options.positions))
  return { ...mapLunaResponse(done.raw, LUNA_MODEL, options.positions), ...done }
}

export interface CallLunaManifestOptions {
  /** The presenter's OpenAI key; sent only in the Authorization header to LUNA_ENDPOINT. */
  apiKey: string
  /** The photo as sent for the first reading. */
  photo: Blob
  /** The manifest check's questions, from buildManifestQuestions. */
  questions: ManifestQuestion[]
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface LunaManifestCallResult extends ManifestMapping, DecisionsReply {}

/** One live manifest check on GPT-6 Luna (spec 3.2). Fails with the same messages as the first reading. */
export async function callLunaManifest(
  options: CallLunaManifestOptions,
): Promise<LunaManifestCallResult> {
  const imageDataUrl = await lunaPhoto(options.photo)
  const done = await decide(options, buildLunaManifestRequest(imageDataUrl, options.questions))
  return { ...mapLunaManifestResponse(done.raw, LUNA_MODEL, options.questions), ...done }
}

/** One POST to OpenAI's Decisions endpoint, with OpenAI's error wording. No retries: each call is charged. */
function decide(
  options: { apiKey: string; fetchImpl?: typeof fetch },
  request: unknown,
): Promise<DecisionsReply> {
  return postDecisions({
    endpoint: LUNA_ENDPOINT,
    apiKey: options.apiKey,
    request,
    fetchImpl: options.fetchImpl,
    thrown: () => lunaFetchFailure(browserOnline()),
    failed: (status, body) => lunaFailure(status, body, options.apiKey),
  })
}
