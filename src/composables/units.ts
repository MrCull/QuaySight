import { ref, type Ref } from 'vue'
import { readRememberedUnits, UNITS_KEY, type Units } from '../domain/unitPreference'

/** Browser storage, or null where it is blocked (private windows, previews). */
function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export interface UnitsSetting {
  units: Ref<Units>
  set(units: Units): void
}

/**
 * The Metric / Imperial setting: starts on what this browser remembered (Metric when nothing, or when
 * storage is blocked) and remembers each choice. Display only: nothing else reads it.
 */
export function createUnitsSetting(getStorage: () => Storage | null): UnitsSetting {
  const remembered = (): Storage | null => {
    try {
      return getStorage()
    } catch {
      return null
    }
  }
  let initial: string | null = null
  try {
    initial = remembered()?.getItem(UNITS_KEY) ?? null
  } catch {
    // Storage that cannot be read: start on Metric.
  }
  const units = ref<Units>(readRememberedUnits(initial))
  return {
    units,
    set(next) {
      units.value = next
      try {
        remembered()?.setItem(UNITS_KEY, next)
      } catch {
        // Storage that cannot be written: the choice holds until the page reloads.
      }
    },
  }
}

const shared = createUnitsSetting(browserStorage)

/** The one setting the screen shares. */
export function useUnits(): UnitsSetting {
  return shared
}
