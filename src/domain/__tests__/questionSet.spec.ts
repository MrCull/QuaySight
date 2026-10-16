import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  QuestionSetError,
  UnreadableReplyError,
  parseQuestionSet,
  readAnswers,
  splitQuestionSet,
  toWireRequest,
  type SharedQuestionSet,
} from '../questionSet'

const PHOTO = 'data:image/png;base64,QUJD'

/** A small set in the authoring shape: one question of each type OpenAI takes, the photo with a detail field. */
const SET: SharedQuestionSet = {
  input: [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: 'Freight container photo.' },
        {
          type: 'input_image',
          image_url: 'data:image/jpeg;base64,{{imageBase64}}',
          detail: 'original',
        },
      ],
    },
  ],
  questions: [
    { type: 'predicate', name: 'door_end', instructions: 'Is the door end in view?' },
    {
      type: 'choice',
      name: 'quality',
      instructions: 'Is the photo good enough?',
      choices: [{ value: 'good', description: 'Sharp and well lit' }, { value: 'poor' }],
    },
    {
      type: 'score',
      name: 'severity',
      instructions: 'How severe is the worst defect?',
      levels: [
        { label: 'none', description: 'No defect.' },
        { label: 'minor' },
        { label: 'major', description: 'Needs a closer look.' },
      ],
    },
  ],
}

describe('toWireRequest for OpenAI Decisions', () => {
  it('sends the authored request with the photo in place and the image detail kept', () => {
    expect(
      toWireRequest('openai-decisions', SET, { model: 'gpt-6-luna', imageDataUrl: PHOTO }),
    ).toEqual({
      model: 'gpt-6-luna',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Freight container photo.' },
            { type: 'input_image', image_url: PHOTO, detail: 'original' },
          ],
        },
      ],
      questions: SET.questions,
    })
  })

  it('refuses a box question, which OpenAI does not take, before anything is sent', () => {
    const withBox: SharedQuestionSet = {
      ...SET,
      questions: [...SET.questions, { type: 'box', name: 'id_box', instructions: 'The ID.' }],
    }
    expect(() =>
      toWireRequest('openai-decisions', withBox, { model: 'm', imageDataUrl: PHOTO }),
    ).toThrow(QuestionSetError)
  })
})

describe('toWireRequest for OpenRouter Decisions', () => {
  it('translates predicate to noul, choice to a criteria map, score levels to an ordered criteria list, and drops detail', () => {
    const withBox: SharedQuestionSet = {
      ...SET,
      questions: [...SET.questions, { type: 'box', name: 'id_box', instructions: 'The ID.' }],
    }
    expect(
      toWireRequest('openrouter-decisions', withBox, {
        model: '~typesafe/jev-latest',
        imageDataUrl: PHOTO,
      }),
    ).toEqual({
      model: '~typesafe/jev-latest',
      state: ['Freight container photo.', { type: 'image_url', image_url: { url: PHOTO } }],
      questions: {
        door_end: { type: 'noul', instructions: 'Is the door end in view?' },
        quality: {
          type: 'choice',
          instructions: 'Is the photo good enough?',
          criteria: { good: 'Sharp and well lit', poor: null },
        },
        severity: {
          type: 'score',
          instructions: 'How severe is the worst defect?',
          criteria: ['none: No defect.', 'minor', 'major: Needs a closer look.'],
        },
        id_box: { type: 'box', instructions: 'The ID.' },
      },
    })
  })

  it('joins several text parts into the one text ahead of the photo', () => {
    const twoTexts: SharedQuestionSet = {
      ...SET,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'First.' },
            { type: 'input_text', text: 'Second.' },
            { type: 'input_image', image_url: 'x' },
          ],
        },
      ],
    }
    const request = toWireRequest('openrouter-decisions', twoTexts, {
      model: 'm',
      imageDataUrl: PHOTO,
    })
    expect(request.state).toEqual([
      'First.\n\nSecond.',
      { type: 'image_url', image_url: { url: PHOTO } },
    ])
  })
})

/** n predicate questions, named q1..qn. */
function predicates(n: number): SharedQuestionSet {
  return {
    input: SET.input,
    questions: Array.from({ length: n }, (_, i) => ({
      type: 'predicate' as const,
      name: `q${i + 1}`,
      instructions: `Question ${i + 1}?`,
    })),
  }
}

function choiceWith(n: number): SharedQuestionSet {
  return {
    input: SET.input,
    questions: [
      {
        type: 'choice',
        name: 'many',
        instructions: 'Which?',
        choices: Array.from({ length: n }, (_, i) => ({
          value: `v${i}`,
          description: `Option ${i}`,
        })),
      },
    ],
  }
}

