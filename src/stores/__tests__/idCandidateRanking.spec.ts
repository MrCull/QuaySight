import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { buildSummaryText } from '../../domain/exports'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'

// Ticket #42: the 4th letter is U, and a reading that passes the check digit ranks first.
const KEY = 'test-only-openrouter-key-0000'
const MODEL = 'openai/gpt-6-luna-decisions'
const CHECK_DIGIT_ALGORITHM = /modulo|remainder|A=10|multiply/i

type Probabilities = Record<string, number>

const questionName = (position: number) => `id_char_${String(position).padStart(2, '0')}`

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenRouter Luna Decisions reply that reads `id`, with the given positions (1-based) overridden. */
function lunaReply(id: string, at: Record<number, Probabilities> = {}) {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    const p = at[i + 1] ?? { [ch]: 0.97, [i < 4 ? 'Z' : ch === '9' ? '8' : '9']: 0.03 }
    const choice = Object.entries(p).sort((a, b) => b[1] - a[1])[0]![0]
    answers[questionName(i + 1)] = { type: 'choice', choice, probabilities: p, confidence: 0.9 }
  })
  return { model: 'openai/gpt-6-luna-decisions-20261006', answers, usage: { cost: 0.0003 } }
}

let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck)
})
afterAll(() => restoreRequests())

describe('container ID candidates through a live Luna run', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function run(reply: unknown) {
    fetchMock.mockResolvedValue(json(reply))
    const store = useInspectionStore()
    store.setProvider('openrouter')
    store.setModel(MODEL)
    store.setApiKey(KEY)
    store.setPhoto({
      name: 'coyu.jpg',
      url: 'blob:coyu',
      orientation: 'portrait',
      file: new Blob(['3072x4096'], { type: 'image/jpeg' }),
    })
    await store.start()
    return store
  }

  // The 16 Oct 2026 sample: Luna read COUU 266813 0, with Y as the runner-up for the third letter.
  const COUU = { 3: { U: 0.7, Y: 0.25, V: 0.05 } }

  it('tells the model the 4th letter is U, without the check-digit calculation', async () => {
    await run(lunaReply('COYU2668130'))

    const raw = String(fetchMock.mock.calls[0]![1]?.body)
    const body = JSON.parse(raw) as { state: [string] }
    expect(body.state[0]).toContain('fourth letter of the four-letter group is always U')
    expect(raw).not.toMatch(CHECK_DIGIT_ALGORITHM)
  })

  it('ranks COYU 266813 0 first because its check digit passes, and hides COUU, whose check digit fails (#79)', async () => {
    const store = await run(lunaReply('COUU2668130', COUU))

    const reading = store.record!.containerId!
    expect(reading).toMatchObject({
      value: 'COYU2668130',
      checkDigitValid: true,
      calculatedCheckDigit: 0,
    })
    // The swapped letter was only a weak reading, so this is not Confident; COUU fails the check digit and is never shown.
    expect(reading.certainty).not.toBe('Confident')
    expect(reading.alternatives).toBeUndefined()
    expect(buildSummaryText(store.record!)).not.toContain('Also possible')
  })

  it('shows U in the 4th place whatever comes back', async () => {
    const store = await run(lunaReply('COYX2668130', { 4: { X: 0.97, U: 0.03 } }))

    expect(store.record!.containerId).toMatchObject({ value: 'COYU2668130', checkDigitValid: true })
  })

  it('offers no alternatives when nothing passes the check digit', async () => {
    // Check digit 5 fails for COUU and for COYU alike.
    const store = await run(lunaReply('COUU2668135', COUU))

    const reading = store.record!.containerId!
    expect(reading).toMatchObject({ value: 'COUU2668135', checkDigitValid: false })
    expect(reading.alternatives).toBeUndefined()
  })
})
