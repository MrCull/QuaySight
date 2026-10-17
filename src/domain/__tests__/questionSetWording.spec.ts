import { describe, it, expect } from 'vitest'
import {
  askedTwiceText,
  boxNotTakenText,
  noChoicesText,
  noLevelsText,
  tooManyChoicesText,
  tooManyQuestionsText,
} from '../questionSetWording'
import { containerDetailQuestions } from '../containerDetails'
import { QuestionSetError, questionSet, toWireRequest } from '../questionSet'

// The words of a refused question set, on their own, and then as they reach a caller through the real
// container-details question set (the set every recorded sample's live counterpart is asked).

describe('question set refusal wording', () => {
  it('words each refusal from its facts', () => {
    expect(askedTwiceText('dg_placard')).toBe('Question dg_placard is asked twice.')
    expect(noChoicesText('q')).toBe('Question q offers no choices.')
    expect(noLevelsText('q')).toBe('Question q has no levels.')
    expect(tooManyChoicesText('q', 300, 'openai-decisions', 255)).toBe(
      'Question q offers 300 choices; openai-decisions takes at most 255 choices per question.',
    )
    expect(tooManyQuestionsText(201, 'openrouter-decisions', 200)).toBe(
      '201 questions; openrouter-decisions takes at most 200 questions per request. Split the set first.',
    )
    expect(boxNotTakenText('where')).toBe('Question where is a box question, which OpenAI does not take.')
  })

  it('reaches the caller unchanged when the container-details set is asked twice', () => {
    const questions = containerDetailQuestions()
    const twice = questionSet('Look at the photo.', [...questions, questions[0]!])
    const options = { model: 'm', imageDataUrl: 'data:image/jpeg;base64,AAAA' }
    expect(() => toWireRequest('openai-decisions', twice, options)).toThrow(QuestionSetError)
    expect(() => toWireRequest('openai-decisions', twice, options)).toThrow(
      askedTwiceText(questions[0]!.name),
    )
  })
})
