import { describe, it, expect } from 'vitest'
import { draftRecord } from '../../plan/draftRecord'
import type { InspectionRecord } from '../../domain/inspection'
import { scoreRecord, formatScoreTable, type Expected } from '../score'

const expected: Expected = {
  id: 'x',
  photos: [{ photo: 'samples/x.jpg', faces: ['rear-doors'] }],
  containerId: 'COYU2668130',
  seal: null,
  idCertainty: 'Confident',
  alternativesAllowed: false,
  differentContainersWarning: false,
  closeUpFrom: { id: null, seal: null },
  sizeCode: '22G1',
  maxGrossKg: 30480,
  tareKg: 2180,
  payloadKg: 28300,
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

describe('scoreRecord: whole-inspection fields', () => {
  const id = (patch: object) =>
    ({
      value: 'COYU2668130',
      certainty: 'Confident',
      ...patch,
    }) as InspectionRecord['containerId']
  const seal = (value: string, extra: object = {}) =>
    ({ visible: true, characters: [], value, certainty: 'Likely', ...extra }) as never

  it('scores the seal against its expected number, "?" places included, and none as a hit when none is expected', () => {
    const withSeal: Expected = { ...expected, seal: '0154620' }
    expect(resultsOf(recordWith({ seal: seal('0154620') }), withSeal).seal).toBe('hit')
    expect(resultsOf(recordWith({ seal: seal('051') }), withSeal).seal).toBe('miss')
    expect(resultsOf(recordWith({ seal: seal('01546?0') }), withSeal).seal).toBe('miss')
    expect(resultsOf(recordWith({}), withSeal).seal).toBe('unread')
    expect(resultsOf(recordWith({}), expected).seal).toBe('hit')
    expect(resultsOf(recordWith({ seal: seal('0154620') }), expected).seal).toBe('miss')
    const notVisible = seal('', { visible: false })
    expect(resultsOf(recordWith({ seal: notVisible }), expected).seal).toBe('hit')
  })

  it('scores the ID certainty against the expected one', () => {
    expect(resultsOf(recordWith({ containerId: id({}) })).idCertainty).toBe('hit')
    expect(resultsOf(recordWith({ containerId: id({ certainty: 'Uncertain' }) })).idCertainty).toBe(
      'miss',
    )
    expect(resultsOf(recordWith({})).idCertainty).toBe('unread')
  })

  it('misses when alternatives are shown where none are allowed, and never when they are allowed', () => {
    const alts = recordWith({ containerId: id({ alternatives: ['COYU2068130'] }) })
    expect(resultsOf(alts).alternatives).toBe('miss')
    expect(resultsOf(alts, { ...expected, alternativesAllowed: true }).alternatives).toBe('hit')
    expect(resultsOf(recordWith({ containerId: id({ alternatives: [] }) })).alternatives).toBe(
      'hit',
    )
  })

  it('compares the different-containers warning with whether it was expected', () => {
    expect(resultsOf(recordWith({ differentContainers: true })).differentContainers).toBe('miss')
    expect(resultsOf(recordWith({})).differentContainers).toBe('hit')
    expect(
      resultsOf(recordWith({ differentContainers: true }), {
        ...expected,
        differentContainersWarning: true,
      }).differentContainers,
    ).toBe('hit')
  })

  it('scores the faces given to every photo, close-ups included', () => {
    const two: Expected = {
      ...expected,
      photos: [
        { photo: 'samples/a.jpg', faces: ['rear-doors'] },
        { photo: 'samples/b.jpg', faces: ['close-up'], closeUp: 'seal' },
      ],
    }
    const photo = (index: number, face: string) =>
      ({ index, face: { face } }) as unknown as NonNullable<InspectionRecord['photos']>[number]
    const right = recordWith({ photos: [photo(1, 'rear-doors'), photo(2, 'close-up')] })
    const wrong = recordWith({ photos: [photo(1, 'rear-doors'), photo(2, 'rear-doors')] })
    expect(resultsOf(right, two).faces).toBe('hit')
    expect(resultsOf(wrong, two).faces).toBe('miss')
    expect(resultsOf(recordWith({ photos: [photo(1, 'rear-doors')] }), two).faces).toBe('miss')
    const single = recordWith({
      photoFace: { face: 'rear-doors', probability: 1, certainty: 'Confident' } as never,
    })
    expect(resultsOf(single).faces).toBe('hit')
    expect(resultsOf(recordWith({})).faces).toBe('unread')
  })

  it('scores which photo each close-up comes from', () => {
    const from: Expected = { ...expected, closeUpFrom: { id: 2, seal: 3 } }
    const box = { left: 0.1, top: 0.1, right: 0.2, bottom: 0.2, confidence: 1 }
    const read = recordWith({
      containerId: id({ box, photo: 2 }),
      seal: seal('1', { box, photo: 3 }),
    })
    expect(resultsOf(read, from).closeUps).toBe('hit')
    const wrongPhoto = recordWith({
      containerId: id({ box, photo: 1 }),
      seal: seal('1', { box, photo: 3 }),
    })
    expect(resultsOf(wrongPhoto, from).closeUps).toBe('miss')
    expect(resultsOf(recordWith({}), from).closeUps).toBe('unread')
    expect(resultsOf(recordWith({}), expected).closeUps).toBe('hit')
    const single = recordWith({ containerId: id({ box }) })
    expect(resultsOf(single, { ...expected, closeUpFrom: { id: 1, seal: null } }).closeUps).toBe(
      'hit',
    )
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
