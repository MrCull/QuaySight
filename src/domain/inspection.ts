// Shared inspection record (spec 11.2). Provider-independent: every adapter, recorded or live,
// normalises into this shape. Later tickets extend it (checks, findings, costs) without changing
// the fields below, so schemaVersion bumps only on breaking changes.

import type { DamageAssessment } from './damage'

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
  /** Damage assessment for the neutral schematic (ticket #8). Null when the run assessed no damage. */
  damage: DamageAssessment | null
}