describe('request limits', () => {
  it.each(['openai-decisions', 'openrouter-decisions'] as const)(
    '%s takes 200 questions and refuses 201 before sending',
    (wire) => {
      const opts = { model: 'm', imageDataUrl: PHOTO }
      expect(() => toWireRequest(wire, predicates(200), opts)).not.toThrow()
      expect(() => toWireRequest(wire, predicates(201), opts)).toThrow(/at most 200 questions/)
    },
  )

  it.each(['openai-decisions', 'openrouter-decisions'] as const)(
    '%s takes 255 choices on one question and refuses 256',
    (wire) => {
      const opts = { model: 'm', imageDataUrl: PHOTO }
      expect(() => toWireRequest(wire, choiceWith(255), opts)).not.toThrow()
      expect(() => toWireRequest(wire, choiceWith(256), opts)).toThrow(/at most 255 choices/)
    },
  )

  it('splits an over-long set into requests of at most 200 questions, each with the same photo text, in order', () => {
    const parts = splitQuestionSet(predicates(450), 'openai-decisions')
    expect(parts.map((p) => p.questions.length)).toEqual([200, 200, 50])
    expect(parts.every((p) => p.input === SET.input)).toBe(true)
    expect(parts.flatMap((p) => p.questions.map((q) => q.name))).toEqual(
      predicates(450).questions.map((q) => q.name),
    )
  })

  it('leaves a set within the limit as one request', () => {
    expect(splitQuestionSet(predicates(132), 'openrouter-decisions')).toHaveLength(1)
  })

  it('refuses to split a question with too many choices, since splitting it would change its meaning', () => {
    expect(() => splitQuestionSet(choiceWith(300), 'openai-decisions')).toThrow(QuestionSetError)
  })

  it('refuses duplicate question names, which would overwrite each other in OpenRouter’s map', () => {
    const dup = { ...SET, questions: [SET.questions[0]!, SET.questions[0]!] }
    expect(() =>
      toWireRequest('openrouter-decisions', dup, { model: 'm', imageDataUrl: PHOTO }),
    ).toThrow(/door_end/)
  })
})

describe('readAnswers from OpenAI Decisions', () => {
  // Answer shapes as OpenAI returned them live on 16 Oct 2026 (COYU photo, one question of each type).
  const response = {
    model: 'gpt-6-luna',
    answers: [
      { type: 'predicate', name: 'door_end', probability: 0.97 },
      {
        type: 'choice',
        name: 'quality',
        choice: 'good',
        probabilities: [
          { value: 'good', probability: 0.8 },
          { value: 'poor', probability: 0.2 },
        ],
        confidence: 0.7,
      },
      {
        type: 'score',
        name: 'severity',
        score: 1.4,
        probabilities: [
          { value: 0, label: 'none', probability: 0.1 },
          { value: 1, label: 'minor', probability: 0.4 },
          { value: 2, label: 'major', probability: 0.5 },
        ],
        confidence: 0.3,
      },
    ],
    usage: { input_tokens: 1561, output_tokens: 0, total_tokens: 1561 },
  }

  it('maps each answer by meaning: probability, value with probabilities, level index with its label', () => {
    expect(readAnswers('openai-decisions', response, SET, 'gpt-6-luna')).toEqual({
      answers: {
        door_end: { type: 'predicate', probability: 0.97 },
        quality: {
          type: 'choice',
          value: 'good',
          probabilities: { good: 0.8, poor: 0.2 },
          confidence: 0.7,
        },
        severity: {
          type: 'score',
          level: 2,
          label: 'major',
          score: 1.4,
          probabilities: [0.1, 0.4, 0.5],
          confidence: 0.3,
        },
      },
      resolvedModel: 'gpt-6-luna',
      usage: { inputTokens: 1561, outputTokens: 0 },
      reportedCostUsd: null,
    })
  })

  it('leaves out an answer to a question not asked, or a choice not offered', () => {
    const odd = {
      answers: [
        { type: 'predicate', name: 'not_asked', probability: 1 },
        { type: 'choice', name: 'quality', choice: 'excellent', probabilities: [] },
      ],
    }
    expect(readAnswers('openai-decisions', odd, SET, 'gpt-6-luna').answers).toEqual({})
  })

  it('refuses a reply without answers', () => {
    expect(() => readAnswers('openai-decisions', { model: 'x' }, SET, 'gpt-6-luna')).toThrow(
      UnreadableReplyError,
    )
  })
})

