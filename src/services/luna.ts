import {
  LUNA_ENDPOINT,
  LUNA_MODEL,
  LunaError,
  buildLunaRequest,
  lunaFailure,
  mapLunaResponse,
  type LunaMapping,
} from '../domain/luna'

export interface CallLunaOptions {
  /** The presenter's OpenAI key. Held by the caller in memory; sent only in the Authorization header to LUNA_ENDPOINT. */
  apiKey: string
  /** The photo as chosen. Its MIME type must be one the endpoint accepts; it is sent as declared. */
  photo: Blob
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface LunaCallResult extends LunaMapping {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:image/')) {
        reject(new LunaError('bad-response', 'Choose a JPEG, PNG or WebP photo to run a live inspection.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new LunaError('bad-response', 'That photo could not be read.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * One live Decisions call for one photo. Throws LunaError with a message fit to show. The key is never
 * placed in the error, the body or any log line.
 */
export async function callLuna(options: CallLunaOptions): Promise<LunaCallResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const imageDataUrl = await blobToDataUrl(options.photo)
  const body = JSON.stringify(buildLunaRequest(imageDataUrl))

  const started = Date.now()
  let response: Response
  try {
    response = await fetchImpl(LUNA_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    })
  } catch {
    throw new LunaError(
      'network',
      'Could not reach OpenAI. Check your connection, then try again.',
    )
  }
  const latencyMs = Date.now() - started

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) throw lunaFailure(response.status, parsed, options.apiKey)

  return { ...mapLunaResponse(parsed, LUNA_MODEL), latencyMs, raw: parsed }
}
