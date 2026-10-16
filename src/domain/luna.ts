// OpenAI Decisions API adapter for GPT-6 Luna (spec 11.4, 11.5, 11.6). Pure functions: no fetch, no storage.
// Endpoint and request shape follow the live OpenAI Decisions guide (developers.openai.com/api/docs/guides/decisions):
// POST /v1/decisions, input as user messages with input_text and input_image parts (inline base64 data URLs),
// and named questions of type predicate, choice or score. Question sets are written once in the shared
// format (questionSet.ts) and translated here; answers come back by meaning. The guide documents no
// response model/version or usage fields; the mapper reads them defensively and reports what is absent.
import { calculateCheckDigit } from './iso6346'
import { buildContainerIdReading } from './containerId'
import { combineOwnerReading, readOwnerPick, type OwnerPick } from './ownerPick'
import { rankIdCandidates, withCategoryLetter } from './idCandidates'
import { CERTAINTY_LABELS, UNREAD } from './certainty'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import type { Usage } from './ledger'
import { classifyFailedCall, type ProviderErrorTraits } from './failedCall'
import { ProviderError, providerMessage, redact } from './providerErrors'
import {
  manifestAnswersOf,
  manifestQuestionSet,
  readManifestAnswers,
  type ManifestQuestion,
} from './manifest'
import {
  LUNA_IDENTIFICATION_INSTRUCTIONS,
  lunaIdQuestionSet,
  readIdCharacters,
  type ChoiceReading,
} from './idQuestions'
import {
  UnreadableReplyError,
  readAnswers,
  toWireRequest,
  type AnswersReading,
  type OpenAiDecisionsRequest,
  type SharedQuestionSet,
} from './questionSet'

export { LUNA_IDENTIFICATION_INSTRUCTIONS }
export type { ChoiceReading }

export const LUNA_MODEL = 'gpt-6-luna'
export const LUNA_ENDPOINT = 'https://api.openai.com/v1/decisions'
/** Endpoint family key used by the rate schedules and ledger. */
export const LUNA_ENDPOINT_ID = 'decisions'

export type LunaRequestBody = OpenAiDecisionsRequest

/**
 * Builds the Decisions request for one photo: the Luna ID set, translated for OpenAI. The data URL must
 * carry the photo's real MIME type. With positions (1-based), only those are asked; the re-check uses
 * this for the unread ones.
 */
export function buildLunaRequest(imageDataUrl: string, positions?: number[]): LunaRequestBody {
  return toWireRequest('openai-decisions', lunaIdQuestionSet(positions), {
    model: LUNA_MODEL,
    imageDataUrl,
  })
}

/**
 * OpenAI's Decisions API sends CORS headers on preflight and 200 responses but not on errors such as a 401
 * (checked live 16 Oct 2026). In the browser a refused call therefore arrives as a thrown fetch.
 */
export const LUNA_ERROR_TRAITS: ProviderErrorTraits = { errorsCarryCors: false }

/** `network`: the browser could not reach OpenAI. `refused`: OpenAI refused the call but the browser could not read why. */
export type LunaErrorKind = 'http' | 'network' | 'refused' | 'bad-response'

/** A failed OpenAI call, with a message fit to show the presenter. Never carries the key. */
export class LunaError extends ProviderError<LunaErrorKind> {
  constructor(kind: LunaErrorKind, advice: string, status: number | null = null) {
    super(kind, advice, status)
    this.name = 'LunaError'
  }
}

/**
 * Turns a fetch that threw (no readable response) into an actionable message. `online` is the browser's
 * navigator.onLine when the call failed. Online means OpenAI refused the call; offline means it was unreachable.
 */
export function lunaFetchFailure(online: boolean): LunaError {
  if (classifyFailedCall({ kind: 'thrown', online }, LUNA_ERROR_TRAITS) === 'refused') {
    return new LunaError(
      'refused',
      `OpenAI refused the request. Usually the key is wrong, out of credit, or has no access to ${LUNA_MODEL}. Check the key, then try again.`,
    )
  }
  return new LunaError('network', 'Could not reach OpenAI. Check your connection, then try again.')
}

/** Turns a non-2xx Decisions response into an actionable message. The key is removed from any echoed text. */
export function lunaFailure(status: number, body: unknown, apiKey: string): LunaError {
  switch (classifyFailedCall({ kind: 'status', status }, LUNA_ERROR_TRAITS)) {
    case 'bad-key':
      return new LunaError(
        'http',
        'The key was rejected by OpenAI. Check the GPT-6 Luna key, then try again. The key is not stored.',
        status,
      )
    case 'rate-limited':
      return new LunaError(
        'http',
        'OpenAI rate limit reached. Wait a minute, then try again. Nothing was retried for you.',
        status,
      )
    case 'not-found':
      return new LunaError(
        'http',
        `OpenAI could not find the Decisions endpoint or ${LUNA_MODEL} for this key. Check the model version and that the key has access.`,
        status,
      )
    case 'unavailable':
      return new LunaError('http', 'OpenAI is unavailable right now. Try again shortly.', status)
    default: {
      const detail = providerMessage(body)
      return new LunaError(
        'http',
        detail
          ? `OpenAI rejected the request (${status}): ${redact(detail, apiKey)}`
          : `OpenAI rejected the request (${status}). Check the photo and model, then try again.`,
        status,
      )
    }
  }
}

