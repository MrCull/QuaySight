import { afterEach, describe, expect, it } from 'vitest'
import { draftRecord } from '../../plan/draftRecord'
import { buildInspectionExport, buildSummaryText } from '../exports'
import type { SharedAnswer } from '../questionSet'
import { questionSetAsk } from '../questionSetAsk'
import { QuestionSetError } from '../questionSetTypes'
import { registerFamily, requestSet, type QuestionFamily } from '../questionRegistry'
import { applySurvey, readSurvey, surveyQuestionSet } from '../survey'

// The question registry (spec #51, ticket #59): a question family declares its questions, how its
// answers are read, what it adds to the record and what it exports, in one place. This spec registers a
// test-only family and changes no other module.

declare module '../survey' {
  interface SurveyFindings {
    testStamp: { code: string } | null
  }
}
declare module '../inspection' {
  interface InspectionRecord {
    testStamp?: { code: string } | null
  }
}

const ASK = { questionSet: 'luna', box: false } as const

const stampFamily: QuestionFamily = {
  key: 'testStamp',
  questions: () => [
    {
      type: 'choice',
      name: 'test_stamp',
      instructions: 'Which stamp is on the container?',
      choices: [{ value: 'alpha' }, { value: 'beta' }],
    },
  ],
  read: (answers: Record<string, SharedAnswer>) => {
    const a = answers.test_stamp
    return a?.type === 'choice' ? { code: a.value } : null
  },
  apply: (record, finding) => ({ ...record, testStamp: finding }),
  export: (record) => ({
    values: record.testStamp
      ? [
          {
            field: 'testStamp',
            category: 'printed',
            value: record.testStamp.code,
            provenance: 'printed',
            certainty: 'Likely',
            uncertainty: null,
          },
        ]
      : [],
    unresolved: [],
    conflicts: [],
    summary: record.testStamp ? [`Test stamp: ${record.testStamp.code}`] : [],
  }),
}

const removers: (() => void)[] = []
afterEach(() => removers.splice(0).forEach((remove) => remove()))
const register = (family: QuestionFamily) => removers.push(registerFamily(family))

const choice = (name: string, value: string): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: 0.95 },
  confidence: 0.95,
})

describe('a registered question family', () => {
  it('is asked in the survey, read, applied to the record and exported', () => {
    expect(surveyQuestionSet(ASK).questions.map((q) => q.name)).not.toContain('test_stamp')
    register(stampFamily)

    expect(surveyQuestionSet(ASK).questions.map((q) => q.name)).toContain('test_stamp')
    const answer = readSurvey({ test_stamp: choice('test_stamp', 'beta') }, ASK)
    expect(answer.findings.testStamp).toEqual({ code: 'beta' })

    const record = applySurvey(
      draftRecord({ id: 'x', provider: 'luna', model: 'm', source: 'live', photo: null }),
      answer,
    )
    expect(record.testStamp).toEqual({ code: 'beta' })
    expect(buildInspectionExport(record).values).toContainEqual(
      expect.objectContaining({ field: 'testStamp', value: 'beta' }),
    )
    expect(buildSummaryText(record)).toContain('Test stamp: beta')
  })

  it('is removed again by the function registerFamily returns', () => {
    const remove = registerFamily(stampFamily)
    remove()
    expect(surveyQuestionSet(ASK).questions.map((q) => q.name)).not.toContain('test_stamp')
  })

  it('cannot be registered twice', () => {
    register(stampFamily)
    expect(() => registerFamily(stampFamily)).toThrow(/already registered/)
  })

  it('is asked only in the request it names', () => {
    register({ ...stampFamily, request: 'elsewhere' })
    expect(surveyQuestionSet(ASK).questions.map((q) => q.name)).not.toContain('test_stamp')
    expect(requestSet('elsewhere', ASK).questions.map((q) => q.name)).toEqual(['test_stamp'])
  })
})

describe('the limits on the whole assembled set', () => {
  const route = {
    model: 'gpt-6-luna',
    entry: { wireFormat: 'openai-decisions' as const },
  }
  const build = () =>
    questionSetAsk(surveyQuestionSet(ASK), (reply) => reply).build({
      route,
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
    })

  it('refuses a family that repeats another family’s question name', () => {
    register({
      ...stampFamily,
      questions: () => [{ ...stampFamily.questions(ASK)[0]!, name: 'photo_face' }],
    })
    expect(build).toThrow(QuestionSetError)
  })

  it('refuses a family that takes the set over the question count', () => {
    register({
      ...stampFamily,
      questions: () =>
        Array.from({ length: 200 }, (_, i) => ({
          ...stampFamily.questions(ASK)[0]!,
          name: `bulk_${i}`,
        })),
    })
    expect(build).toThrow(/questions/)
  })
})
