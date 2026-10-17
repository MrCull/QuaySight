// The regression set: replays every expected inspection (1 to 4 photos) from the recordings in
// src/fixtures/live/plan/ and scores each model against src/regression/expected.json, field by field.
// Free: nothing is sent. Run `npm run score` to see the table.
import { describe, it, expect } from 'vitest'
import { parsePlanRecording } from '../../plan/recording'
import { labelsFor } from '../../domain/providers'
import type { ProviderId } from '../../domain/inspection'
import expected from '../expected.json'
import { potentiallySignificant } from '../../domain/damage'
import { replayInspection } from '../replayInspection'
import {
  formatScoreTable,
  scoreRecord,
  ORIGINAL_SCORE_FIELDS,
  SCORE_FIELDS,
  type Expected,
} from '../score'

const files = import.meta.glob<unknown>('../../fixtures/live/plan/*.json', {
  eager: true,
  import: 'default',
})
const recordings = Object.values(files).map((f) => parsePlanRecording(f))
const truths = expected as Expected[]
const ROUTES: ProviderId[] = ['luna', 'openrouter']

describe('regression set', () => {
  it('describes whole inspections of 1 to 4 photos, each recorded on both models', () => {
    expect(truths.map((t) => t.id)).toEqual([
      'coyu-doors',
      'chsu-doors',
      'aphu-doors',
      'grey-side',
      'coyu-door-and-seal',
      'jdlu-four-photos',
    ])
    for (const truth of truths) {
      expect(truth.photos.length).toBeGreaterThanOrEqual(1)
      expect(truth.photos.length).toBeLessThanOrEqual(4)
      for (const photo of truth.photos) {
        const own = recordings.filter((r) => r.photo === photo.photo)
        expect({ photo: photo.photo, routes: own.map((r) => r.provider).sort() }).toEqual({
          photo: photo.photo,
          routes: ['luna', 'openrouter'],
        })
      }
    }
  })

  it('replays every inspection and scores it', () => {
    const rows = ROUTES.flatMap((route) =>
      truths.map((truth) => {
        const record = replayInspection(truth, recordings, route)
        const recording = recordings.find((r) => r.provider === route)!
        return {
          entry: truth.id,
          model: labelsFor(route, recording.model).model,
          scores: scoreRecord(record, truth),
        }
      }),
    )
    expect(rows.every((r) => r.scores.length === SCORE_FIELDS.length)).toBe(true)

    if (process.env.SCORE_REPORT) {
      const byModel = new Map<string, typeof rows>()
      for (const row of rows) byModel.set(row.model, [...(byModel.get(row.model) ?? []), row])
      const lines: string[] = []
      for (const [model, own] of byModel) {
        lines.push(
          `\n${model}\n` + formatScoreTable(own.map((r) => ({ model: r.entry, scores: r.scores }))),
        )
      }
      const total = (model: string, fields: readonly string[]) => {
        const all = (byModel.get(model) ?? [])
          .flatMap((r) => r.scores)
          .filter((s) => fields.includes(s.field))
        return `${all.filter((s) => s.result === 'hit').length}/${all.length}`
      }
      const models = [...byModel.keys()]
      lines.push(
        `\nOriginal fields: ${models.map((m) => `${m} ${total(m, ORIGINAL_SCORE_FIELDS)}`).join(', ')}`,
        `All fields: ${models.map((m) => `${m} ${total(m, SCORE_FIELDS)}`).join(', ')}`,
      )
      process.stdout.write(lines.join('\n') + '\n')
    }
  })

  it('does not raise the closer-inspection banner for the rust on the JDLU photos', () => {
    const truth = truths.find((t) => t.id === 'jdlu-four-photos')!
    for (const route of ROUTES) {
      const damage = replayInspection(truth, recordings, route).damage!
      expect(damage.findings.length).toBeGreaterThan(0)
      expect(potentiallySignificant(damage)).toBe(false)
    }
  })
})
