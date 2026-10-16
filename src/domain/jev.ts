// TypeSafe Jev adapter (spec 11.4, 11.5, 11.6). Pure functions: no fetch, no storage.
// Endpoint, auth, image and model rules follow the live TypeSafe docs checked on 16 October 2026
// (docs.typesafe.ai/api, /models, /images, /primitives/box). The re-check is in docs/research/jev-guide-recheck.md.
// Images go in a top-level `assets` map and are sent as multipart file parts; the experimental image
// opt-in header is applied by the service. Which models take the box question is declared in the catalogue.
import { calculateCheckDigit } from './iso6346'
import { buildContainerIdReading } from './containerId'
import { CERTAINTY_LABELS, UNREAD, applyMargin } from './certainty'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import type { Usage } from './ledger'
import { supportsBox } from './providers'

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
/** Endpoint family key used by the rate schedules and ledger. */
export const JEV_ENDPOINT_ID = 'system-one'
/** Experimental image and box opt-in (docs.typesafe.ai/images). Sent only on requests that need it. */
export const JEV_IMAGE_HEADER = 'TypeSafe-Danger-Zone-Images'
/** The reference the request uses to point at the single photo, and the multipart part name. */
export const JEV_IMAGE_REF = 'photo_1'

/** Spec 4.2 check-digit guidance, as for Luna. Kept verbatim so both providers get the same constraint. */
export const CHECK_DIGIT_GUIDANCE =
  'A standard container number has three owner-code letters, one equipment-category letter, six serial digits and one check digit. To calculate the check digit, assign numeric values to letters starting at A=10 and skipping multiples of 11 (for example B=12, K=21, L=23, U=32). Digits retain their numeric value. Multiply the first ten values by 1, 2, 4, 8, 16, 32, 64, 128, 256 and 512; sum and take the remainder modulo 11. Remainder 10 is displayed as 0. Use this as a consistency constraint when comparing visually plausible numbers, but do not invent or change clearly visible characters just to satisfy it.'

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const DIGITS = Array.from({ length: 10 }, (_, i) => String(i))
const UNREADABLE_OPTION = 'unreadable'
const ID_POSITIONS = 11
const LETTER_POSITIONS = 4

export type JevPhotoFormat = 'jpeg' | 'png'

export interface JevChoiceQuestion {
  type: 'choice'
  instructions: string
  criteria: Record<string, string>
}

export interface JevScoreQuestion {
  type: 'score'
  instructions: string
  criteria: string[]
}

export interface JevNoulQuestion {
  type: 'noul'
  instructions: string
  criteria?: { true: string; false: string }
}

export interface JevBoxQuestion {
  type: 'box'
  instructions: string
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion | JevBoxQuestion

export interface JevAsset {
  type: 'image'
  part: string
  format: JevPhotoFormat
}

export interface JevRequestBody {
  model: string
  state: Record<string, unknown>
  questions: Record<string, JevQuestion>
  assets: Record<string, JevAsset>
}

/** Maps a photo's MIME type to the format Jev accepts, or null when Jev cannot take it. */
export function jevPhotoFormat(mimeType: string): JevPhotoFormat | null {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpeg'
  if (mimeType === 'image/png') return 'png'
  return null
}

function questionKey(position: number): string {
  return `id_char_${String(position).padStart(2, '0')}`
}

function roleOf(position: number): string {
  if (position <= 3) return 'owner code letter'
  if (position === 4) return 'equipment category letter'
  if (position === ID_POSITIONS) return 'check digit'
  return 'serial digit'
}

/** One choice question per identification position, with an explicit unreadable option (guide section 61). */
function identificationQuestions(): Record<string, JevChoiceQuestion> {
  const questions: Record<string, JevChoiceQuestion> = {}
  for (let position = 1; position <= ID_POSITIONS; position++) {
    const isLetter = position <= LETTER_POSITIONS
    const values = isLetter ? LETTERS : DIGITS
    const criteria: Record<string, string> = {}
    for (const value of values) criteria[value] = `${isLetter ? 'Letter' : 'Digit'} ${value}`
    criteria[UNREADABLE_OPTION] = 'The position is not visible or cannot be read clearly'
    questions[questionKey(position)] = {
      type: 'choice',
      instructions: `Position ${position} of 11 (${roleOf(position)}) of the container identification printed on the image referenced as \`${JEV_IMAGE_REF}\`. ${CHECK_DIGIT_GUIDANCE}`,
      criteria,
    }
  }
  return questions
}

/** Builds the System One request body for one photo. The key is never part of the body. */
export function buildJevRequest(model: string, format: JevPhotoFormat): JevRequestBody {
  const questions: Record<string, JevQuestion> = {
    ...identificationQuestions(),
    legibility: {
      type: 'score',
      instructions: `How legible is the full container identification printed on the image referenced as \`${JEV_IMAGE_REF}\`?`,
      criteria: [
        'Not visible at all',
        'Mostly unreadable',
        'Partly readable, with several positions unclear',
        'Mostly readable, with one or two positions unclear',
        'Fully readable and sharp',
      ],
    },
    full_number_visible: {
      type: 'noul',
      instructions: `Is the complete 11-character container identification visible within the image referenced as \`${JEV_IMAGE_REF}\`, with no part cut off?`,
    },
  }
  // Box support comes from the provider catalogue only (moving aliases report the version that answered).
  if (supportsBox('jev', model)) {
    questions.container_box = {
      type: 'box',
      instructions: `The container identification number printed on the container in the image referenced as \`${JEV_IMAGE_REF}\`.`,
    }
  }
  return {
    model,
    state: {
      image: JEV_IMAGE_REF,
      task: 'Freight container photo. Judge only what is visible in the referenced image.',
    },
    questions,
    assets: {
      [JEV_IMAGE_REF]: { type: 'image', part: JEV_IMAGE_REF, format },
    },
  }
}

export type JevErrorKind = 'http' | 'network' | 'bad-response' | 'photo'

/** An error with a message fit to show the presenter. Never carries the key. */
export class JevError extends Error {
  readonly kind: JevErrorKind
  readonly status: number | null

