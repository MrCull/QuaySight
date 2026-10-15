import type { CertaintyLabel, ProviderId } from '../domain/inspection'
import type { DamageAssessment } from '../domain/damage'
import { recordedSideDamage } from './recordedDamage'

/**
 * Recorded results for the walking skeleton. They replay saved readings with no network and no key.
 *
 * Source: the printed ID visible in samples/rear-door-aphu-45g1.jpg (APHU 658684, check digit 7).
 * The check digit is not stored as "valid": the domain recalculates it from the characters.
 *
 * Luna: a fuller recorded reading of the clear rear door.
 * Jev: MINIMAL fixture. No captured Jev response exists yet (spec 11.4 requires live calibration),
 * so only the ID reading is recorded, at a lower certainty. Replace after a live smoke test.
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
  },
  jev: {
    provider: 'jev',
    model: 'jev-1.14.0',
    containerNumber: 'APHU658684',
    observedCheckDigit: 7,
    certainty: 'Likely',
    damage: null,
    sizeCode: null,
    maxGrossKg: null,
    tareKg: null,
    printedNetKg: null,
    detailCertainty: 'Likely',
  },
}
