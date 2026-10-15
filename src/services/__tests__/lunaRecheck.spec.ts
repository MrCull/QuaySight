import { describe, it, expect, vi } from 'vitest'
import { callLuna } from '../luna'

// Mocked fetch only. No live call. The key is a test value and is never written anywhere else.
const KEY = 'test-only-key-value-0000'
const photo = new Blob(['not-really-a-jpeg'], { type: 'image/jpeg' })

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('callLuna with a position subset (re-check)', () => {
  it('asks only the requested questions and reads only those positions', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        model: 'gpt-6-luna-20260922',
        answers: [
          {
            type: 'choice',
            name: 'id_char_07',
            choice: '8',
            probabilities: [{ value: '8', probability: 0.95 }],
          },
          {
            type: 'choice',
            name: 'id_char_09',
            choice: '8',
            probabilities: [{ value: '8', probability: 0.95 }],
          },
          {
            type: 'choice',
            name: 'id_char_01',
            choice: 'Z',
            probabilities: [{ value: 'Z', probability: 0.99 }],
          },
        ],
      }),
    )
    const result = await callLuna({ apiKey: KEY, photo, fetchImpl, positions: [7, 9] })

    const init = fetchImpl.mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.questions.map((q: { name: string }) => q.name)).toEqual([
      'id_char_07',
      'id_char_09',
    ])
    expect(String(init.body)).not.toContain(KEY)

    expect(result.readings[6]?.value).toBe('8')
    expect(result.readings[8]?.value).toBe('8')
    expect(result.readings[0]?.value).toBeNull()
  })
})
