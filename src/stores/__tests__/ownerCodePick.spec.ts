import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../inspection'
import { OFFERED_OWNER_CODES } from '../../domain/ownerCodes'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'

// Ticket #43: one whole-prefix question over the common owner codes, combined with the letter readings.
// The 16 Oct 2026 CAXU sample: Luna read CXXX 6.2211 9 and Jev read CAXU 692110 9.
const KEY = 'test-only-openrouter-key-0000'
const MODEL = 'openai/gpt-6-luna-decisions'

const questionName = (position: number) => `id_char_${String(position).padStart(2, '0')}`

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenRouter Luna reply that reads `id` letter by letter and answers the owner-code question. */
function lunaReply(id: string, owner?: { choice: string; probability: number }) {
  const answers: Record<string, unknown> = {}
  id.split('').forEach((ch, i) => {
    const p = { [ch]: 0.97, [i < 4 ? 'Z' : ch === '9' ? '8' : '9']: 0.03 }
    answers[questionName(i + 1)] = { type: 'choice', choice: ch, probabilities: p, confidence: 0.9 }
  })
  if (owner) {
    answers.owner_code = {
      type: 'choice',
      choice: owner.choice,
      probabilities: { [owner.choice]: owner.probability, other: 1 - owner.probability },
      confidence: owner.probability,
    }
  }
  return { model: 'openai/gpt-6-luna-decisions-20261006', answers, usage: { cost: 0.0003 } }
}

let restoreRequests = () => {}
beforeAll(() => {
  restoreRequests = onlyRequests(survey, idRecheck)
})
afterAll(() => restoreRequests())

describe('owner code picked from the list, through a live Luna run', () => {
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
      name: 'caxu.jpg',
      url: 'blob:caxu',
      orientation: 'portrait',
      file: new Blob(['3072x4096'], { type: 'image/jpeg' }),
    })
    await store.start()
    return store
  }

  it('asks the whole-prefix question with the list and "none of these"', async () => {
    await run(lunaReply('CAXU6921109'))

    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)) as {
      questions: Record<string, { instructions: string; criteria: Record<string, unknown> }>
    }
    const ask = body.questions.owner_code!
    expect(ask.instructions).toContain('owner code')
    expect(Object.keys(ask.criteria)).toEqual(['none', ...OFFERED_OWNER_CODES])
  })

  it('uses a Likely-or-better list pick as the owner code over the letters', async () => {
    // The letters read CXXU; the list pick CAXU passes the check digit.
    const store = await run(lunaReply('CXXU6921109', { choice: 'CAXU', probability: 0.95 }))

    expect(store.record!.containerId).toMatchObject({
      value: 'CAXU6921109',
      checkDigitValid: true,
      certainty: 'Confident',
    })
  })

  it('falls back to the letters when the model picks "none of these"', async () => {
    const store = await run(lunaReply('CMAU6921100', { choice: 'none', probability: 0.9 }))

    expect(store.record!.containerId).toMatchObject({ value: 'CMAU6921100' })
  })

  it('falls back to the letters when the list pick is not confident', async () => {
    // Neither CMAU nor CAXU passes with check digit 5: the letters stand, and no failing ID is offered.
    const store = await run(lunaReply('CMAU6921105', { choice: 'CAXU', probability: 0.4 }))

    const reading = store.record!.containerId!
    expect(reading.value).toBe('CMAU6921105')
    expect(reading.alternatives).toBeUndefined()
  })

  it('never shows the losing reading as "Also possible" when it fails the check digit', async () => {
    const store = await run(lunaReply('CXXU6921105', { choice: 'CAXU', probability: 0.95 }))

    const reading = store.record!.containerId!
    expect(reading.value).toBe('CAXU6921105')
    expect(reading.certainty).toBe('Uncertain')
    expect(reading.alternatives).toBeUndefined()
  })

  it('hides the disagreement when only the list pick passes the check digit', async () => {
    // A Likely pick on the list with every other character Confident: every character is at least Likely.
    const store = await run(lunaReply('CXXU6921109', { choice: 'CAXU', probability: 0.8 }))

    const reading = store.record!.containerId!
    expect(reading).toMatchObject({ value: 'CAXU6921109', certainty: 'Confident' })
    expect(reading.alternatives).toBeUndefined()
  })

  it('trusts a letter reading less when its fourth letter was not U', async () => {
    const store = await run(lunaReply('CAXX6921105', { choice: 'CMAU', probability: 0.4 }))

    const reading = store.record!.containerId!
    expect(reading.value).toBe('CAXU6921105')
    expect(reading.certainty).not.toBe('Confident')
    expect(reading.alternatives).toBeUndefined()
  })
})
