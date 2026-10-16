// TypeSafe Jev adapter (spec 11.4, 11.5, 11.6). Pure functions: no fetch, no storage.
// Endpoint, auth, image and model rules follow the live TypeSafe docs checked on 16 October 2026
// (docs.typesafe.ai/api, /models, /images, /primitives/box). The re-check is in docs/research/jev-guide-recheck.md.
// Images go in a top-level `assets` map and are sent as multipart file parts; the experimental image
// opt-in header is applied by the service. Which models take the box question is declared in the catalogue.
// The questions are the Jev ID set in the shared format (idQuestions.ts); System One takes OpenRouter's
// question format, so the same translation and answer mapping serve both.
import { calculateCheckDigit } from './iso6346'
import { buildContainerIdReading } from './containerId'
import { combineOwnerReading, readOwnerPick, type OwnerPick } from './ownerPick'
import { rankIdCandidates, withCategoryLetter } from './idCandidates'
import { CERTAINTY_LABELS, UNREAD } from './certainty'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import type { Usage } from './ledger'
import { ProviderError, redact } from './providerErrors'
import { jevIdQuestionSet, readIdCharacters, type ChoiceReading } from './idQuestions'
import {
  UnreadableReplyError,
  readAnswers,
  toOpenRouterQuestions,
  type OpenRouterQuestion,
  type SharedAnswer,
} from './questionSet'

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
/** Endpoint family key used by the rate schedules and ledger. */
export const JEV_ENDPOINT_ID = 'system-one'
/** Experimental image and box opt-in (docs.typesafe.ai/images). Sent only on requests that need it. */
export const JEV_IMAGE_HEADER = 'TypeSafe-Danger-Zone-Images'
/** The reference the request uses to point at the single photo, and the multipart part name. */
export const JEV_IMAGE_REF = 'photo_1'

export type JevPhotoFormat = 'jpeg' | 'png'

/** A question in System One's (and OpenRouter's) format. */
export type JevQuestion = OpenRouterQuestion

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

/**
 * Builds the System One request body for one photo. The key is never part of the body. TypeSafe direct
 * is not in the catalogue (docs/adr/0001), so the caller says whether to ask the box question.
 */
export function buildJevRequest(
  model: string,
  format: JevPhotoFormat,
  options: { box?: boolean } = {},
): JevRequestBody {
  const set = jevIdQuestionSet({
    image: `the image referenced as \`${JEV_IMAGE_REF}\``,
    box: options.box ?? false,
  })
  return {
    model,
    state: {
      image: JEV_IMAGE_REF,
      task: 'Freight container photo. Judge only what is visible in the referenced image.',
    },
    questions: toOpenRouterQuestions(set.questions),
    assets: {
      [JEV_IMAGE_REF]: { type: 'image', part: JEV_IMAGE_REF, format },
    },
  }
}

export type JevErrorKind = 'http' | 'network' | 'bad-response' | 'photo'

/** A failed TypeSafe call, with a message fit to show the presenter. Never carries the key. */
export class JevError extends ProviderError<JevErrorKind> {
  constructor(kind: JevErrorKind, advice: string, status: number | null = null) {
    super(kind, advice, status)
    this.name = 'JevError'
  }
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
      'TypeSafe rejected the photo or request (400). Check that the photo is a PNG or JPEG, 280 to 1568 px per side, rotated upright, and up to 16 MB.',
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
    return new JevError('http', 'TypeSafe is unavailable right now. Try again shortly.', status)
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
  /** One reading per position (11): the crop read combines these with its own. */
  readings: ChoiceReading[]
  caveats: JevCaveats
  /** Where the model located the ID, when it was asked and answered: the crop read starts from it. Not drawn. */
  box: JevBox | null
}

/** Score levels are 0 to 4. A weighted score below this reads as hard to read. */
const LEGIBILITY_FLOOR = 1.5
/** A noul below this means the complete number is probably not in frame. */
const FULL_NUMBER_MIN = 0.5

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  let worst = 0
  for (const label of labels) worst = Math.max(worst, CERTAINTY_LABELS.indexOf(label))
  return CERTAINTY_LABELS[worst] ?? "Can't tell"
}

function atLeastUncertain(label: CertaintyLabel): CertaintyLabel {
  return worstOf([label, 'Uncertain'])
}

