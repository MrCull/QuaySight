// Reading a Decisions reply back by meaning (spec #27, ticket #29; split out in ticket #54).
import type { Usage } from './ledger'
import {
  UnreadableReplyError,
  asRecord,
  type AnswersReading,
  type NormalisedBox,
  type QuestionWireFormat,
  type SharedAnswer,
  type SharedQuestion,
  type SharedQuestionSet,
} from './questionSetTypes'

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
