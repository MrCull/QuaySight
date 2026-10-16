// OpenAI Decisions API adapter for GPT-6 Luna (spec 11.4, 11.5, 11.6). Pure functions: no fetch, no storage.
// Endpoint and request shape follow the live OpenAI Decisions guide (developers.openai.com/api/docs/guides/decisions):
// POST /v1/decisions, input as user messages with input_text and input_image parts (inline base64 data URLs),
// and named questions of type predicate, choice or score. The guide documents no response model/version or
// usage fields; the mapper reads them defensively and reports what is absent rather than inventing it.
import { calculateCheckDigit } from './iso6346'
import { buildContainerIdReading } from './containerId'
import { CERTAINTY_LABELS, UNREAD } from './certainty'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import type { Usage } from './ledger'

export const LUNA_MODEL = 'gpt-6-luna'
export const LUNA_ENDPOINT = 'https://api.openai.com/v1/decisions'
/** Endpoint family key used by the rate schedules and ledger. */
export const LUNA_ENDPOINT_ID = 'decisions'

/** Spec 4.2: the check-digit guidance included in the identification instructions. Verbatim. */
export const CHECK_DIGIT_GUIDANCE =
  'A standard container number has three owner-code letters, one equipment-category letter, six serial digits and one check digit. To calculate the check digit, assign numeric values to letters starting at A=10 and skipping multiples of 11 (for example B=12, K=21, L=23, U=32). Digits retain their numeric value. Multiply the first ten values by 1, 2, 4, 8, 16, 32, 64, 128, 256 and 512; sum and take the remainder modulo 11. Remainder 10 is displayed as 0. Use this as a consistency constraint when comparing visually plausible numbers, but do not invent or change clearly visible characters just to satisfy it.'

const IDENTIFICATION_INSTRUCTIONS =
  'Read the container identification (ISO 6346 owner code, category, serial number and check digit) printed on this freight container photo. Answer each numbered position with the one character you can see. If a position is not visible or cannot be read, give a low probability for every choice rather than a clear character. ' +
  CHECK_DIGIT_GUIDANCE

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const DIGITS = Array.from({ length: 10 }, (_, i) => String(i))

export interface LunaChoiceQuestion {
  type: 'choice'
  name: string
  instructions: string
  choices: { value: string; description: string }[]
}

export interface LunaRequestBody {
  model: typeof LUNA_MODEL
  input: {
    role: 'user'
    content: ({ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string })[]
  }[]
  questions: LunaChoiceQuestion[]
}

const ID_POSITIONS = 11
const LETTER_POSITIONS = 4

function questionName(position: number): string {
  return `id_char_${String(position).padStart(2, '0')}`
}

/**
 * One choice question per character position: letters for owner code and category, digits for serial and check digit.
 * With positions, only those (1-based) are asked; the re-check uses this for the unread ones.
 */
export function buildIdQuestions(positions?: number[]): LunaChoiceQuestion[] {
  const wanted = positions ?? Array.from({ length: ID_POSITIONS }, (_, i) => i + 1)
  return wanted.map((position) => {
    const isLetter = position <= LETTER_POSITIONS
    const values = isLetter ? LETTERS : DIGITS
    const role = isLetter
      ? position <= 3
        ? 'owner code letter'
        : 'equipment category letter'
      : position === ID_POSITIONS
        ? 'check digit'
        : 'serial digit'
    return {
      type: 'choice',
      name: questionName(position),
      instructions: `Position ${position} of 11 (${role}).`,
      choices: values.map((value) => ({ value, description: value })),
    }
  })
}

/** Builds the Decisions request for one photo. The data URL must carry the photo's real MIME type. */
export function buildLunaRequest(imageDataUrl: string, positions?: number[]): LunaRequestBody {
  return {
    model: LUNA_MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: IDENTIFICATION_INSTRUCTIONS },
          { type: 'input_image', image_url: imageDataUrl },
        ],
      },
    ],
    questions: buildIdQuestions(positions),
  }
}

