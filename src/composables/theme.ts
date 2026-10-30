import { ref, type Ref } from 'vue'
import { readRememberedTheme, THEME_KEY, type Theme } from '../domain/themePreference'

/** Browser storage, or null where it is blocked (private windows, previews). */
function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export interface ThemeSetting {
  theme: Ref<Theme>
  set(theme: Theme): void
  toggle(): void
}

/**
 * The dark / light theme: starts on what this browser remembered (Daylight when nothing, or when storage is
 * blocked), applies it as data-theme on the root element and remembers each choice.
 */
export function createThemeSetting(
  getStorage: () => Storage | null,
  root: HTMLElement | null = globalThis.document?.documentElement ?? null,
): ThemeSetting {
  const remembered = (): Storage | null => {
    try {
      return getStorage()
    } catch {
      return null
    }
  }
  let initial: string | null = null
  try {
    initial = remembered()?.getItem(THEME_KEY) ?? null
  } catch {
    // Storage that cannot be read: start on Daylight.
  }
  const theme = ref<Theme>(readRememberedTheme(initial))
  const apply = () => root?.setAttribute('data-theme', theme.value)
  apply()
  const set = (next: Theme) => {
    theme.value = next
    apply()
    try {
      remembered()?.setItem(THEME_KEY, next)
    } catch {
      // Storage that cannot be written: the choice holds until the page reloads.
    }
  }
  return { theme, set, toggle: () => set(theme.value === 'dark' ? 'light' : 'dark') }
}

let shared: ThemeSetting | undefined

/** The one theme the page shares. */
export function useTheme(): ThemeSetting {
  shared ??= createThemeSetting(browserStorage)
  return shared
}
