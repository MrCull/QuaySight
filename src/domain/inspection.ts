import type { DecodedSizeCode } from './isoSizeCode'
import type { WeightChecks } from './weights'

// Shared inspection record (spec 11.2). Provider-independent: every adapter, recorded or live,
// normalises into this shape. Later tickets extend it (checks, findings, costs) without changing
// the fields below, so schemaVersion bumps only on breaking changes.

export const INSPECTION_SCHEMA_VERSION = 1

export type ProviderId = 'luna' | 'jev'

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
  /** Check digit calculated independently from the first ten characters (ISO 6346). */
  calculatedCheckDigit: number
  checkDigitValid: boolean
  certainty: CertaintyLabel
  provenance: Provenance
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

export interface InspectionRecord {
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION
  id: string
  provider: ProviderId
  model: string
  /** 'recorded' runs replay saved results: no network, no key, no live charge. */
  source: 'recorded' | 'live'
  status: 'running' | 'complete' | 'failed'
  photo: PhotoRef | null
  containerId: ContainerIdReading | null
  /** Decoded ISO size/type code (provenance: decoded), or null when not visible or not recognised. */
  sizeCode: DecodedSizeCode | null
  /** Printed maximum gross and tare, calculated payload, and any printed-versus-arithmetic conflict. */
  weights: WeightChecks | null
}
