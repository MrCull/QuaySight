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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
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
 * docs/research/question-sets/side-damage-v2.json). Any `model` in the file is ignored: the catalogue
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

// ---------------------------------------------------------------------------------------------------
// Limits

function checkNames(set: SharedQuestionSet): void {
  const seen = new Set<string>()
  for (const q of set.questions) {
    if (seen.has(q.name)) throw new QuestionSetError(`Question ${q.name} is asked twice.`)
    seen.add(q.name)
  }
  for (const q of set.questions) {
    if (q.type === 'choice' && q.choices.length === 0) {
      throw new QuestionSetError(`Question ${q.name} offers no choices.`)
    }
    if (q.type === 'score' && q.levels.length === 0) {
      throw new QuestionSetError(`Question ${q.name} has no levels.`)
    }
  }
}

function checkChoices(set: SharedQuestionSet, wire: QuestionWireFormat): void {
  const { maxChoices } = REQUEST_LIMITS[wire]
  for (const q of set.questions) {
    if (q.type === 'choice' && q.choices.length > maxChoices) {
      throw new QuestionSetError(
        `Question ${q.name} offers ${q.choices.length} choices; ${wire} takes at most ${maxChoices} choices per question.`,
      )
    }
  }
}

/** Refuses a set the wire format cannot take in one request. Called before anything is sent. */
function checkLimits(set: SharedQuestionSet, wire: QuestionWireFormat): void {
  checkNames(set)
  checkChoices(set, wire)
  const { maxQuestions } = REQUEST_LIMITS[wire]
  if (set.questions.length > maxQuestions) {
    throw new QuestionSetError(
      `${set.questions.length} questions; ${wire} takes at most ${maxQuestions} questions per request. Split the set first.`,
    )
  }
  if (wire === 'openai-decisions') {
    const box = set.questions.find((q) => q.type === 'box')
    if (box)
      throw new QuestionSetError(
        `Question ${box.name} is a box question, which OpenAI does not take.`,
      )
  }
}

/**
 * The set as one or more sets within the wire format's question limit, in order, each with the same
 * input. A choice question over the choice limit is refused: splitting its options would change what
 * it asks (the manifest check splits its own entries, saying so in each part).
 */
export function splitQuestionSet(
  set: SharedQuestionSet,
  wire: QuestionWireFormat,
): SharedQuestionSet[] {
  checkNames(set)
  checkChoices(set, wire)
  const { maxQuestions } = REQUEST_LIMITS[wire]
  const parts: SharedQuestionSet[] = []
  for (let i = 0; i < set.questions.length; i += maxQuestions) {
    parts.push({ input: set.input, questions: set.questions.slice(i, i + maxQuestions) })
  }
  return parts.length > 0 ? parts : [set]
}

// ---------------------------------------------------------------------------------------------------
// Requests

export interface OpenAiDecisionsRequest {
  model: string
  input: { role: 'user'; content: InputPart[] }[]
  questions: Exclude<SharedQuestion, BoxQuestion>[]
}

export type OpenRouterQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'box'; instructions: string }

export interface OpenRouterImagePart {
  type: 'image_url'
  image_url: { url: string }
}

export interface OpenRouterDecisionsRequest {
  model: string
  state: (string | OpenRouterImagePart)[]
  questions: Record<string, OpenRouterQuestion>
}

export interface WireRequestOptions {
  /** The model id sent on the wire, from the catalogue. */
  model: string
  /** The photo as a data URL with its real MIME type. Replaces every image part's placeholder. */
  imageDataUrl: string
}