function boxOf(answer: SharedAnswer | undefined): JevBox | null {
  if (answer?.type !== 'box' || answer.confidence === null) return null
  return { ...answer.box, confidence: answer.confidence }
}

/** What the legibility score and the full-number noul say about a reading. They only ever lower certainty. */
export interface JevCaveats {
  hardToRead: boolean
  partlyOutOfFrame: boolean
}

/** The caveats in a Jev ID answer set, read by meaning. An unanswered question raises none. */
export function jevCaveatsOf(answers: Record<string, SharedAnswer>): JevCaveats {
  const legibility = answers.legibility
  const legibilityScore = legibility?.type === 'score' ? legibility.score : null
  const fullNumber = answers.full_number_visible
  const fullNumberProbability = fullNumber?.type === 'predicate' ? fullNumber.probability : null
  return {
    hardToRead: typeof legibilityScore === 'number' && legibilityScore < LEGIBILITY_FLOOR,
    partlyOutOfFrame:
      typeof fullNumberProbability === 'number' && fullNumberProbability < FULL_NUMBER_MIN,
  }
}

/**
 * The shared container-ID reading from one reading per position and the caveats. Missing positions stay
 * UNREAD; the check digit is calculated here, not taken from the model; a caveat makes the reading at
 * most Uncertain. Used for the full-photo reading and for the full-photo and crop readings combined.
 */
export function jevIdReading(
  rawReadings: ChoiceReading[],
  caveats: JevCaveats,
  ownerPick?: OwnerPick | null,
): ContainerIdReading {
  const owner = combineOwnerReading(rawReadings, ownerPick)
  const readings = withCategoryLetter(owner.readings)
  const { hardToRead, partlyOutOfFrame } = caveats
  const positionCertainty = readings.map((r) => r.certainty)
  let certainty = worstOf(positionCertainty)
  if (hardToRead || partlyOutOfFrame) certainty = atLeastUncertain(certainty)
  const ranked = rankIdCandidates(readings, certainty, owner.alternatives)
  const chars = ranked.chars
  const printed = chars.join('')

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

  if (ranked.alternatives.length > 0) containerId.alternatives = ranked.alternatives

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
  return containerId
}

/**
 * Maps a System One response to the shared container-ID reading, by meaning. Missing, refused or
 * low-probability positions stay as UNREAD; they are never filled in. The check digit is calculated
 * here, not taken from the model. The legibility score and the full-number noul can only lower
 * certainty, never raise it.
 */
export function mapJevResponse(
  response: unknown,
  requestedModel: string,
  /** Who replied, for the bad-response message: TypeSafe direct, or OpenRouter. */
  replier = 'TypeSafe',
): JevMapping {
  let reply
  try {
    // System One answers in OpenRouter's format: a map by question name.
    reply = readAnswers(
      'openrouter-decisions',
      response,
      jevIdQuestionSet({ image: 'the photo', box: true }),
      requestedModel,
    )
  } catch (error) {
    if (!(error instanceof UnreadableReplyError)) throw error
    throw new JevError(
      'bad-response',
      error.kind === 'no-answers'
        ? `${replier} replied without answers. Try again.`
        : `${replier} replied in a shape the app does not recognise.`,
    )
  }
  return {
    ...jevIdReadingOf(reply.answers),
    resolvedModel: reply.resolvedModel,
    usage: reply.usage,
    reportedCostUsd: reply.reportedCostUsd,
  }
}

/** The Jev ID set's answers, by meaning: the reading, each position's reading, its caveats and the box. */
export interface JevIdReading {
  containerId: ContainerIdReading
  readings: ChoiceReading[]
  /** The model's pick from the owner-code list, or null when it was not asked or did not answer. */
  ownerPick: OwnerPick | null
  caveats: JevCaveats
  box: JevBox | null
}

/**
 * Reads the Jev ID set's answers (by question name) as the shared container-ID reading (see
 * mapJevResponse). Other answers in the same reply (a survey's) are ignored.
 */
export function jevIdReadingOf(answers: Record<string, SharedAnswer>): JevIdReading {
  const readings = readIdCharacters(answers)
  const caveats = jevCaveatsOf(answers)
  const ownerPick = readOwnerPick(answers)
  return {
    containerId: jevIdReading(readings, caveats, ownerPick),
    readings,
    ownerPick,
    caveats,
    box: boxOf(answers.container_box),
  }
}
