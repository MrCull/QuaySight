import type { CertaintyLabel, ProviderId } from '../domain/inspection'
import type { DamageAssessment } from '../domain/damage'
import { recordedSideDamage } from './handWrittenDamage'

/**
 * HAND-WRITTEN test data, not a recording. Nothing here was answered by a model, and nothing here is ever
 * shown as a recorded demonstration: demo mode replays only real recordings (src/fixtures/demoRecordings.ts).
 * Tests use these to build records without a network (see recordedInspection.ts).
 *
 * Source: the printed ID visible in samples/rear-door-aphu-45g1.jpg (APHU 658684, check digit 7), read by
 * eye. The check digit is not stored as "valid": the domain recalculates it from the characters.
 *
 * `luna` stands in for a full Luna reading of the clear rear door; `openrouter` for a minimal Jev one.
 */
export interface RecordedFixture {
  provider: ProviderId
  model: string
  containerNumber: string
  observedCheckDigit: number | null
  certainty: CertaintyLabel
  /** Side-damage assessment replayed with the ID reading. Null when none was recorded. */
  damage: DamageAssessment | null
  /** ISO size/type code printed on the door (e.g. 45G1), or null when not captured. */
  sizeCode: string | null
  /** Printed MAX GROSS, TARE and NET in kg (the lb values are not used). Null when not captured. */
  maxGrossKg: number | null
  tareKg: number | null
  printedNetKg: number | null
  /** Certainty of the printed size code and weights. */
  detailCertainty: CertaintyLabel
  /** Provider message shown when the recorded manifest check fails (spec 3.2). */
  retryFailureMessage: string
}

export const recordedFixtures: Record<ProviderId, RecordedFixture> = {
  luna: {
    provider: 'luna',
    model: 'gpt-6-luna',
    containerNumber: 'APHU658684',
    observedCheckDigit: 7,
    certainty: 'Confident',
    damage: recordedSideDamage,
    // Door plate in the photo: 45G1; MAX GROSS 32,500 KGS, TARE 3,870 KGS, NET 28,630 KGS.
    sizeCode: '45G1',
    maxGrossKg: 32500,
    tareKg: 3870,
    printedNetKg: 28630,
    detailCertainty: 'Confident',
    retryFailureMessage: 'Rate limit reached for requests. Please try again in 20s.',
  },
  // Jev through OpenRouter (docs/adr/0001): a minimal hand-written reading, not a capture.
  openrouter: {
    provider: 'openrouter',
    model: 'typesafe/jev-1.14',
    containerNumber: 'APHU658684',
    observedCheckDigit: 7,
    certainty: 'Likely',
    damage: null,
    sizeCode: null,
    maxGrossKg: null,
    tareKg: null,
    printedNetKg: null,
    detailCertainty: 'Likely',
    retryFailureMessage: 'Service is busy. Please try again in 20s.',
  },
}
