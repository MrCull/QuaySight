// The question format's shapes, errors and request limits (spec #27, ticket #29; split out in ticket #54).
// Pure types and constants: questionSet.ts re-exports all of it, so importers keep their paths.
import type { Usage } from './ledger'

export interface PredicateQuestion {
  type: 'predicate'
  name: string
  instructions: string
}

export interface ChoiceOption {
  value: string
  description?: string
}

export interface ChoiceQuestion {
  type: 'choice'
  name: string
  instructions: string
  choices: ChoiceOption[]
}

export interface ScoreLevel {
  label: string
  description?: string
}

export interface ScoreQuestion {
  type: 'score'
  name: string
  instructions: string
  /** Lowest first. An answer's level is an index into this list. */
  levels: ScoreLevel[]
}

/** Where something is in the photo. OpenRouter and TypeSafe only, on box-capable models. */
export interface BoxQuestion {
  type: 'box'
  name: string
  instructions: string
}

export type SharedQuestion = PredicateQuestion | ChoiceQuestion | ScoreQuestion | BoxQuestion

export type InputPart =
  | { type: 'input_text'; text: string }
  /** The photo goes here. The authored image_url is a placeholder; any extra field (e.g. detail) is kept for OpenAI only. */
  | { type: 'input_image'; image_url: string; detail?: string }

export interface SharedQuestionSet {
  input: { role: 'user'; content: InputPart[] }[]
  questions: SharedQuestion[]
}

/** The wire formats a question set is translated for. TypeSafe direct speaks OpenRouter's question format. */
export type QuestionWireFormat = 'openai-decisions' | 'openrouter-decisions'

export interface RequestLimits {
  maxQuestions: number
  maxChoices: number
}

/**
 * Per request. OpenAI: 200 questions and 255 choices per question (checked live 16 Oct 2026).
 * OpenRouter forwards Luna Decisions to OpenAI and TypeSafe documents 255 options per choice, so the
 * same limits apply there.
 */
export const REQUEST_LIMITS: Record<QuestionWireFormat, RequestLimits> = {
  'openai-decisions': { maxQuestions: 200, maxChoices: 255 },
  'openrouter-decisions': { maxQuestions: 200, maxChoices: 255 },
}

/** A question set that cannot be sent as written, or a reply that cannot be read. App-facing, never shown raw. */
export class QuestionSetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuestionSetError'
  }
}

/** A reply that is not a Decisions reply, or carries no answers. Each provider adapter words it for the presenter. */
export class UnreadableReplyError extends Error {
  constructor(readonly kind: 'unrecognised' | 'no-answers') {
    super(
      kind === 'unrecognised'
        ? 'The reply is not in a recognised shape.'
        : 'The reply has no answers.',
    )
    this.name = 'UnreadableReplyError'
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// ---------------------------------------------------------------------------------------------------
// Answers

export interface PredicateAnswer {
  type: 'predicate'
  /** Probability the statement is true, 0..1. */
  probability: number
}

export interface ChoiceAnswer {
  type: 'choice'
  /** The chosen value, always one the question offered. */
  value: string
  /** Probability per offered value; values the reply left out are absent. */
  probabilities: Record<string, number>
  confidence: number | null
}

export interface ScoreAnswer {
  type: 'score'
  /** Index into the question's levels: the most probable level, or the rounded score without probabilities. */
  level: number
  /** The level's label as authored. */
  label: string
  /** The expected level (0 to levels - 1), or null when the reply gives none. */
  score: number | null
  /** Probability per level, by index; 0 where the reply gives none. */
  probabilities: number[]
  confidence: number | null
}

export interface NormalisedBox {
  /** Edges as fractions of the photo, 0..1, top < bottom and left < right. */
  top: number
  bottom: number
  left: number
  right: number
}

export interface BoxAnswer {
  type: 'box'
  box: NormalisedBox
  confidence: number | null
}

export type SharedAnswer = PredicateAnswer | ChoiceAnswer | ScoreAnswer | BoxAnswer

export interface AnswersReading {
  /** By question name. A question with no usable answer is absent: unread, never filled in. */
  answers: Record<string, SharedAnswer>
  /** The model the reply reports, or the requested model when it reports none. */
  resolvedModel: string
  usage: Usage | null
  /** Cost from the reply's own usage.cost (OpenRouter), or null. Never zero when absent. */
  reportedCostUsd: number | null
}
