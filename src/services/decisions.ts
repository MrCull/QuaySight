// What the OpenAI and OpenRouter Decisions clients share: the photo as a base64 data URL, and one POST
// with the key in the Authorization header only. Each client keeps its own error wording.

/** The photo's bytes as a base64 data URL, in chunks so a large photo does not overflow the argument limit. */
export async function photoDataUrl(photo: Blob): Promise<string> {
  const bytes = new Uint8Array(await photo.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${photo.type};base64,${btoa(binary)}`
}

export interface DecisionsPost {
  endpoint: string
  /** Sent only in the Authorization header. */
  apiKey: string
  /** Extra headers that carry nothing secret, e.g. OpenRouter's attribution headers. */
  headers?: Record<string, string>
  request: unknown
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
  /** The error for a fetch that threw. Its own text is never shown: it could echo request details. */
  thrown: () => Error
  /** The error for a readable non-2xx response. */
  failed: (status: number, body: unknown) => Error
}

export interface DecisionsReply {
  latencyMs: number
  /** The response payload as returned. Contains no headers and no key. */
  raw: unknown
}

/** One POST to a Decisions endpoint. No retries: each call is charged. */
export async function postDecisions(post: DecisionsPost): Promise<DecisionsReply> {
  const fetchImpl = post.fetchImpl ?? fetch
  const body = JSON.stringify(post.request)

  const started = Date.now()
  let response: Response
  try {
    response = await fetchImpl(post.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${post.apiKey}`,
        'Content-Type': 'application/json',
        ...post.headers,
      },
      body,
    })
  } catch {
    throw post.thrown()
  }
  const latencyMs = Date.now() - started

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  if (!response.ok) throw post.failed(response.status, parsed)
  return { latencyMs, raw: parsed }
}
