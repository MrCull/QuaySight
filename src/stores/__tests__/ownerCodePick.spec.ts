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
const KEY = 'test-only-openai-key-0000'

const questionName = (position: number) => `id_char_${String(position).padStart(2, '0')}`

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An OpenAI Luna reply that reads `id` letter by letter and answers the owner-code question. */
function lunaReply(id: string, owner?: { choice: string; probability: number }) {
  const answers: unknown[] = id.split('').map((ch, i) => ({
    type: 'choice',
    name: questionName(i + 1),
    choice: ch,
    probabilities: [
      { value: ch, probability: 0.97 },
      { value: i < 4 ? 'Z' : ch === '9' ? '8' : '9', probability: 0.03 },
    ],
  }))
  if (owner) {
    answers.push({
      type: 'choice',
      name: 'owner_code',
      choice: owner.choice,
      probabilities: [
        { value: owner.choice, probability: owner.probability },
        { value: 'other', probability: 1 - owner.probability },
      ],
    })
  }
  return { model: 'gpt-6-luna', answers, usage: { input_tokens: 6200, output_tokens: 0 } }
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
    store.setProvider('luna')
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
      questions: { name: string; instructions: string; choices: { value: string }[] }[]
    }
    const ask = body.questions.find((q) => q.name === 'owner_code')!
    expect(ask.instructions).toContain('owner code')
    expect(ask.choices.map((c) => c.value)).toEqual(['none', ...OFFERED_OWNER_CODES])
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
