// The Metric / Imperial display setting (ticket #34). Pure. It is a per-viewer convenience, remembered in
// browser storage, and never part of the inspection record or the exports (they always carry both units).

export type Units = 'metric' | 'imperial'

export const DEFAULT_UNITS: Units = 'metric'

/** The browser-storage key the setting is written under. */
export const UNITS_KEY = 'quay-sight.units'

/** The stored setting, or Metric for anything absent or not one of the two. */
export function readRememberedUnits(text: string | null | undefined): Units {
  return text === 'imperial' || text === 'metric' ? text : DEFAULT_UNITS
}
