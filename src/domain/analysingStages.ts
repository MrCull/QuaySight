/**
 * Plain stages shown while an inspection runs (design-system StageProgress). The app has no real
 * per-stage events yet, so the first stage is shown as active and nothing advances on a timer.
 * Never name passes, retries or candidates here.
 */
export const ANALYSING_STAGES = [
  'Reading markings',
  'Looking for damage',
  'Checking the details',
] as const
