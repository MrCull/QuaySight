import type { CropRegion } from '../domain/cropRead'
import type { InspectionRecord, ProviderId } from '../domain/inspection'
import type { LedgerEntry } from '../domain/ledger'

// A recording is what one live run of the whole request plan was answered with: the raw response of every
// request that answered, in the order they landed, with what the run measured of each (latency, cost).
// Demo mode replays recordings through the same answer mappers a live run uses (./replay.ts), so a demo
// result is a real model's answer for the sample's own photo and nothing else.
//
// A recording is data: JSON files under src/fixtures/live/plan/, written by the opt-in recording spec
// (src/services/__tests__/planRecording.live.spec.ts) and never edited by hand. No key, no header and no
// request body is ever part of one: parsePlanRecording refuses anything key-shaped.

export const PLAN_RECORDING_FORMAT = 1

/** One request's answer, as the provider sent it. */
export interface RecordedRequest {
  /** The plan request's id (`read`, `side-damage`, `door-damage`, `crop`, `weights`, `recheck`). */
  request: string
  /** The raw response payload, as received. */
  response: unknown
  /** How long the request took, from the run's ledger. */
  latencyMs: number | null
  /** What the request cost: the provider's reported cost, or the rate-table estimate; null when unknown. */
  costUsd: number | null
  /** For the crop read: the region cut from the prepared photo, which the record keeps. */
  crop?: CropRegion
  /**
   * Set on recordings made before the survey existed: the request asked only the container ID, so its
   * answer fills the ID and nothing else (the details, weights and face were never asked, not "unread").
   */
  asked?: 'id-only'
}

export interface PlanRecording {
  format: typeof PLAN_RECORDING_FORMAT
  /** When the run was recorded (ISO). */
  recordedAt: string
  /** The photo the run was made on, relative to the repository root. */
  photo: string
  /** The route and model as requested (`luna` / `gpt-6-luna`, `openrouter` / `~typesafe/jev-latest`). */
  provider: ProviderId
  model: string
  entries: RecordedRequest[]
}

/** The request id of a raw response: its pass id is `<inspection id>-<request id>`. */
function requestOf(passId: string, inspectionId: string): string {
  const prefix = `${inspectionId}-`
  return passId.startsWith(prefix) ? passId.slice(prefix.length) : passId
}

/**
 * The recording of a run that completed: each answered request's raw response in the order they landed,
 * with its latency and cost from the ledger. A run that failed, was cancelled or came back partial is
 * not a recording.
 */
export function recordRun(
  record: InspectionRecord,
  ledger: readonly LedgerEntry[],
  meta: { photo: string; recordedAt: string },
): PlanRecording {
  if (record.status !== 'complete') {
    throw new Error(`Only a complete run can be recorded; this one is ${record.status}.`)
  }
  const entries = record.rawResponses.map((raw): RecordedRequest => {
    const request = requestOf(raw.passId, record.id)
    const line = ledger.find((l) => l.id === raw.passId)
    const crop = request === 'crop' ? record.idCropRead?.crop : null
    return {
      request,
      response: raw.body,
      latencyMs: line?.latencyMs ?? null,
      costUsd: line?.costUsd ?? null,
      ...(crop
        ? {
            crop: {
              x: crop.x,
              y: crop.y,
              width: crop.width,
              height: crop.height,
              outWidth: crop.sentWidth,
              outHeight: crop.sentHeight,
            },
          }
        : {}),
    }
  })
  return {
    format: PLAN_RECORDING_FORMAT,
    recordedAt: meta.recordedAt,
    photo: meta.photo,
    provider: record.provider,
    model: record.model,
    entries,
  }
}

// Mirrors the secret scan (scripts/check-secrets.mjs): the same shapes, so a recording that passes here
// passes the repository gate.
const KEY_SHAPES = [
  /(?<![A-Za-z0-9])sk-(?:proj|or)-/,
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/,
  /Bearer\s+\S{8,}/i,
]

function holdsKey(value: unknown): boolean {
  return KEY_SHAPES.some((shape) => shape.test(JSON.stringify(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A recording read from JSON. Throws, naming what is wrong, for anything that is not one or that holds a key. */
export function parsePlanRecording(json: unknown): PlanRecording {
  if (!isRecord(json) || json.format !== PLAN_RECORDING_FORMAT) {
    throw new Error('Not a plan recording: its format is missing or unknown.')
  }
  const { recordedAt, photo, provider, model, entries } = json
  if (typeof recordedAt !== 'string' || typeof photo !== 'string' || typeof model !== 'string') {
    throw new Error('A plan recording names when it was recorded, its photo and its model.')
  }
  if (provider !== 'luna' && provider !== 'openrouter') {
    throw new Error('A plan recording names its provider.')
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('A plan recording holds at least one response.')
  }
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.request !== 'string' || !('response' in entry)) {
      throw new Error('Every entry of a plan recording names its request and holds its response.')
    }
  }
  if (holdsKey(json))
    throw new Error('A plan recording must never hold a key or an authorization header.')
  return json as unknown as PlanRecording
}
