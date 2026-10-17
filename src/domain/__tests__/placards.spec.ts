import { describe, expect, it } from 'vitest'
import { draftRecord } from '../../plan/draftRecord'
import { buildInspectionExport, buildSummaryText } from '../exports'
import type { SharedAnswer } from '../questionSet'
import { applySurvey, readSurvey, surveyQuestionSet } from '../survey'

// The placards question family (spec #51, ticket #69), through the survey's public seam: the questions
// asked, the findings read, the record, the JSON export and the summary.

const ASK = { questionSet: 'jev', box: true } as const

const predicate = (probability: number): SharedAnswer => ({ type: 'predicate', probability })
const choice = (value: string, p = 0.95): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p },
  confidence: p,
})
const box = (left: number): SharedAnswer => ({
  type: 'box',
  box: { top: 0.4, bottom: 0.5, left, right: left + 0.1 },
  confidence: 0.9,
})

function placard(n: number, klass: string, un: string, left: number): Record<string, SharedAnswer> {
  const out: Record<string, SharedAnswer> = {
    [`placard_${n}_present`]: predicate(0.95),
    [`placard_${n}_class`]: choice(klass),
    [`placard_${n}_box`]: box(left),
  }
  for (const [i, ch] of [...un].entries()) {
    out[`placard_${n}_un_${i + 1}`] = choice(ch === '?' ? 'unreadable' : ch)
  }
  return out
}

function run(answers: Record<string, SharedAnswer>) {
  const survey = readSurvey(answers, ASK)
  const record = applySurvey(
    draftRecord({ id: 'x', provider: 'luna', model: 'm', source: 'live', photo: null }),
    survey,
  )
  return { survey, record }
}

describe('placards family', () => {
  it('is asked in the survey, with a box only where the model takes boxes', () => {
    const names = surveyQuestionSet(ASK).questions.map((q) => q.name)
    expect(names).toContain('placards_present')
    expect(names).toContain('placard_1_class')
    expect(names).toContain('placard_1_un_4')
    expect(names).toContain('placard_1_box')
    expect(names).toContain('marine_pollutant_mark')
    expect(names).toContain('limited_quantity_mark')
    const luna = surveyQuestionSet({ questionSet: 'luna', box: false }).questions.map((q) => q.name)
    expect(luna).not.toContain('placard_1_box')
  })

  it('reads no placards as a result, not a failure', () => {
    const { record } = run({
      placards_present: predicate(0.03),
      marine_pollutant_mark: predicate(0.02),
      limited_quantity_mark: predicate(0.02),
    })
    expect(record.placards).toMatchObject({ answer: 'none', placards: [] })
    expect(record.placards!.certainty).toBe('Not seen')
    const json = buildInspectionExport(record)
    expect(json.values).toContainEqual(
      expect.objectContaining({ field: 'placards', value: 'none seen' }),
    )
    expect(json.unresolved.map((u) => u.field)).not.toContain('placards')
    expect(buildSummaryText(record)).toContain('Placards: none seen')
  })

  it('reads one placard with its class, UN number and box', () => {
    const { record } = run({
      placards_present: predicate(0.97),
      ...placard(1, 'class_3', '1203', 0.3),
      placard_2_present: predicate(0.02),
      marine_pollutant_mark: predicate(0.05),
      limited_quantity_mark: predicate(0.05),
    })
    const p = record.placards!
    expect(p.answer).toBe('present')
    expect(p.placards).toHaveLength(1)
    expect(p.placards[0]).toMatchObject({ dgClass: 3, unNumber: '1203', certainty: 'Confident' })
    expect(p.placards[0]!.box).toMatchObject({ left: 0.3, confidence: 0.9 })
    expect(p.marinePollutant.answer).toBe('no')
    const json = buildInspectionExport(record)
    expect(json.values).toContainEqual(
      expect.objectContaining({ field: 'placards[0].unNumber', value: '1203' }),
    )
    expect(json.values).toContainEqual(
      expect.objectContaining({ field: 'placards[0].class', value: 3 }),
    )
    expect(buildSummaryText(record)).toContain('Placard 1: class 3, UN 1203')
  })

  it('reads two placards and the marine pollutant and limited quantity marks', () => {
    const { record } = run({
      placards_present: predicate(0.97),
      ...placard(1, 'class_3', '1203', 0.3),
      ...placard(2, 'class_9', '3082', 0.6),
      marine_pollutant_mark: predicate(0.95),
      limited_quantity_mark: predicate(0.92),
    })
    expect(record.placards!.placards.map((x) => [x.dgClass, x.unNumber])).toEqual([
      [3, '1203'],
      [9, '3082'],
    ])
    expect(record.placards!.marinePollutant.answer).toBe('yes')
    expect(record.placards!.limitedQuantity.answer).toBe('yes')
    const summary = buildSummaryText(record)
    expect(summary).toContain('Placard 2: class 9, UN 3082')
    expect(summary).toContain('Marine pollutant mark: seen')
    expect(summary).toContain('Limited quantity mark: seen')
  })

  it('keeps an unread UN number unread, never filled in', () => {
    const { record } = run({
      placards_present: predicate(0.97),
      ...placard(1, 'class_3', '12?3', 0.3),
      placard_2_present: predicate(0.02),
    })
    const p = record.placards!.placards[0]!
    expect(p.unNumber).toBe('12?3')
    expect(p.certainty).toBe("Can't tell")
    const json = buildInspectionExport(record)
    expect(json.unresolved).toContainEqual(
      expect.objectContaining({ field: 'placards[0].unNumber.position[2]' }),
    )
    expect(buildSummaryText(record)).toContain('Placard 1: class 3, UN 12?3')
  })

  it('leaves the record alone when the reply did not answer the placard questions', () => {
    const { record } = run({})
    expect(record.placards).toBeUndefined()
    expect(buildSummaryText(record)).not.toContain('Placards:')
  })
})