export type LunaErrorKind = 'http' | 'network' | 'bad-response'

/** An error with a message fit to show the presenter. Never carries the key. */
export class LunaError extends Error {
  readonly kind: LunaErrorKind
  readonly status: number | null

  constructor(kind: LunaErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'LunaError'
    this.kind = kind
    this.status = status
  }
}

const KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g

function redact(text: string, apiKey: string): string {
  let safe = text
  if (apiKey) safe = safe.split(apiKey).join('[key removed]')
  return safe.replace(KEY_PATTERN, '[key removed]').slice(0, 200)
}

function providerMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message.trim() : null
}

/** Turns a non-2xx Decisions response into an actionable message. The key is removed from any echoed text. */
export function lunaFailure(status: number, body: unknown, apiKey: string): LunaError {
  if (status === 401 || status === 403) {
    return new LunaError(
      'http',
      'The key was rejected by OpenAI. Check the GPT-6 Luna key, then try again. The key is not stored.',
      status,
    )
  }
  if (status === 429) {
    return new LunaError(
      'http',
      'OpenAI rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
      status,
    )
  }
  if (status === 404) {
    return new LunaError(
      'http',
      `OpenAI could not find the Decisions endpoint or ${LUNA_MODEL} for this key. Check the model version and that the key has access.`,
      status,
    )
  }
  if (status >= 500) {
    return new LunaError(
      'http',
      'OpenAI is unavailable right now. Try again shortly. Any partial result is kept.',
      status,
    )
  }
  const detail = providerMessage(body)
  return new LunaError(
    'http',
    detail
      ? `OpenAI rejected the request (${status}): ${redact(detail, apiKey)}`
      : `OpenAI rejected the request (${status}). Check the photo and model, then try again.`,
    status,
  )
}

export interface LunaMapping {
  containerId: ContainerIdReading
  /** One reading per position (11 entries). Positions not asked, or not answered, are unread. */
  readings: ChoiceReading[]
  /** The model the response reports, or the requested model when it reports none. */
  resolvedModel: string
  /** Usage from the response's own fields, or null when the response carries none. */
  usage: Usage | null
}

export interface ChoiceReading {
  value: string | null
  certainty: CertaintyLabel
  runnerUp: string | null
}

const POSITION_CONFIDENT = 0.9
const POSITION_LIKELY = 0.6
const POSITION_UNCERTAIN = 0.3
const RUNNER_UP_MIN = 0.15

function certaintyOf(probability: number): CertaintyLabel {
  if (probability >= POSITION_CONFIDENT) return 'Confident'
  if (probability >= POSITION_LIKELY) return 'Likely'
  if (probability >= POSITION_UNCERTAIN) return 'Uncertain'
  return "Can't tell"
}

function readChoice(answer: unknown, allowed: string[]): ChoiceReading {
  const unread: ChoiceReading = { value: null, certainty: "Can't tell", runnerUp: null }
  if (typeof answer !== 'object' || answer === null) return unread
  const record = answer as Record<string, unknown>
  if (record.type !== 'choice' || typeof record.choice !== 'string') return unread
  const probabilities = Array.isArray(record.probabilities) ? record.probabilities : []
  const scored = probabilities
    .map((entry) => {
      const e = entry as { value?: unknown; probability?: unknown }
      return {
        value: typeof e.value === 'string' ? e.value : null,
        probability: typeof e.probability === 'number' ? e.probability : NaN,
      }
    })
    .filter((e) => e.value !== null && allowed.includes(e.value) && Number.isFinite(e.probability))
    .sort((a, b) => b.probability - a.probability)
  const chosen = scored.find((e) => e.value === record.choice)
  if (!chosen || !allowed.includes(record.choice)) return unread
  const certainty = certaintyOf(chosen.probability)
  if (certainty === "Can't tell") return unread
  const runner = scored.find((e) => e.value !== chosen.value && e.probability >= RUNNER_UP_MIN)
  return { value: chosen.value, certainty, runnerUp: runner?.value ?? null }
}

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  let worst = 0
  for (const label of labels) worst = Math.max(worst, CERTAINTY_LABELS.indexOf(label))
  return CERTAINTY_LABELS[worst] ?? "Can't tell"
}

