import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// The browser's decoder and canvas are faked (see services/__mocks__/imageCodec.ts): a fake photo is a blob
// whose text is its upright size. The real codec, EXIF orientation included, is covered in e2e/photoPreparation.spec.ts.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
import lunaSmoke from '../../fixtures/live/luna-smoke.json'

const KEY = 'test-only-key-value-0000'

function fakePhoto(width: number, height: number, type = 'image/jpeg'): Blob {
  return new Blob([`${width}x${height}`], { type })
}

function choosePhoto(store: ReturnType<typeof useInspectionStore>, file: Blob) {
  store.setPhoto({ name: 'rear.jpg', url: 'blob:original', orientation: 'portrait', file })
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jevBody() {
  const answers: Record<string, unknown> = {}
  'APHU6586847'.split('').forEach((ch, i) => {
    answers[`id_char_${String(i + 1).padStart(2, '0')}`] = {
      type: 'choice',
      choice: ch,
      probabilities: { [ch]: 0.95, unreadable: 0.05 },
      confidence: 0.95,
    }
  })
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 1234, output_tokens: 0 },
  }
}

/** The photo in an OpenRouter Jev JSON request, decoded from its data-URL part. */
function jevPhotoSent(init: RequestInit | undefined): { text: string; type: string } {
  const body = JSON.parse(String(init?.body)) as {
    state: [string, { image_url: { url: string } }]
  }
  const [, type = '', data = ''] =
    /^data:([^;]+);base64,(.*)$/.exec(body.state[1].image_url.url) ?? []
  return { text: atob(data), type }
}

/** The photo in a Luna JSON request, decoded from its data URL. */
async function lunaPhotoSent(
  init: RequestInit | undefined,
): Promise<{ text: string; type: string }> {
  const body = JSON.parse(String(init?.body)) as {
    input: Array<{ content: Array<{ type: string; image_url?: string }> }>
  }
  const url = body.input[0]!.content.find((part) => part.type === 'input_image')!.image_url!
  const [, type = '', data = ''] = /^data:([^;]+);base64,(.*)$/.exec(url) ?? []
  return { text: atob(data), type }
}

import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck)
})
afterAll(() => restoreRequests())

describe('photo preparation before a live call', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends Jev through OpenRouter the photo shrunk to 1,568 px on its long side, as a JPEG', async () => {
    fetchMock.mockResolvedValue(jsonResponse(jevBody()))
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(1536, 2048))

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(jevPhotoSent(fetchMock.mock.calls[0]?.[1])).toEqual({
      text: 'jpeg 1176x1568',
      type: 'image/jpeg',
    })
    expect(store.status).toBe('complete')
  })

  it('sends Luna a phone photo shrunk to 2,048 px on its long side, as a JPEG', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(lunaSmoke.response))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(4032, 3024))

    await store.start()

    expect(fetchMock).toHaveBeenCalled()
    for (const [, init] of fetchMock.mock.calls) {
      expect(await lunaPhotoSent(init)).toEqual({ text: 'jpeg 2048x1536', type: 'image/jpeg' })
    }
    expect(store.status).toBe('complete')
  })

  // Decided 16 Oct 2026: an enlarged COYU photo turned Luna's one unread character into misreads, so a
  // whole photo is never enlarged for any model (docs/research/live-api-findings-2026-10-16.md).
  it('never enlarges a photo within the limits, for Luna or for Jev', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(lunaSmoke.response))
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(1079, 1080))

    await store.start()

    for (const [, init] of fetchMock.mock.calls) {
      expect(await lunaPhotoSent(init)).toEqual({ text: 'jpeg 1079x1080', type: 'image/jpeg' })
    }

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(jsonResponse(jevBody()))
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(1079, 1080))

    await store.start()

    expect(jevPhotoSent(fetchMock.mock.calls[0]?.[1])).toEqual({
      text: 'jpeg 1079x1080',
      type: 'image/jpeg',
    })
  })

  it('refuses a photo below the model minimum with a size-specific message, before any request or charge', async () => {
    const store = useInspectionStore()
    const ledger = useLedgerStore()
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(200, 150))

    await store.start()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(ledger.entries()).toHaveLength(0)
    expect(store.status).toBe('failed')
    expect(store.errorMessage).toBe(
      'This photo is 200 × 150 px. Jev latest needs at least 256 px on each side. Choose a larger photo.',
    )
    expect(store.photo?.url).toBe('blob:original')
  })

  it('keeps the chosen photo, not the one sent, as the photo on screen and in the result', async () => {
    fetchMock.mockResolvedValue(jsonResponse(jevBody()))
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    const original = fakePhoto(1536, 2048)
    choosePhoto(store, original)

    await store.start()

    expect(store.photo).toEqual({
      name: 'rear.jpg',
      url: 'blob:original',
      orientation: 'portrait',
      file: original,
    })
    expect(store.photo?.file).toBe(original)
    expect(store.record?.photo).toEqual({ name: 'rear.jpg', orientation: 'portrait' })
  })

  it('refuses a photo too long and narrow to fit, naming its size', async () => {
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setApiKey(KEY)
    choosePhoto(store, fakePhoto(6000, 400))

    await store.start()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.errorMessage).toBe(
      'This photo is 6000 × 400 px, too long and narrow for Jev latest: shrunk to 1568 px on its long side, its short side would be under 256 px. Crop it closer to the container, then try again.',
    )
  })
})