/** The questions in OpenRouter's (and TypeSafe System One's) format: a map by name. */
export function toOpenRouterQuestions(
  questions: SharedQuestion[],
): Record<string, OpenRouterQuestion> {
  return Object.fromEntries(
    questions.map((q): [string, OpenRouterQuestion] => {
      switch (q.type) {
        case 'predicate':
          return [q.name, { type: 'noul', instructions: q.instructions }]
        case 'choice':
          return [
            q.name,
            {
              type: 'choice',
              instructions: q.instructions,
              criteria: Object.fromEntries(q.choices.map((c) => [c.value, c.description ?? null])),
            },
          ]
        case 'score':
          return [
            q.name,
            {
              type: 'score',
              instructions: q.instructions,
              criteria: q.levels.map((l) =>
                l.description ? `${l.label}: ${l.description}` : l.label,
              ),
            },
          ]
        case 'box':
          return [q.name, { type: 'box', instructions: q.instructions }]
      }
    }),
  )
}

function toOpenAi(set: SharedQuestionSet, options: WireRequestOptions): OpenAiDecisionsRequest {
  return {
    model: options.model,
    input: set.input.map((message) => ({
      role: message.role,
      content: message.content.map((part) =>
        part.type === 'input_image' ? { ...part, image_url: options.imageDataUrl } : part,
      ),
    })),
    questions: set.questions.filter((q) => q.type !== 'box'),
  }
}