/**
 * Maps a Decisions response to the shared container-ID reading. Missing, refused or low-probability
 * positions stay as UNREAD; they are never filled in. The check digit is calculated here, not taken from the model.
 * With positions, only those are read; any other position is unread whatever the response says.
 */
export function mapLunaResponse(
  response: unknown,
  requestedModel: string,
  positions?: number[],
): LunaMapping {
  if (typeof response !== 'object' || response === null) {
    throw new LunaError('bad-response', 'OpenAI replied in a shape the app does not recognise.')
  }
  const body = response as Record<string, unknown>
  if (!Array.isArray(body.answers)) {
    throw new LunaError('bad-response', 'OpenAI replied without answers. Try again.')
  }
  const answers = body.answers as unknown[]
  const byName = new Map<string, unknown>()
  for (const answer of answers) {
    const name = (answer as { name?: unknown } | null)?.name
    if (typeof name === 'string') byName.set(name, answer)
  }

  const asked = new Set(positions ?? Array.from({ length: ID_POSITIONS }, (_, i) => i + 1))
  const readings = Array.from({ length: ID_POSITIONS }, (_, i) => {
    const position = i + 1
    if (!asked.has(position))
      return { value: null, certainty: "Can't tell" as const, runnerUp: null }
    const allowed = position <= LETTER_POSITIONS ? LETTERS : DIGITS
    return readChoice(byName.get(questionName(position)), allowed)
  })

  const resolvedModel =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : requestedModel
  return {
    containerId: assembleLunaReading(readings),
    readings,
    resolvedModel,
    usage: readUsage(body.usage),
  }
}

/** Builds the shared container-ID reading from one reading per position. Pure; used by the first pass and any re-check merge. */
export function assembleLunaReading(readings: ChoiceReading[]): ContainerIdReading {
  const chars = readings.map((r) => r.value ?? UNREAD)
  const positionCertainty = readings.map((r) => r.certainty)
  const printed = chars.join('')
  const certainty = worstOf(positionCertainty)

  let containerId: ContainerIdReading
  if (!printed.includes(UNREAD)) {
    containerId = {
      ...buildContainerIdReading({ printed, certainty }),
      positionCertainty,
    }
  } else {
    const tenKnown = !chars.slice(0, 10).includes(UNREAD)
    const observed = chars[10] === UNREAD ? null : Number(chars[10])
    const calculated = tenKnown ? calculateCheckDigit(chars.slice(0, 10).join('')) : null
    containerId = {
      value: printed,
      observedCheckDigit: observed,
      calculatedCheckDigit: calculated,
      checkDigitValid: tenKnown && observed !== null && observed === calculated,
      certainty,
      provenance: 'printed',
      positionCertainty,
    }
  }

  const alternatives: string[] = []
  readings.forEach((reading, index) => {
    if (reading.runnerUp === null || alternatives.length >= 2) return
    const swapped = [...chars]
    swapped[index] = reading.runnerUp
    alternatives.push(swapped.join(''))
  })
  if (alternatives.length > 0) containerId.alternatives = alternatives

  const uncertainPositions = readings
    .map((r, i) => (r.certainty === 'Confident' ? null : i + 1))
    .filter((p): p is number => p !== null)
  if (uncertainPositions.length > 0 && printed.includes(UNREAD)) {
    containerId.uncertainty = `Positions ${uncertainPositions.join(', ')} were not read clearly.`
  }
  return containerId
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function readUsage(raw: unknown): Usage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const inputTokens = numberField(record, ['input_tokens', 'prompt_tokens'])
  if (inputTokens === null) return null
  return {
    inputTokens,
    outputTokens: numberField(record, ['output_tokens', 'completion_tokens']),
  }
}
