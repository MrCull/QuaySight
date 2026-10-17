import { describe, it, expect } from 'vitest'
import { FACE_QUESTION, faceOf, facePart } from '../photoFace'
import { readAnswers, questionSet, toWireRequest, type QuestionWireFormat } from '../questionSet'
import { questionFamilies } from '../questionRegistry'
import { surveyQuestionSet } from '../survey'

const PHOTO = 'data:image/jpeg;base64,AAAA'

/** The face a survey reply gives, read through the shared format as the survey reads it. */
function readPhotoFace(wire: QuestionWireFormat, raw: unknown) {
  return faceOf(readAnswers(wire, raw, questionSet('', [FACE_QUESTION]), '').answers)
}

describe('the face question', () => {
  it('offers the six faces a photo can show', () => {
    expect(FACE_QUESTION.type).toBe('choice')
    expect(FACE_QUESTION.choices.map((c) => c.value)).toEqual([
      'rear_doors',
      'long_side',
      'front_end',
      'roof',
      'close_up',
      'unknown',
    ])
  })

  it('is one question family, asked once, after the ID questions', () => {
    expect(questionFamilies()).toContain(facePart)
    for (const questionSet of ['luna', 'jev'] as const) {
      const names = surveyQuestionSet({ questionSet, box: false }).questions.map((q) => q.name)
      expect(names.filter((n) => n === FACE_QUESTION.name)).toHaveLength(1)
      expect(names.indexOf(FACE_QUESTION.name)).toBeGreaterThan(names.indexOf('id_char_11'))
    }
  })

  it('reads the face from an OpenAI reply', () => {
    const raw = {
      answers: [
        {
          type: 'choice',
          name: FACE_QUESTION.name,
          choice: 'long_side',
          probabilities: [
            { value: 'long_side', probability: 0.94 },
            { value: 'rear_doors', probability: 0.04 },
          ],
        },
      ],
    }
    expect(readPhotoFace('openai-decisions', raw)).toEqual({
      face: 'long-side',
      probability: 0.94,
      certainty: 'Confident',
    })
  })

  it('reads the face from an OpenRouter reply', () => {
    const raw = {
      answers: {
        [FACE_QUESTION.name]: {
          type: 'choice',
          choice: 'rear_doors',
          probabilities: { rear_doors: 0.7, long_side: 0.25 },
        },
      },
    }
    expect(readPhotoFace('openrouter-decisions', raw)).toMatchObject({
      face: 'rear-doors',
      certainty: 'Likely',
    })
  })

  it('is null when the reply has no usable face answer, or no answers at all', () => {
    expect(readPhotoFace('openrouter-decisions', { answers: {} })).toBeNull()
    expect(readPhotoFace('openai-decisions', { answers: [] })).toBeNull()
    expect(faceOf({})).toBeNull()
    expect(
      readPhotoFace('openrouter-decisions', {
        answers: { [FACE_QUESTION.name]: { type: 'choice', choice: 'underside' } },
      }),
    ).toBeNull()
  })

  it('goes on both wire formats', () => {
    const set = questionSet('Survey', [FACE_QUESTION])
    const opts = { model: 'm', imageDataUrl: PHOTO }
    expect(toWireRequest('openai-decisions', set, opts).questions).toEqual([FACE_QUESTION])
    expect(
      toWireRequest('openrouter-decisions', set, opts).questions[FACE_QUESTION.name],
    ).toMatchObject({ type: 'choice' })
  })
})
