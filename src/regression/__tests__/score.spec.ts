import { describe, it, expect } from 'vitest'
import { draftRecord } from '../../plan/draftRecord'
import type { InspectionRecord } from '../../domain/inspection'
import { scoreRecord, formatScoreTable, type Expected } from '../score'

const expected: Expected = {
  photo: 'samples/x.jpg',
  containerId: 'COYU2668130',
  sizeCode: '22G1',
  maxGrossKg: 30480,
  tareKg: 2180,
  payloadKg: 28300,
  face: 'rear-doors',
  lengthFt: 20,
  damage: 'none',
}

function recordWith(patch: Partial<InspectionRecord>): InspectionRecord {
  return {
    ...draftRecord({
      id: 't',
      provider: 'luna',
      model: 'gpt-6-luna',
      source: 'recorded',
      photo: null,
    }),
    ...patch,
  }
}

function resultsOf(record: InspectionRecord, against: Expected = expected) {
  return Object.fromEntries(scoreRecord(record, against).map((s) => [s.field, s.result]))
}

describe('scoreRecord', () => {
  it('marks a field read as expected a hit, a different value a miss, and no value unread', () => {
    const record = recordWith({
      containerId: {
        value: 'COYU2668138',
        certainty: 'Likely',
      } as InspectionRecord['containerId'],
      photoFace: { face: 'rear-doors', probability: 0.9, certainty: 'Confident' } as never,
    })
    const scores = resultsOf(record)
    expect(scores.id).toBe('miss')
    expect(scores.face).toBe('hit')
    expect(scores.tare).toBe('unread')
  })

  it('counts a field expected to be absent a hit when the model gave none, a miss when it invented one', () => {
    const none: Expected = { ...expected, containerId: null }
    const invented = recordWith({
      containerId: { value: 'ABCU1234560', certainty: 'Likely' } as InspectionRecord['containerId'],
    })
    expect(resultsOf(invented, none).id).toBe('miss')
    expect(resultsOf(recordWith({}), none).id).toBe('hit')
  })

  it('compares damage as present or not', () => {
    expect(resultsOf(recordWith({}), { ...expected, damage: 'none' }).damage).toBe('unread')
    const assessed = recordWith({
      damage: { source: 'recorded', photos: [], findings: [] },
    })
    expect(resultsOf(assessed, { ...expected, damage: 'none' }).damage).toBe('hit')
    expect(resultsOf(assessed, { ...expected, damage: 'some' }).damage).toBe('miss')
  })
})

describe('formatScoreTable', () => {
  it('prints one row per model and one column per field', () => {
    const table = formatScoreTable([
      {
        model: 'Luna',
        scores: [
          { field: 'id', result: 'hit' },
          { field: 'face', result: 'miss' },
        ],
      },
    ])
    expect(table.split('\n')[0]).toMatch(/id\s+face/)
    expect(table).toMatch(/Luna\s+hit\s+miss/)
  })
})
