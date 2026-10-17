// The one question format (spec #27, ticket #29). Pure functions: no fetch, no storage.
//
// A question set is authored once, in the OpenAI Decisions request shape the product owner uses
// (docs/research/question-sets/): `input` messages with text and image parts, and named `predicate`,
// `choice` (choices as {value, description}) and `score` (ordered `levels`) questions. `box` is the one
// addition, for models that locate things; OpenAI does not take it.
//
// toWireRequest translates a set for one wire format, refusing it before anything is sent when it breaks
// that format's limits. readAnswers maps a reply back by meaning, whichever format it came in.
// Shapes checked live on 16 Oct 2026 (docs/research/live-api-findings-2026-10-16.md).
//
// This file authors and parses sets. The shapes (questionSetTypes), refusal checks (questionSetLimits,
// questionSetWording), wire requests (questionSetWire) and reply reading (questionSetAnswers) live beside
// it and are re-exported here, so importers keep one path.
import { asRecord, QuestionSetError } from './questionSetTypes'
import type { InputPart, SharedQuestion, SharedQuestionSet } from './questionSetTypes'
import { checkNames } from './questionSetLimits'

export * from './questionSetTypes'
export * from './questionSetLimits'
export * from './questionSetWire'
export * from './questionSetAnswers'

// ---------------------------------------------------------------------------------------------------
// Authoring helpers

/** A set with one text part ahead of the photo, the usual shape for sets written in code. */
export function questionSet(instructions: string, questions: SharedQuestion[]): SharedQuestionSet {
  return {
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: instructions },
          { type: 'input_image', image_url: 'data:image/jpeg;base64,{{imageBase64}}' },
        ],
      },
    ],
    questions,
  }
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new QuestionSetError(`${where} needs text.`)
  return value
}

function optionalText(value: unknown): { description?: string } {
  return typeof value === 'string' ? { description: value } : {}
}

function parsePart(raw: unknown): InputPart {
  const part = asRecord(raw)
  if (part?.type === 'input_text')
    return { type: 'input_text', text: text(part.text, 'A text part') }
  if (part?.type === 'input_image') {
    return {
      type: 'input_image',
      image_url: text(part.image_url, 'An image part'),
      ...(typeof part.detail === 'string' ? { detail: part.detail } : {}),
    }
  }
  throw new QuestionSetError(`Unknown input part type: ${String(part?.type)}.`)
}

function parseQuestion(raw: unknown): SharedQuestion {
  const q = asRecord(raw)
  const name = text(q?.name, 'A question name')
  const instructions = text(q?.instructions, `Question ${name}`)
  switch (q?.type) {
    case 'predicate':
    case 'box':
      return { type: q.type, name, instructions }
    case 'choice': {
      if (!Array.isArray(q.choices)) throw new QuestionSetError(`Question ${name} has no choices.`)
      return {
        type: 'choice',
        name,
        instructions,
        choices: q.choices.map((c) => {
          const choice = asRecord(c)
          return {
            value: text(choice?.value, `A choice of ${name}`),
            ...optionalText(choice?.description),
          }
        }),
      }
    }
    case 'score': {
      if (!Array.isArray(q.levels)) throw new QuestionSetError(`Question ${name} has no levels.`)
      return {
        type: 'score',
        name,
        instructions,
        levels: q.levels.map((l) => {
          const level = asRecord(l)
          return {
            label: text(level?.label, `A level of ${name}`),
            ...optionalText(level?.description),
          }
        }),
      }
    }
    default:
      throw new QuestionSetError(`Question ${name} has an unknown type: ${String(q?.type)}.`)
  }
}

/**
 * Reads a question set authored as JSON in the OpenAI Decisions request shape (e.g.
 * src/domain/questionSets/side-damage-v2.json). Any `model` in the file is ignored: the catalogue
 * chooses the model. Throws QuestionSetError for anything it cannot send.
 */
export function parseQuestionSet(json: unknown): SharedQuestionSet {
  const body = asRecord(json)
  if (!body || !Array.isArray(body.input) || !Array.isArray(body.questions)) {
    throw new QuestionSetError('A question set needs input and questions.')
  }
  const set: SharedQuestionSet = {
    input: body.input.map((m) => {
      const message = asRecord(m)
      if (!message || !Array.isArray(message.content)) {
        throw new QuestionSetError('Each input message needs content.')
      }
      return { role: 'user', content: message.content.map(parsePart) }
    }),
    questions: body.questions.map(parseQuestion),
  }
  checkNames(set)
  return set
}