export interface LunaMapping {
  containerId: ContainerIdReading
  /** One reading per position (11 entries). Positions not asked, or not answered, are unread. */
  readings: ChoiceReading[]
  /** The model's pick from the owner-code list, when a full ID read asked it. */
  ownerPick: OwnerPick | null
  /** The model the response reports, or the requested model when it reports none. */
  resolvedModel: string
  /** Usage from the response's own fields, or null when the response carries none. */
  usage: Usage | null
}

function worstOf(labels: CertaintyLabel[]): CertaintyLabel {
  let worst = 0
  for (const label of labels) worst = Math.max(worst, CERTAINTY_LABELS.indexOf(label))
  return CERTAINTY_LABELS[worst] ?? "Can't tell"
}

/** Reads an OpenAI Decisions reply by meaning, with OpenAI's wording for a reply it cannot read. */
export function readOpenAiReply(
  response: unknown,
  set: SharedQuestionSet,
  requestedModel: string,
): AnswersReading {
  try {
    return readAnswers('openai-decisions', response, set, requestedModel)
  } catch (error) {
    if (error instanceof UnreadableReplyError) {
      throw new LunaError(
        'bad-response',
        error.kind === 'no-answers'
          ? 'OpenAI replied without answers. Try again.'
          : 'OpenAI replied in a shape the app does not recognise.',
      )
    }
    throw error
  }
}

/** A Luna ID-set reply, read by meaning, as the shared container-ID reading. The same on either route. */
export function lunaMappingOf(reply: AnswersReading, positions?: number[]): LunaMapping {
  const readings = readIdCharacters(reply.answers, positions)
  const ownerPick = positions ? null : readOwnerPick(reply.answers)
  return {
    containerId: assembleLunaReading(readings, ownerPick),
    readings,
    ownerPick,
    resolvedModel: reply.resolvedModel,
    usage: reply.usage,
  }
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
  const reply = readOpenAiReply(response, lunaIdQuestionSet(positions), requestedModel)
  return lunaMappingOf(reply, positions)
}

/** Builds the shared container-ID reading from one reading per position. Pure; used by the first pass and any re-check merge. */
export function assembleLunaReading(
  rawReadings: ChoiceReading[],
  ownerPick?: OwnerPick | null,
): ContainerIdReading {
  const owner = combineOwnerReading(rawReadings, ownerPick)
  const readings = withCategoryLetter(owner.readings)
  const positionCertainty = readings.map((r) => r.certainty)
  const certainty = worstOf(positionCertainty)
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

  const uncertainPositions = readings
    .map((r, i) => (r.certainty === 'Confident' ? null : i + 1))
    .filter((p): p is number => p !== null)
  if (uncertainPositions.length > 0 && printed.includes(UNREAD)) {
    containerId.uncertainty = `Positions ${uncertainPositions.join(', ')} were not read clearly.`
  }
  return containerId
}

/**
 * The manifest check for one photo (spec 3.2): the pasted entries as choice questions with "not
 * listed", translated for OpenAI. The key is never part of the body.
 */
export function buildLunaManifestRequest(
  imageDataUrl: string,
  questions: ManifestQuestion[],
): LunaRequestBody {
  return toWireRequest('openai-decisions', manifestQuestionSet(questions), {
    model: LUNA_MODEL,
    imageDataUrl,
  })
}

export interface ManifestMapping {
  /** The manifest entry the model chose, as a manifest reading; null for "not listed". */
  reading: ContainerIdReading | null
  /** The model the response reports, or the requested model when it reports none. */
  resolvedModel: string
  /** Usage from the response's own fields, or null when the response carries none. */
  usage: Usage | null
}

/** A manifest-check reply, read by meaning, as the manifest reading. The same on either route. */
export function manifestMappingOf(
  reply: AnswersReading,
  questions: ManifestQuestion[],
): ManifestMapping {
  return {
    reading: readManifestAnswers(manifestAnswersOf(reply.answers), questions),
    resolvedModel: reply.resolvedModel,
    usage: reply.usage,
  }
}

/** Maps an OpenAI Decisions response for the manifest check. */
export function mapLunaManifestResponse(
  response: unknown,
  requestedModel: string,
  questions: ManifestQuestion[],
): ManifestMapping {
  const reply = readOpenAiReply(response, manifestQuestionSet(questions), requestedModel)
  return manifestMappingOf(reply, questions)
}
