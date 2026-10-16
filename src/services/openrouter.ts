import {
  OPENROUTER_ATTRIBUTION_HEADERS,
  OPENROUTER_ENDPOINT,
  OpenRouterError,
  buildOpenRouterJevRequest,
  mapOpenRouterJevResponse,
  openRouterFailure,
  openRouterFetchFailure,
  type FailureModel,
} from '../domain/openrouter'
import type { JevMapping } from '../domain/jev'

export interface CallOpenRouterJevOptions {
  /** The presenter's OpenRouter key. Held by the caller in memory; sent only in the Authorization header to OPENROUTER_ENDPOINT. */
  apiKey: string
  /** The prepared photo: upright, fitted to the model and encoded as JPEG (or PNG). */
  photo: Blob
  /** The OpenRouter model id, e.g. ~typesafe/jev-latest. Sent as given. */
  model: string
  /** Ask the box question. From the catalogue only. */
  box: boolean
  /** What error messages say about the model. */
  describe: FailureModel
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface OpenRouterCallResult extends JevMapping {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

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
 * One live Decisions call through OpenRouter for one photo, with the Jev question set. Throws
 * OpenRouterError with a message fit to show. The key is never placed in the error, the body or any
 * log line. No retries: each call is charged.
 */
export async function callOpenRouterJev(
  options: CallOpenRouterJevOptions,
): Promise<OpenRouterCallResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  if (!ACCEPTED_TYPES.has(options.photo.type)) {
    throw new OpenRouterError(
      'photo',
      `${options.describe.name} takes JPEG or PNG photos. Choose another photo to run a live inspection.`,
    )
  }
  const imageDataUrl = await toDataUrl(options.photo)
  const body = JSON.stringify(
    buildOpenRouterJevRequest(options.model, imageDataUrl, { box: options.box }),
  )

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

  return { ...mapOpenRouterJevResponse(parsed, options.model), latencyMs, raw: parsed }
}
