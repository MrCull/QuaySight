import { describe, it, expect } from 'vitest'
import type { SharedAnswer } from '../questionSet'
import { questionFamilies } from '../questionRegistry'
import { surveyQuestionSet } from '../survey'
import { chosenLength, type ContainerLengthFt, type LengthReading } from '../chosenLength'
import { decodeSizeCode } from '../isoSizeCode'
import { SHAPE_LENGTH_QUESTION, shapeLengthFamily, shapeLengthOf } from '../shapeLength'
import { buildInspectionExport } from '../exports'
import { draftRecord } from '../../plan/draftRecord'
import type { CertaintyLabel, InspectionRecord } from '../inspection'

// The length-from-shape question (spec #51, ticket #66): 20, 40 or 45 ft from the cues a side photo shows.

function answer(value: string, probability: number): Record<string, SharedAnswer> {
  return {
    [SHAPE_LENGTH_QUESTION.name]: {
      type: 'choice',
      name: SHAPE_LENGTH_QUESTION.name,
      value,
      probabilities: { [value]: probability },
      confidence: probability,
    } as SharedAnswer,
  }
}
const read = (value: string, p: number) => shapeLengthOf(answer(value, p))

describe('the shape length question', () => {
  it('asks 20, 40 or 45 ft and names the cues of a side photo', () => {
    expect(SHAPE_LENGTH_QUESTION.choices.map((c) => c.value)).toEqual([
      '20_ft',
      '40_ft',
      '45_ft',
      'unknown',
    ])
    const text = SHAPE_LENGTH_QUESTION.instructions
    expect(text).toMatch(/proportion/i)
    expect(text).toMatch(/panels/i)
    expect(text).toMatch(/gooseneck/i)
    expect(text).toMatch(/forklift pockets/i)
  })

  it('is a registered family, asked once on both question sets', () => {
    expect(questionFamilies()).toContain(shapeLengthFamily)
    for (const questionSet of ['luna', 'jev'] as const) {
      const names = surveyQuestionSet({ questionSet, box: false }).questions.map((q) => q.name)
      expect(names.filter((n) => n === SHAPE_LENGTH_QUESTION.name)).toHaveLength(1)
    }
  })
})

describe('the certainty of a shape estimate', () => {
  it('reaches Confident for 20 and 40 ft', () => {
    expect(read('20_ft', 0.97)?.certainty).toBe('Confident')
    expect(read('40_ft', 0.97)?.certainty).toBe('Confident')
  })

  it('is capped at Likely for 45 ft, however sure the answer', () => {
    expect(read('45_ft', 0.99)).toMatchObject({ feet: 45, certainty: 'Likely' })
  })

  it('keeps a weaker answer below the cap', () => {
    expect(read('40_ft', 0.7)?.certainty).toBe('Likely')
    expect(read('45_ft', 0.4)?.certainty).toBe('Uncertain')
  })

  it('gives nothing for unknown or a hopeless answer', () => {
    expect(read('unknown', 0.9)).toBeNull()
    expect(read('40_ft', 0.1)).toBeNull()
    expect(shapeLengthOf({})).toBeNull()
  })
})

function recordWith(parts: {
  code?: [string, CertaintyLabel]
  shape?: [ContainerLengthFt, CertaintyLabel]
  model?: ContainerLengthFt
}): InspectionRecord {
  const reading = (feet: ContainerLengthFt, certainty: CertaintyLabel): LengthReading => ({
    feet,
    probability: 0.9,
    certainty,
  })
  return {
    ...draftRecord({ id: 'x', provider: 'luna', model: 'm', source: 'live', photo: null }),
    sizeCode: parts.code ? decodeSizeCode(parts.code[0], parts.code[1]) : null,
    shapeLength: parts.shape ? reading(...parts.shape) : undefined,
    modelLength: parts.model ? reading(parts.model, 'Likely') : undefined,
  }
}

describe('the length chosen', () => {
  it('prefers a Confident ISO code to the shape and the model', () => {
    const r = recordWith({ code: ['22G1', 'Confident'], shape: [20, 'Likely'], model: 40 })
    expect(chosenLength(r)).toEqual({ feet: 20, source: 'iso-code' })
  })

  it('uses the shape when the code is below Confident or absent', () => {
    expect(
      chosenLength(recordWith({ code: ['22G1', 'Likely'], shape: [40, 'Confident'] })),
    ).toEqual({ feet: 40, source: 'shape' })
    expect(chosenLength(recordWith({ shape: [45, 'Likely'], model: 20 }))).toEqual({
      feet: 45,
      source: 'shape',
    })
  })

  it('uses the model when there is no code and no shape, then 40', () => {
    expect(chosenLength(recordWith({ model: 20 }))).toEqual({ feet: 20, source: 'model' })
    expect(chosenLength(recordWith({}))).toEqual({ feet: 40, source: 'default' })
  })

  it('is Uncertain when a Confident code and the shape disagree, the shape as its alternative', () => {
    const r = recordWith({ code: ['22G1', 'Confident'], shape: [40, 'Confident'] })
    expect(chosenLength(r)).toEqual({
      feet: 20,
      source: 'iso-code',
      certainty: 'Uncertain',
      alternative: 40,
    })
  })

  it('does not call a code and a shape that agree a disagreement', () => {
    const r = recordWith({ code: ['45G1', 'Confident'], shape: [40, 'Confident'] })
    expect(chosenLength(r)).toEqual({ feet: 40, source: 'iso-code' })
  })

  it('does not compare a below-Confident code with the shape', () => {
    const r = recordWith({ code: ['22G1', 'Uncertain'], shape: [40, 'Confident'] })
    expect(chosenLength(r).alternative).toBeUndefined()
  })
})

describe('the length in the exports', () => {
  it('names the shape as the source and warns of a disagreement', () => {
    const shaped = buildInspectionExport(recordWith({ shape: [40, 'Confident'] }))
    expect(shaped.containerLength).toEqual({ feet: 40, source: 'shape' })
    const clash = buildInspectionExport(
      recordWith({ code: ['22G1', 'Confident'], shape: [40, 'Confident'] }),
    )
    expect(clash.conflicts.join(' ')).toMatch(/size code says 20 ft.*shape.*40 ft/i)
  })
})
