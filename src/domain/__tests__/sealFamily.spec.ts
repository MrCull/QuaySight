import { describe, expect, it } from 'vitest'
import { draftRecord } from '../../plan/draftRecord'
import { buildInspectionExport, buildSummaryText } from '../exports'
import type { SharedAnswer } from '../questionSet'
import { applySurvey, readSurvey, surveyQuestionSet, type SurveyAsk } from '../survey'

// The seal question family (spec #51, ticket #68): whether a seal is visible, its number character by
// character, and where it was read. Specs go through the survey, as the registry does.

const LUNA = { questionSet: 'luna', box: false } as const
const JEV = { questionSet: 'jev', box: true } as const

const choice = (value: string, p = 0.95, other?: [string, number]): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p, ...(other ? { [other[0]]: other[1] } : {}) },
  confidence: p,
})
const visible = (p: number): SharedAnswer => ({ type: 'predicate', probability: p })

/** Answers spelling `digits` at positions 1.., then "none" for the rest of the eight places. */
function spelled(digits: string[], seen = 0.97): Record<string, SharedAnswer> {
  const answers: Record<string, SharedAnswer> = { seal_visible: visible(seen) }
  for (let i = 1; i <= 8; i++) {
    answers[`seal_char_${String(i).padStart(2, '0')}`] = choice(digits[i - 1] ?? 'none')
  }
  return answers
}

const record = (answers: Record<string, SharedAnswer>, ask: SurveyAsk = LUNA) =>
  applySurvey(
    draftRecord({ id: 'x', provider: 'luna', model: 'm', source: 'live', photo: null }),
    readSurvey(answers, ask),
  )

describe('the seal questions', () => {
  it('ask whether a seal is visible and each seal character as choices', () => {
    const questions = surveyQuestionSet(LUNA).questions
    const seal = questions.filter((q) => q.name.startsWith('seal_'))
    expect(seal.map((q) => q.name)).toEqual([
      'seal_visible',
      ...Array.from({ length: 8 }, (_, i) => `seal_char_0${i + 1}`),
    ])
    const first = seal[1]
    expect(first?.type).toBe('choice')
    if (first?.type === 'choice') {
      const values = first.choices.map((c) => c.value)
      expect(values).toEqual(expect.arrayContaining(['0', '9', 'A', 'Z', 'none', 'unreadable']))
    }
  })

  it('ask for the box only of a model that takes box questions', () => {
    expect(surveyQuestionSet(LUNA).questions.map((q) => q.name)).not.toContain('seal_box')
    const box = surveyQuestionSet(JEV).questions.find((q) => q.name === 'seal_box')
    expect(box?.type).toBe('box')
  })
})

describe('a seal that was read', () => {
  const answers = spelled(['4', '2', '1', '7', '0', '9', '5'])

  it('is shown character by character with its certainty', () => {
    const seal = record(answers).seal!
    expect(seal.visible).toBe(true)
    expect(seal.value).toBe('4217095')
    expect(seal.characters).toHaveLength(7)
    expect(seal.characters.every((c) => c.certainty === 'Confident')).toBe(true)
    expect(seal.certainty).toBe('Confident')
  })

  it('carries the box it was read at when the model gave a usable one', () => {
    const box = { top: 0.4, bottom: 0.5, left: 0.3, right: 0.5 }
    const seal = record({ ...answers, seal_box: { type: 'box', box, confidence: 0.9 } }, JEV).seal!
    expect(seal.box).toEqual({ ...box, confidence: 0.9 })
  })

  it('carries no box when the model is unsure of it', () => {
    const box = { top: 0.4, bottom: 0.5, left: 0.3, right: 0.5 }
    const seal = record({ ...answers, seal_box: { type: 'box', box, confidence: 0.2 } }, JEV).seal!
    expect(seal.box).toBeUndefined()
  })

  it('is in the JSON export and the summary, with no check digit', () => {
    const r = record(answers)
    expect(buildInspectionExport(r).values).toContainEqual(
      expect.objectContaining({ field: 'seal', value: '4217095', certainty: 'Confident' }),
    )
    const summary = buildSummaryText(r)
    expect(summary).toContain('Seal: 4217095 - Confident')
    expect(summary.toLowerCase()).not.toContain('seal check')
    expect(JSON.stringify(buildInspectionExport(r)).toLowerCase()).not.toContain('seal.check')
  })
})

describe('a seal that was partly read', () => {
  const answers = {
    ...spelled(['4', '2', '1', '7', '0', '9', '5']),
    seal_char_03: choice('unreadable'),
    seal_char_05: choice('0', 0.62, ['8', 0.3]),
  }

  it('leaves the unread character unread and lowers the overall certainty', () => {
    const seal = record(answers).seal!
    expect(seal.value).toBe('42?7095')
    expect(seal.characters[2]).toEqual({ value: null, certainty: "Can't tell" })
    expect(seal.characters[4]?.certainty).toBe('Likely')
    expect(seal.certainty).toBe('Uncertain')
  })

  it('exports the unread position as unresolved', () => {
    const exported = buildInspectionExport(record(answers))
    expect(exported.unresolved).toContainEqual(
      expect.objectContaining({ field: 'seal.position[2]' }),
    )
    expect(buildSummaryText(record(answers))).toContain('Seal: 42·7095 - Uncertain')
  })

  it('says Can’t tell when no character could be read', () => {
    const none = {
      ...spelled([]),
      ...Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`seal_char_0${i + 1}`, choice('unreadable')]),
      ),
    }
    const seal = record(none).seal!
    expect(seal.visible).toBe(true)
    expect(seal.characters.every((c) => c.value === null)).toBe(true)
    expect(seal.certainty).toBe("Can't tell")
  })
})

describe('no seal visible', () => {
  const answers = spelled([], 0.03)

  it('is Not seen, with no characters', () => {
    const seal = record(answers).seal!
    expect(seal.visible).toBe(false)
    expect(seal.certainty).toBe('Not seen')
    expect(seal.characters).toEqual([])
  })

  it('is exported as Not seen, with no verdict about the seal', () => {
    const r = record(answers)
    expect(buildSummaryText(r)).toContain('Seal: Not seen')
    expect(buildInspectionExport(r).unresolved).toContainEqual(
      expect.objectContaining({ field: 'seal' }),
    )
    expect(buildSummaryText(r)).not.toMatch(/sealed|intact|safe/i)
  })
})

describe('a survey that did not answer the seal questions', () => {
  it('leaves the record without a seal: not assessed, never Not seen', () => {
    const r = record({})
    expect(r.seal).toBeUndefined()
    expect(buildSummaryText(r)).not.toContain('Seal')
  })
})