function toOpenRouter(
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenRouterDecisionsRequest {
  // Text parts in a row become one text; image parts lose fields OpenRouter does not take (detail).
  const state: (string | OpenRouterImagePart)[] = []
  for (const part of set.input.flatMap((m) => m.content)) {
    if (part.type === 'input_image') {
      state.push({ type: 'image_url', image_url: { url: options.imageDataUrl } })
      continue
    }
    const last = state[state.length - 1]
    if (typeof last === 'string') state[state.length - 1] = `${last}\n\n${part.text}`
    else state.push(part.text)
  }
  return { model: options.model, state, questions: toOpenRouterQuestions(set.questions) }
}

/**
 * The request body for one photo in a wire format. Throws QuestionSetError, before anything is sent,
 * for a set over the format's question or choice limit, or with a question type it does not take.
 */
export function toWireRequest(
  wire: 'openai-decisions',
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest
export function toWireRequest(
  wire: 'openrouter-decisions',
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenRouterDecisionsRequest
export function toWireRequest(
  wire: QuestionWireFormat,
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest | OpenRouterDecisionsRequest
export function toWireRequest(
  wire: QuestionWireFormat,
  set: SharedQuestionSet,
  options: WireRequestOptions,
): OpenAiDecisionsRequest | OpenRouterDecisionsRequest {
  checkLimits(set, wire)
  return wire === 'openai-decisions' ? toOpenAi(set, options) : toOpenRouter(set, options)
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

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** One raw answer in a common form: OpenAI's list entries and OpenRouter's map values both reduce to this. */
interface RawAnswer {
  type: unknown
  probability: number | null
  choice: unknown
  /** By option value (choice) or level index (score). */
  probabilities: Map<string, number>
  score: number | null
  box: unknown
  confidence: number | null
}

function probabilityMap(raw: unknown): Map<string, number> {
  const map = new Map<string, number>()
  if (Array.isArray(raw)) {
    // OpenAI: [{ value, probability }]; a score's value is its level index.
    for (const entry of raw) {
      const e = asRecord(entry)
      const p = finite(e?.probability)
      if (e && (typeof e.value === 'string' || typeof e.value === 'number') && p !== null) {
        map.set(String(e.value), p)
      }
    }
  } else {
    // OpenRouter: { value: probability }; a score's keys are level indexes.
    for (const [value, probability] of Object.entries(asRecord(raw) ?? {})) {
      const p = finite(probability)
      if (p !== null) map.set(value, p)
    }
  }
  return map
}

function rawAnswer(record: Record<string, unknown>): RawAnswer {
  return {
    type: record.type,
    probability: finite(record.probability) ?? finite(record.noul),
    choice: record.choice,
    probabilities: probabilityMap(record.probabilities),
    score: finite(record.score),
    box: record.box,
    confidence: finite(record.confidence),
  }
}

function readBox(raw: unknown): NormalisedBox | null {
  const box = asRecord(raw)
  if (!box) return null
  const [top, bottom, left, right] = [box.top, box.bottom, box.left, box.right].map(finite)
  if (top == null || bottom == null || left == null || right == null) return null
  const inPhoto = [top, bottom, left, right].every((edge) => edge >= 0 && edge <= 1)
  if (!inPhoto || top >= bottom || left >= right) return null
  return { top, bottom, left, right }
}

function answerTo(question: SharedQuestion, raw: RawAnswer): SharedAnswer | null {
  switch (question.type) {
    case 'predicate':
      if (raw.type !== 'predicate' && raw.type !== 'noul') return null
      if (raw.probability === null || raw.probability < 0 || raw.probability > 1) return null
      return { type: 'predicate', probability: raw.probability }
    case 'choice': {
      if (raw.type !== 'choice' || typeof raw.choice !== 'string') return null
      const offered = question.choices.map((c) => c.value)
      if (!offered.includes(raw.choice)) return null
      const probabilities: Record<string, number> = {}
      for (const value of offered) {
        const p = raw.probabilities.get(value)
        if (p !== undefined) probabilities[value] = p
      }
      return { type: 'choice', value: raw.choice, probabilities, confidence: raw.confidence }
    }
    case 'score': {
      if (raw.type !== 'score') return null
      const probabilities = question.levels.map((_, i) => raw.probabilities.get(String(i)) ?? 0)
      const anyProbability = question.levels.some((_, i) => raw.probabilities.has(String(i)))
      let level: number
      if (anyProbability) {
        level = probabilities.reduce((best, p, i) => (p > (probabilities[best] ?? 0) ? i : best), 0)
      } else if (raw.score !== null) {
        level = Math.round(raw.score)
      } else {
        return null
      }
      const label = question.levels[level]?.label
      if (label === undefined) return null
      return {
        type: 'score',
        level,
        label,
        score: raw.score,
        probabilities,
        confidence: raw.confidence,
      }
    }
    case 'box': {
      if (raw.type !== 'box') return null
      const box = readBox(raw.box)
      return box ? { type: 'box', box, confidence: raw.confidence } : null
    }
  }
}

function readUsage(raw: unknown): Usage | null {
  const record = asRecord(raw)
  if (!record) return null
  const inputTokens = finite(record.input_tokens) ?? finite(record.prompt_tokens)
  if (inputTokens === null) return null
  return {
    inputTokens,
    outputTokens: finite(record.output_tokens) ?? finite(record.completion_tokens),
  }
}

/**
 * Maps a Decisions reply onto the set's questions by meaning. OpenAI lists named answers; OpenRouter
 * (and TypeSafe System One) key them by name. Answers to questions not in the set, values not offered,
 * levels out of range and boxes outside the photo are left out. Throws UnreadableReplyError for a reply
 * with no answers at all; the caller words that for its provider.
 */
export function readAnswers(
  wire: QuestionWireFormat,
  response: unknown,
  set: SharedQuestionSet,
  requestedModel: string,
): AnswersReading {
  const body = asRecord(response)
  if (!body) throw new UnreadableReplyError('unrecognised')

  const raw = new Map<string, Record<string, unknown>>()
  if (wire === 'openai-decisions') {
    if (!Array.isArray(body.answers)) throw new UnreadableReplyError('no-answers')
    for (const entry of body.answers) {
      const record = asRecord(entry)
      if (record && typeof record.name === 'string') raw.set(record.name, record)
    }
  } else {
    const map = asRecord(body.answers)
    if (!map) throw new UnreadableReplyError('no-answers')
    for (const [name, entry] of Object.entries(map)) {
      const record = asRecord(entry)
      if (record) raw.set(name, record)
    }
  }

  const answers: Record<string, SharedAnswer> = {}
  for (const question of set.questions) {
    const record = raw.get(question.name)
    if (!record) continue
    const answer = answerTo(question, rawAnswer(record))
    if (answer) answers[question.name] = answer
  }

  const model =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : requestedModel
  return {
    answers,
    resolvedModel: model,
    usage: readUsage(body.usage),
    reportedCostUsd: finite(asRecord(body.usage)?.cost),
  }
}
