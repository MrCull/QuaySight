import type { CertaintyLabel, ProviderId } from '../domain/inspection'

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
    retryFailureMessage: 'Rate limit reached for requests. Please try again in 20s.',
  },
  jev: {
    provider: 'jev',
    model: 'jev-1.14.0',
    containerNumber: 'APHU658684',
    observedCheckDigit: 7,
    certainty: 'Likely',
    retryFailureMessage: 'Service is busy. Please try again in 20s.',
  },
}