  constructor(kind: JevErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'JevError'
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

function providerError(body: unknown): { message: string | null; code: string | null } {
  if (typeof body !== 'object' || body === null) return { message: null, code: null }
  const error = (body as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return { message: null, code: null }
  const e = error as { message?: unknown; code?: unknown }
  return {
    message: typeof e.message === 'string' && e.message.trim() ? e.message.trim() : null,
    code: typeof e.code === 'string' ? e.code : null,
  }
}

/** Turns a non-2xx System One response into an actionable message. The key is removed from any echoed text. */
export function jevFailure(status: number, body: unknown, apiKey: string): JevError {
  const detail = providerError(body)
  if (status === 401) {
    return new JevError(
      'http',
      'TypeSafe rejected the key. Jev needs a TypeSafe console key from console.typesafe.ai, not a key from another provider. The key is not stored.',
      status,
    )
  }
  if (status === 400 && detail.code === 'max_tokens_exceeded') {
    return new JevError(
      'http',
      "The request is larger than Jev's context limit. Use one photo at a time and try again.",
      status,
    )
  }
  if (status === 400) {
    return new JevError(
      'http',
      'TypeSafe rejected the photo or request (400). Check that the photo is a PNG or JPEG, 280 to 1568 px per side, rotated upright, and up to 16 MB. Any partial result is kept.',
      status,
    )
  }
  if (status === 413) {
    return new JevError(
      'http',
      'The photo is too large for Jev. Use a smaller photo (up to 16 MB, 1568 px per side) and try again.',
      status,
    )
  }
  if (status === 415) {
    return new JevError(
      'http',
      'TypeSafe could not read the upload format. Try again with a PNG or JPEG.',
      status,
    )
  }
  if (status === 422) {
    return new JevError(
      'http',
      'TypeSafe rejected the question set (422). This is an app fault, not a photo fault. Nothing was retried for you.',
      status,
    )
  }
  if (status === 429) {
    return new JevError(
      'http',
      'TypeSafe rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
      status,
    )
  }
  if (status === 529) {
    return new JevError('http', 'TypeSafe is overloaded right now. Try again shortly.', status)
  }
  if (status >= 500) {
    return new JevError(
      'http',
      'TypeSafe is unavailable right now. Try again shortly. Any partial result is kept.',
      status,
    )
  }
  return new JevError(
    'http',
    detail.message
      ? `TypeSafe rejected the request (${status}): ${redact(detail.message, apiKey)}`
      : `TypeSafe rejected the request (${status}). Check the photo and model, then try again.`,
    status,
  )
}

export interface JevBox {
  top: number
  bottom: number
  left: number
  right: number
  confidence: number
}

export interface JevMapping {
  containerId: ContainerIdReading
  /** The versioned model the response reports (e.g. jev-1.13.0), or the requested model when none is reported. */
  resolvedModel: string
  /** Usage from the response's own fields, or null when the response carries none. */
  usage: Usage | null
  /** Cost from the response's own usage.cost, or null. Never zero when absent. */
  reportedCostUsd: number | null
  /** Experimental box, when the model returned one. Retained for the raw record; not drawn (no box-based damage). */
  box: JevBox | null
}

interface ChoiceReading {
  value: string | null
  certainty: CertaintyLabel
  runnerUp: string | null
}

const POSITION_CONFIDENT = 0.9
const POSITION_LIKELY = 0.6
const POSITION_UNCERTAIN = 0.3
const RUNNER_UP_MIN = 0.15
/** Score levels are 0 to 4. A weighted score below this reads as hard to read. */
const LEGIBILITY_FLOOR = 1.5
/** A noul below this means the complete number is probably not in frame. */
const FULL_NUMBER_MIN = 0.5

function certaintyOf(probability: number): CertaintyLabel {
  if (probability >= POSITION_CONFIDENT) return 'Confident'
  if (probability >= POSITION_LIKELY) return 'Likely'
  if (probability >= POSITION_UNCERTAIN) return 'Uncertain'
  return "Can't tell"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Reads one choice answer. Jev's probabilities are a map from option to probability. */
function readChoice(answer: unknown, allowed: string[]): ChoiceReading {
  const unread: ChoiceReading = { value: null, certainty: "Can't tell", runnerUp: null }
  const record = asRecord(answer)
  if (!record || record.type !== 'choice' || typeof record.choice !== 'string') return unread
  const probabilities = asRecord(record.probabilities)
  if (!probabilities || !allowed.includes(record.choice)) return unread
  const scored = Object.entries(probabilities)
    .filter(([value, p]) => allowed.includes(value) && typeof p === 'number' && Number.isFinite(p))
    .map(([value, p]) => ({ value, probability: p as number }))
    .sort((a, b) => b.probability - a.probability)
  const chosen = scored.find((e) => e.value === record.choice)
  if (!chosen) return unread
  const best = scored.find((e) => e.value !== chosen.value)
  const certainty = applyMargin(
    certaintyOf(chosen.probability),
    chosen.probability,
    best?.probability ?? null,
  )
  if (certainty === "Can't tell") return unread
  const runner = scored.find((e) => e.value !== chosen.value && e.probability >= RUNNER_UP_MIN)
  return { value: chosen.value, certainty, runnerUp: runner?.value ?? null }
}

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  let worst = 0
  for (const label of labels) worst = Math.max(worst, CERTAINTY_LABELS.indexOf(label))
  return CERTAINTY_LABELS[worst] ?? "Can't tell"
}

function atLeastUncertain(label: CertaintyLabel): CertaintyLabel {
  return worstOf([label, 'Uncertain'])
}

function readBox(answer: unknown): JevBox | null {
  const record = asRecord(answer)
  if (!record || record.type !== 'box') return null
  const box = asRecord(record.box)
  const confidence = record.confidence
  if (!box || typeof confidence !== 'number') return null
  const edges = [box.top, box.bottom, box.left, box.right]
  if (!edges.every((v): v is number => typeof v === 'number' && v >= 0 && v <= 1)) return null
  return {
    top: box.top as number,
    bottom: box.bottom as number,
    left: box.left as number,
    right: box.right as number,
    confidence,
  }
}

/**
 * Maps a System One response to the shared container-ID reading. Missing, refused or low-probability
 * positions stay as UNREAD; they are never filled in. The check digit is calculated here, not taken from the model.
 * The legibility score and the full-number noul can only lower certainty, never raise it.
 */
export function mapJevResponse(response: unknown, requestedModel: string): JevMapping {
  const body = asRecord(response)
  if (!body)
    throw new JevError('bad-response', 'TypeSafe replied in a shape the app does not recognise.')
  const answers = asRecord(body.answers)
  if (!answers) throw new JevError('bad-response', 'TypeSafe replied without answers. Try again.')

  const readings = Array.from({ length: ID_POSITIONS }, (_, i) => {
    const position = i + 1
    const allowed = position <= LETTER_POSITIONS ? LETTERS : DIGITS
    return readChoice(answers[questionKey(position)], allowed)
  })

  const chars = readings.map((r) => r.value ?? UNREAD)
  const positionCertainty = readings.map((r) => r.certainty)
  const printed = chars.join('')
  let certainty = worstOf(positionCertainty)

  const legibility = asRecord(answers.legibility)
  const legibilityScore = legibility?.type === 'score' ? legibility.score : null
  const hardToRead = typeof legibilityScore === 'number' && legibilityScore < LEGIBILITY_FLOOR

  const fullNumber = asRecord(answers.full_number_visible)
  const fullNumberProbability = fullNumber?.type === 'noul' ? fullNumber.noul : null
  const partlyOutOfFrame =
    typeof fullNumberProbability === 'number' && fullNumberProbability < FULL_NUMBER_MIN

  if (hardToRead || partlyOutOfFrame) certainty = atLeastUncertain(certainty)

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

  const notes: string[] = []
  const uncertainPositions = readings
    .map((r, i) => (r.certainty === 'Confident' ? null : i + 1))
    .filter((p): p is number => p !== null)
  if (uncertainPositions.length > 0 && printed.includes(UNREAD)) {
    notes.push(`Positions ${uncertainPositions.join(', ')} were not read clearly.`)
  }
  if (hardToRead) notes.push('The identification is hard to read in this photo.')
  if (partlyOutOfFrame) notes.push('The complete identification may not be in frame.')
  if (notes.length > 0) containerId.uncertainty = notes.join(' ')

  const resolvedModel =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : requestedModel
  return {
    containerId,
    resolvedModel,
    usage: readUsage(body.usage),
    reportedCostUsd: readCost(body.usage),
    box: readBox(answers.container_box),
  }
}

function numberField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function readUsage(raw: unknown): Usage | null {
  const record = asRecord(raw)
  if (!record) return null
  const inputTokens = numberField(record, ['input_tokens', 'prompt_tokens'])
  if (inputTokens === null) return null
  return {
    inputTokens,
    outputTokens: numberField(record, ['output_tokens', 'completion_tokens']),
  }
}

function readCost(raw: unknown): number | null {
  const record = asRecord(raw)
  if (!record) return null
  return numberField(record, ['cost'])
}
