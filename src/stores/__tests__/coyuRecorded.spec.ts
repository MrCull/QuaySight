import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// jsdom has no image decoder. The COYU photo is 1079 × 1080, within every model's limits, so the
// stand-in decoder reports that size and "re-encodes" it as the same bytes. A crop is described in text.
vi.mock('../../services/imageCodec', () => ({
  decodePhoto: async (blob: Blob) => ({
    width: 1079,
    height: 1080,
    toJpeg: async () => blob,
    toJpegRegion: async (
      r: { x: number; y: number; width: number; height: number },
      w: number,
      h: number,
    ) =>
      new Blob([`crop ${w}x${h} from ${r.width}x${r.height} at ${r.x},${r.y}`], {
        type: 'image/jpeg',
      }),
    toJpegMarked: async (w: number, h: number) =>
      new Blob([`marked ${w}x${h}`], { type: 'image/jpeg' }),
    close: () => {},
  }),
}))

import { useInspectionStore } from '../inspection'
import { useLedgerStore } from '../ledger'
// Real replies to the group-position ID questions on samples/rear-door-coyu-22g1.jpg, recorded live on
// 16 Oct 2026 by src/services/__tests__/coyu.live.spec.ts, with no key or headers.
import lunaCoyu from '../../fixtures/live/coyu-luna.json'
import openRouterLunaCoyu from '../../fixtures/live/coyu-openrouter-luna.json'
import jevCoyu from '../../fixtures/live/coyu-openrouter-jev.json'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const COYU_BYTES = readFileSync(resolve(root, 'samples/rear-door-coyu-22g1.jpg'))
const OPENAI_KEY = 'test-only-openai-key-0000'
const OPENROUTER_KEY = 'test-only-openrouter-key-0000'
const CHECK_DIGIT_ALGORITHM = /modulo|remainder|A=10|multiply/i

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function chooseCoyu(store: ReturnType<typeof useInspectionStore>) {
  store.setPhoto({
    name: 'rear-door-coyu-22g1.jpg',
    url: 'blob:coyu',
    orientation: 'square',
    file: new Blob([COYU_BYTES], { type: 'image/jpeg' }),
  })
}

function sentBody(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, call: number): string {
  return String(fetchMock.mock.calls[call]![1]?.body)
}

/** The positions read as a character other than COYU 266813 0's. */
function misread(value: string): number[] {
  return [...value].flatMap((ch, i) => (ch !== '?' && ch !== 'COYU2668130'[i] ? [i + 1] : []))
}

import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'
import { idCropRead } from '../../plan/requests/idCropRead'
import { regions } from '../../plan/requests/regions'

// This spec covers the ID requests; the other parts of a run (damage, …) have their own specs.
let restoreRequests = () => {}
beforeEach(() => {
  restoreRequests = onlyRequests(survey, idRecheck, idCropRead)
})
afterEach(() => restoreRequests())

describe('COYU 266813 0 through the store, from recorded replies', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Jev latest through OpenRouter reads COYU 266813 0 with a valid check digit, from the full photo and a crop of the numbered regions that hold the ID', async () => {
    // The ID request is made with the numbered-regions request beside it (ticket #84).
    restoreRequests()
    restoreRequests = onlyRequests(survey, regions, idRecheck, idCropRead)
    const marks = { id_mark: '3', id_mark_2: '4' }
    const regionsReply = {
      model: 'typesafe/jev-1.14-20261014',
      answers: Object.fromEntries(
        Object.entries(marks).map(([name, mark]) => [
          name,
          { type: 'choice', choice: mark, probabilities: { [mark]: 0.8 }, confidence: 0.8 },
        ]),
      ),
    }
    fetchMock.mockImplementation((_input, init) => {
      const body = String(init?.body)
      return Promise.resolve(
        json(
          body.includes('id_mark')
            ? regionsReply
            : body.includes('container_box')
              ? jevCoyu.response
              : jevCoyu.crop.response,
        ),
      )
    })
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel('~typesafe/jev-latest')
    store.setApiKey(OPENROUTER_KEY)
    chooseCoyu(store)

    await store.start()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const body = JSON.parse(sentBody(fetchMock, 0)) as {
      state: [string, { image_url: { url: string } }]
      questions: Record<string, { type: string; instructions: string }>
    }
    expect(body.state[1].image_url.url).toBe(
      `data:image/jpeg;base64,${COYU_BYTES.toString('base64')}`,
    )
    expect(body.questions.id_char_07?.instructions).toContain(
      'Read only the third digit of the six-digit group',
    )
    expect(body.questions.container_box).toMatchObject({ type: 'box' })
    expect(sentBody(fetchMock, 0)).not.toMatch(CHECK_DIGIT_ALGORITHM)

    expect(store.status).toBe('complete')
    expect(store.record?.containerId).toMatchObject({
      value: 'COYU2668130',
      calculatedCheckDigit: 0,
      checkDigitValid: true,
    })
    expect(store.manifestRetryOffered).toBe(false)

    // The zoomed read: marks 3 and 4 hold the area x 0.5 to 1, y 0 to 0.25 of the 1079 x 1080 px photo; with a
    // 0.25 margin that is 675 x 405 px at 404,0, scaled to Jev's 1,568 px side.
    const crop = JSON.parse(sentBody(fetchMock, 2)) as typeof body
    expect(atob(crop.state[1].image_url.url.split(',')[1]!)).toBe(
      'crop 1568x940 from 675x405 at 404,0',
    )
    expect(crop.questions.container_box).toBeUndefined()
    expect(store.record?.idCropRead).toMatchObject({ outcome: 'combined', disagreements: [] })
    expect(useLedgerStore().entries()).toEqual([
      expect.objectContaining({ costUsd: 0.00028455, costState: 'reported' }),
      expect.objectContaining({ purpose: 'Locating the markings' }),
      expect.objectContaining({
        purpose: 'Reading the ID up close',
        costUsd: 0.000311178,
        costState: 'reported',
      }),
    ])
  })

  it.each([
    ['GPT-6 Luna on OpenAI', 'luna', 'gpt-6-luna', OPENAI_KEY, lunaCoyu],
    [
      'GPT-6 Luna Decisions through OpenRouter',
      'openrouter',
      'openai/gpt-6-luna-decisions',
      OPENROUTER_KEY,
      openRouterLunaCoyu,
    ],
  ] as const)(
    '%s never misreads it: the digit it cannot settle stays unread after the re-check, and the manifest check is offered',
    async (_route, provider, model, key, fixture) => {
      fetchMock
        .mockResolvedValueOnce(json(fixture.response))
        .mockResolvedValueOnce(json(fixture.recheck.response))
      const store = useInspectionStore()
      store.setProvider(provider)
      store.setModel(model)
      store.setApiKey(key)
      chooseCoyu(store)

      await store.start()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(sentBody(fetchMock, 0)).not.toMatch(CHECK_DIGIT_ALGORITHM)
      expect(sentBody(fetchMock, 0)).toContain(COYU_BYTES.toString('base64'))
      expect(store.status).toBe('complete')
      const reading = store.record!.containerId!
      expect(reading.value).toBe('COYU2?68130')
      expect(misread(reading.value)).toEqual([])
      expect(reading.checkDigitValid).toBe(false)
      expect(store.record?.rechecks).toEqual([
        expect.objectContaining({ positions: [6], outcome: 'unchanged' }),
      ])
      expect(store.manifestRetryOffered).toBe(true)
      expect(useLedgerStore().entries()).toHaveLength(2)
    },
  )
})
