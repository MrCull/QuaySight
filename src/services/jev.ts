import {
  JEV_ENDPOINT,
  JEV_IMAGE_HEADER,
  JEV_IMAGE_REF,
  JevError,
  buildJevRequest,
  jevFailure,
  jevPhotoFormat,
  mapJevResponse,
  type JevMapping,
} from '../domain/jev'

export interface CallJevOptions {
  /** The presenter's TypeSafe key. Held by the caller in memory; sent only in the Authorization header to JEV_ENDPOINT. */
  apiKey: string
  /** The photo as chosen. Must be a JPEG or PNG; Jev takes no other format. */
  photo: Blob
  /** The model as requested (for example jev-latest or jev-1.14.0). Sent as given. */
  model: string
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export interface JevCallResult extends JevMapping {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

/**
 * One live System One call for one photo. The photo goes as a multipart file part referenced from the
 * request's assets map, with the experimental image opt-in header. Throws JevError with a message fit to
 * show. The key is never placed in the error, the body or any log line. No retries: each call is charged.
 */
export async function callJev(options: CallJevOptions): Promise<JevCallResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const format = jevPhotoFormat(options.photo.type)
  if (!format) {
    throw new JevError('photo', 'Jev takes JPEG or PNG photos. Choose a JPEG or PNG to run a live inspection.')
  }

  const form = new FormData()
  form.append(
    'request',
    new Blob([JSON.stringify(buildJevRequest(options.model, format))], { type: 'application/json' }),
  )
  form.append(JEV_IMAGE_REF, options.photo, `${JEV_IMAGE_REF}.${format === 'jpeg' ? 'jpg' : 'png'}`)

  const started = Date.now()
  let response: Response
  try {
    response = await fetchImpl(JEV_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        [JEV_IMAGE_HEADER]: 'true',
      },
      body: form,
    })
  } catch {
    throw new JevError('network', 'Could not reach TypeSafe. Check your connection, then try again.')
  }
  const latencyMs = Date.now() - started

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) throw jevFailure(response.status, parsed, options.apiKey)

  return { ...mapJevResponse(parsed, options.model), latencyMs, raw: parsed }
}
