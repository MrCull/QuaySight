import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHIPPED_RECORDINGS } from '../demoRecordings'
import { parsePlanRecording, preSurveyRecording } from '../../plan/recording'
import { planRequests } from '../../plan/registry'
import { replayRecording } from '../../plan/replay'
import lunaSmoke from '../live/luna-smoke.json'
import jevSmoke from '../live/openrouter-jev-smoke.json'

// The recordings the demo can replay (spec #27, ticket #37): each is a real model's answer for its own
// photo, whole and readable by today's mappers. These checks run on whatever is in src/fixtures/live/plan
// as well, so a recording dropped there is checked the moment it lands.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('every shipped demo recording', () => {
  it('is well formed, holds no key, and names a photo that is in samples/', () => {
    expect(SHIPPED_RECORDINGS.length).toBeGreaterThan(0)
    for (const recording of SHIPPED_RECORDINGS) {
      expect(() => parsePlanRecording(JSON.parse(JSON.stringify(recording)))).not.toThrow()
      expect(existsSync(resolve(root, recording.photo)), recording.photo).toBe(true)
    }
  })

  it('asks only requests the plan makes, and replays to a complete record', () => {
    const known = new Set(planRequests().map((r) => r.id))
    for (const recording of SHIPPED_RECORDINGS) {
      for (const entry of recording.entries)
        expect(known.has(entry.request), entry.request).toBe(true)
      const record = replayRecording(recording, { id: 'check', photo: null })
      expect(record).toMatchObject({ source: 'recorded', status: 'complete' })
      expect(record.containerId, `${recording.photo} on ${recording.model}`).not.toBeNull()
    }
  })

  it('is named by its photo and model: one recording per photo and route and recording time', () => {
    const names = SHIPPED_RECORDINGS.map(
      (r) => `${r.photo} ${r.provider} ${r.model} ${r.recordedAt}`,
    )
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('the live smoke runs made before the survey existed', () => {
  it('are recorded as asking only the container ID, with the response untouched', () => {
    const luna = preSurveyRecording(lunaSmoke)
    expect(luna).toMatchObject({
      provider: 'luna',
      model: 'gpt-6-luna',
      photo: 'samples/rear-door-aphu-45g1.jpg',
      recordedAt: '2026-10-15T23:42:21.925Z',
    })
    expect(luna.entries).toEqual([
      {
        request: 'read',
        asked: 'id-only',
        response: lunaSmoke.response,
        latencyMs: null,
        costUsd: null,
      },
    ])
    const jev = preSurveyRecording(jevSmoke)
    expect(jev).toMatchObject({ provider: 'openrouter', model: '~typesafe/jev-latest' })
    expect(jev.entries[0]?.response).toBe(jevSmoke.response)
  })
})
