// The Night quay (dark) / Daylight (light) display theme. Pure. A per-viewer convenience, remembered in browser
// storage; never part of the inspection record or the exports.

export type Theme = 'dark' | 'light'

/** Daylight is the default. */
export const DEFAULT_THEME: Theme = 'light'

/** The browser-storage key the theme is written under. index.html reads it too, before the first paint. */
export const THEME_KEY = 'quay-sight.theme'

/** The stored theme, or Daylight for anything absent or not one of the two. */
export function readRememberedTheme(text: string | null | undefined): Theme {
  return text === 'light' || text === 'dark' ? text : DEFAULT_THEME
}
