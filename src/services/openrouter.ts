import {
  OPENROUTER_ATTRIBUTION_HEADERS,
  OPENROUTER_ENDPOINT,
  OpenRouterError,
  buildOpenRouterJevRequest,
  buildOpenRouterLunaRequest,
  mapOpenRouterJevResponse,
  mapOpenRouterLunaResponse,
  openRouterFailure,
  openRouterFetchFailure,
  type FailureModel,
  type OpenRouterLunaMapping,
  type OpenRouterRequestBody,
} from '../domain/openrouter'
import type { JevMapping } from '../domain/jev'

interface CallOpenRouterOptions {
  /** The presenter's OpenRouter key. Held by the caller in memory; sent only in the Authorization header to OPENROUTER_ENDPOINT. */
  apiKey: string
  /** The prepared photo: upright, fitted to the model and encoded as JPEG (or PNG). */
  photo: Blob
  /** The OpenRouter model id, e.g. ~typesafe/jev-latest. Sent as given. */
  model: string
  /** What error messages say about the model. */
  describe: FailureModel
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

interface CallTiming {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

export interface OpenRouterCallResult extends JevMapping, CallTiming {}

export interface OpenRouterLunaCallResult extends OpenRouterLunaMapping, CallTiming {}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png'])

/** Base64 of the photo's bytes, in chunks so a large photo does not overflow the argument limit. */
async function toDataUrl(photo: Blob): Promise<string> {
  const bytes = new Uint8Array(await photo.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${photo.type};base64,${btoa(binary)}`
}

/**
 * One Decisions request to OpenRouter. Throws OpenRouterError with a message fit to show. The key is
 * never placed in the error, the body or any log line. No retries: each call is charged.
 */
async function decide(
  options: CallOpenRouterOptions,
  build: (imageDataUrl: string) => OpenRouterRequestBody,
): Promise<CallTiming> {
  const fetchImpl = options.fetchImpl ?? fetch
  if (!ACCEPTED_TYPES.has(options.photo.type)) {
    throw new OpenRouterError(
      'photo',
      `${options.describe.name} takes JPEG or PNG photos. Choose another photo to run a live inspection.`,
    )
  }
  const body = JSON.stringify(build(await toDataUrl(options.photo)))

  const started = Date.now()
  let response: Response
  try {
    response = await fetchImpl(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        ...OPENROUTER_ATTRIBUTION_HEADERS,
      },
      body,
    })
  } catch {
    // The thrown error's text is never shown: it says nothing useful and could echo request details.
    throw openRouterFetchFailure()
  }
  const latencyMs = Date.now() - started

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) {
    throw openRouterFailure(response.status, parsed, options.apiKey, options.describe)
  }
  return { latencyMs, raw: parsed }
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
