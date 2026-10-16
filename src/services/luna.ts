import {
  LUNA_ENDPOINT,
  LUNA_MODEL,
  LunaError,
  buildLunaRequest,
  lunaFailure,
  lunaFetchFailure,
  mapLunaResponse,
  type LunaMapping,
} from '../domain/luna'

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

export interface LunaCallResult extends LunaMapping {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

/** The browser's own view of its connection. Treated as online where the browser does not say. */
function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:image/')) {
        reject(
          new LunaError(
            'bad-response',
            'Choose a JPEG, PNG or WebP photo to run a live inspection.',
          ),
        )
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
  const body = JSON.stringify(buildLunaRequest(imageDataUrl, options.positions))

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
    // The thrown error's text is never shown: it says nothing useful and could echo request details.
    throw lunaFetchFailure(browserOnline())
  }
  const latencyMs = Date.now() - started

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) throw lunaFailure(response.status, parsed, options.apiKey)

  return { ...mapLunaResponse(parsed, LUNA_MODEL, options.positions), latencyMs, raw: parsed }
}
