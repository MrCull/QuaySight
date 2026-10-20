import type { DecodedSizeCode } from './isoSizeCode'
import type { RequestFailureNote } from './requestFailure'
import type { WeightChecks } from './weights'

// Shared inspection record (spec 11.2). Provider-independent: every adapter, recorded or live,
// normalises into this shape. Later tickets extend it (checks, findings, costs) without changing
// the fields below, so schemaVersion bumps only on breaking changes.
//
// Fields are declared on InspectionRecord itself, as optional fields. Do not add fields to it from
// another module with `declare module`. Some earlier request fields (details, idCropRead) still do.

import type { DamageAssessment } from './damage'
import type { LengthReading } from './chosenLength'
import type { DamageSetReading } from './damageSets'
import type { FaceReading } from './photoFace'
import type { PhotoSummary } from './combinePhotos'

export const INSPECTION_SCHEMA_VERSION = 1

/** Who receives the key and the call: OpenAI direct ('luna') or OpenRouter. */
export type ProviderId = 'luna' | 'openrouter'

/** The five fixed certainty words (AGENTS.md, spec 8.4). Nothing else may be shown. */
export type CertaintyLabel = 'Confident' | 'Likely' | 'Uncertain' | "Can't tell" | 'Not seen'

/** Where a value came from. Visible observation, derived, calculated, candidate and unresolved stay distinct. */
export type Provenance =
  | 'printed'
  | 'decoded'
  | 'calculated'
  | 'candidate'
  | 'manifest'
  | 'unresolved'

export interface ContainerIdReading {
  /** Full 11-character ID as read from the photo (owner code, category, serial, check digit). */
  value: string
  /** Check digit as observed in the photo, or null when not seen. */
  observedCheckDigit: number | null
  /** Check digit calculated independently from the first ten characters (ISO 6346). Null when those ten are not all read: unavailable, never zero. */
  calculatedCheckDigit: number | null
  checkDigitValid: boolean
  certainty: CertaintyLabel
  provenance: Provenance
  /** True after the optional manifest check (spec 3.2), whatever the outcome; the reading itself came from the photo unless provenance is manifest. */
  manifestChecked?: boolean
  /** Optional per-position certainty (11 entries). Defaults to the overall certainty for every position. */
  positionCertainty?: CertaintyLabel[]
  /** Plausible alternative IDs. Only the first two are ever shown, as "Also possible". */
  alternatives?: string[]
  /** Plain-words note on what remains uncertain, shown beside the best interpretation. */
  uncertainty?: string
}

export interface PhotoRef {
  name: string
  /** Natural orientation derived from the image's pixel dimensions. */
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown'
}

/**
 * One provider response as received for a single pass of the inspection. 'recorded-fixture' means the
 * body is the saved sample the app replayed, not an HTTP capture. 'provider' is for live adapters.
 * A body must never contain request headers or keys: adapters pass only the response payload.
 */
export interface RawProviderResponse {
  passId: string
  provider: ProviderId
  model: string
  capturedFrom: 'recorded-fixture' | 'provider'
  body: unknown
}

/**
 * One automatic re-check (spec 5.1, 8.5). Its observations and outcome are kept for export only. The UI
 * shows the resulting reading and its certainty, never the re-check itself.
 */
export interface RecheckRecord {
  id: string
  /** The unresolved field re-checked. One re-check per field per photo. */
  field: 'containerId'
  /** 1-based positions re-asked: the positions the first pass left unread. */
  positions: number[]
  provider: ProviderId
  model: string
  /** Version the provider reports for the model that answered, or null when no reply was received. */
  resolvedVersion: string | null
  /** resolved: all asked positions read. partly-resolved / unchanged: some or none read. failed: no reply. skipped-cap: the cap stopped it. cancelled: the run was cancelled while it was in flight. */
  outcome: 'resolved' | 'partly-resolved' | 'unchanged' | 'failed' | 'skipped-cap' | 'cancelled'
  resolvedPositions: number[]
  /** What the re-check read at each asked position. Empty when it did not run. */
  observations: { position: number; value: string | null; certainty: CertaintyLabel }[]
  /** Set when the cap stopped the re-check. */
  reason: 'requests' | 'spend' | null
}

export interface InspectionRecord {
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION
  id: string
  provider: ProviderId
  model: string
  /** Version the provider reports for the model that answered (recorded: the fixture's model). */
  resolvedVersion: string
  /** Raw provider responses, one per pass. Exported separately; never shown in the UI. */
  rawResponses: RawProviderResponse[]
  /** 'recorded' runs replay saved results: no network, no key, no live charge. */
  source: 'recorded' | 'live'
  /** partial: a part of the run failed after some of it had answered. What answered is kept. */
  status: 'running' | 'complete' | 'partial' | 'failed'
  photo: PhotoRef | null
  containerId: ContainerIdReading | null
  /** Damage assessment for the neutral schematic (ticket #8). Null when the run assessed no damage. */
  damage: DamageAssessment | null
  /** Decoded ISO size/type code (provenance: decoded), or null when not visible or not recognised. */
  sizeCode: DecodedSizeCode | null
  /** Automatic re-checks for unresolved fields (live only). Absent or empty when none ran. */
  rechecks?: RecheckRecord[]
  /** Requests that failed in this run, with their cause (ticket #53). Absent or empty when none did. */
  failures?: RequestFailureNote[]
  /** The model's answer to the length question; null when it gave no usable one, absent when not asked. */
  modelLength?: LengthReading | null
  /** The face the survey says the photo shows. Absent until the survey answers; null when it gave none. */
  photoFace?: FaceReading | null
  /** Every damage set's reading of the photo, one per face, before the face chooses among them. */
  damageReadings?: DamageSetReading[]
  /** Several photos (ticket #70): each photo, its face and which readings came from it. Absent for a single photo. */
  photos?: PhotoSummary[]
  /** Several photos: two of them read different complete IDs that both pass the check digit. Nothing is combined then. */
  differentContainers?: boolean
  /** Printed maximum gross and tare, calculated payload, and any printed-versus-arithmetic conflict. */
  weights: WeightChecks | null
}
