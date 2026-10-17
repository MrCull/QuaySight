// The regression set: replays every recording in src/fixtures/live/plan/ and scores each model against
// src/regression/expected.json, field by field. Free: nothing is sent. Run `npm run score` to see the table.
import { describe, it, expect } from 'vitest'
import { parsePlanRecording } from '../../plan/recording'
import { replayRecording } from '../../plan/replay'
import { labelsFor } from '../../domain/providers'
import expected from '../expected.json'
import { formatScoreTable, scoreRecord, SCORE_FIELDS, type Expected } from '../score'

const files = import.meta.glob<unknown>('../../fixtures/live/plan/*.json', {
  eager: true,
  import: 'default',
})
const recordings = Object.values(files).map((f) => parsePlanRecording(f))
const truths = expected as Expected[]

describe('regression set', () => {
  it('has an expected result for each of the 4 samples, and a recording of each on both models', () => {
    expect(truths).toHaveLength(4)
    for (const truth of truths) {
      const own = recordings.filter((r) => r.photo === truth.photo)
      expect({ photo: truth.photo, routes: own.map((r) => r.provider).sort() }).toEqual({
        photo: truth.photo,
        routes: ['luna', 'openrouter'],
      })
    }
  })

  it('replays every recording and scores it', () => {
    const rows = recordings
      .filter((r) => truths.some((t) => t.photo === r.photo))
      .map((r) => {
        const truth = truths.find((t) => t.photo === r.photo)!
        const record = replayRecording(r, { id: 'score', photo: null })
        return {
          photo: r.photo,
          model: labelsFor(r.provider, r.model).model,
          scores: scoreRecord(record, truth),
        }
      })
    expect(rows.every((r) => r.scores.length === SCORE_FIELDS.length)).toBe(true)

    if (process.env.SCORE_REPORT) {
      const byModel = new Map<string, typeof rows>()
      for (const row of rows) byModel.set(row.model, [...(byModel.get(row.model) ?? []), row])
      const lines: string[] = []
      for (const [model, own] of byModel) {
        lines.push(
          `\n${model}\n` +
            formatScoreTable(
              own.map((r) => ({ model: r.photo.replace('samples/', ''), scores: r.scores })),
            ),
        )
      }
      const total = (model: string) => {
        const all = (byModel.get(model) ?? []).flatMap((r) => r.scores)
        return `${all.filter((s) => s.result === 'hit').length}/${all.length}`
      }
      lines.push(`\nHits: ${[...byModel.keys()].map((m) => `${m} ${total(m)}`).join(', ')}`)
      process.stdout.write(lines.join('\n') + '\n')
    }
  })
})