describe('readAnswers from OpenRouter Decisions', () => {
  const withBox: SharedQuestionSet = {
    ...SET,
    questions: [...SET.questions, { type: 'box', name: 'id_box', instructions: 'The ID.' }],
  }
  // Answer shapes as OpenRouter returned them live on 16 Oct 2026 (Jev latest, COYU photo).
  const response = {
    model: 'typesafe/jev-1.14-20261014',
    answers: {
      door_end: { type: 'noul', noul: 0.98 },
      quality: {
        type: 'choice',
        choice: 'good',
        probabilities: { good: 1, poor: 0 },
        confidence: 1,
      },
      severity: {
        type: 'score',
        score: 0.4,
        legend: { '0': 'none: No defect.', '1': 'minor', '2': 'major: Needs a closer look.' },
        probabilities: { '0': 0.7, '1': 0.2, '2': 0.1 },
        confidence: 0.82,
      },
      id_box: {
        type: 'box',
        box: { top: 0.1, bottom: 0.15, left: 0.62, right: 0.81 },
        confidence: 0.86,
      },
    },
    usage: { input_tokens: 3488, output_tokens: 91, cost: 0.000146496 },
  }

  it('maps noul to a probability, choice to value and probabilities, score to a level and label, box to a normalised box', () => {
    expect(readAnswers('openrouter-decisions', response, withBox, '~typesafe/jev-latest')).toEqual({
      answers: {
        door_end: { type: 'predicate', probability: 0.98 },
        quality: {
          type: 'choice',
          value: 'good',
          probabilities: { good: 1, poor: 0 },
          confidence: 1,
        },
        severity: {
          type: 'score',
          level: 0,
          label: 'none',
          score: 0.4,
          probabilities: [0.7, 0.2, 0.1],
          confidence: 0.82,
        },
        id_box: {
          type: 'box',
          box: { top: 0.1, bottom: 0.15, left: 0.62, right: 0.81 },
          confidence: 0.86,
        },
      },
      resolvedModel: 'typesafe/jev-1.14-20261014',
      usage: { inputTokens: 3488, outputTokens: 91 },
      reportedCostUsd: 0.000146496,
    })
  })

  it('drops a box whose edges are outside the photo or crossed', () => {
    const bad = {
      answers: {
        id_box: {
          type: 'box',
          box: { top: 0.5, bottom: 0.2, left: 0.1, right: 1.4 },
          confidence: 1,
        },
      },
    }
    expect(readAnswers('openrouter-decisions', bad, withBox, 'm').answers).toEqual({})
  })

  it('falls back to the requested model and a null cost when the reply reports neither', () => {
    const bare = { answers: { door_end: { type: 'noul', noul: 0.2 } } }
    expect(readAnswers('openrouter-decisions', bare, SET, 'requested')).toMatchObject({
      resolvedModel: 'requested',
      usage: null,
      reportedCostUsd: null,
    })
  })
})

describe('parseQuestionSet', () => {
  const sideSet = JSON.parse(
    readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../questionSets/side-damage-v2.json',
      ),
      'utf8',
    ),
  ) as unknown

  it('reads the product owner’s side damage set: 132 questions of the three OpenAI types', () => {
    const set = parseQuestionSet(sideSet)
    expect(set.questions).toHaveLength(132)
    const count = (type: string) => set.questions.filter((q) => q.type === type).length
    expect([count('predicate'), count('choice'), count('score')]).toEqual([99, 23, 10])
  })

  it('translates the side damage set for both wire formats within their limits', () => {
    const set = parseQuestionSet(sideSet)
    const opts = { model: 'm', imageDataUrl: PHOTO }
    const openai = toWireRequest('openai-decisions', set, opts)
    expect(openai.input[0]!.content[1]).toEqual({
      type: 'input_image',
      image_url: PHOTO,
      detail: 'original',
    })

    const openrouter = toWireRequest('openrouter-decisions', set, opts)
    expect(Object.keys(openrouter.questions)).toHaveLength(132)
    expect(openrouter.state[1]).toEqual({ type: 'image_url', image_url: { url: PHOTO } })
    expect(openrouter.questions.Z1T_severity).toMatchObject({ type: 'score' })
    expect(openrouter.questions.any_visible_defect).toEqual({
      type: 'noul',
      instructions: expect.stringContaining('ANY exterior container component'),
    })
    expect(JSON.stringify(openrouter)).not.toContain('detail')
  })

  it('refuses a question of an unknown type', () => {
    expect(() =>
      parseQuestionSet({
        input: SET.input,
        questions: [{ type: 'ranking', name: 'x', instructions: 'y' }],
      }),
    ).toThrow(/ranking/)
  })
})
