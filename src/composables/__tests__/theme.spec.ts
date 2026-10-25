import { describe, it, expect } from 'vitest'
import { createThemeSetting } from '../theme'
import { THEME_KEY } from '../../domain/themePreference'

/** A storage the test can look into. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

describe('the theme setting', () => {
  it('starts on dark when nothing was remembered, and marks the page with it', () => {
    const root = document.createElement('html')
    const setting = createThemeSetting(() => memoryStorage(), root)
    expect(setting.theme.value).toBe('dark')
    expect(root.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles, applies and remembers the choice for the next load', () => {
    const storage = memoryStorage()
    const root = document.createElement('html')
    const first = createThemeSetting(() => storage, root)
    first.toggle()
    expect(first.theme.value).toBe('light')
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(storage.getItem(THEME_KEY)).toBe('light')
    expect(createThemeSetting(() => storage, root).theme.value).toBe('light')
  })

  it('ignores a stored value that is not a theme', () => {
    const setting = createThemeSetting(() => memoryStorage({ [THEME_KEY]: 'sepia' }), null)
    expect(setting.theme.value).toBe('dark')
  })

  it('works where storage is blocked: dark to start, and the choice holds until reload', () => {
    const throwing = () => {
      throw new Error('blocked')
    }
    const setting = createThemeSetting(throwing, null)
    expect(setting.theme.value).toBe('dark')
    setting.toggle()
    expect(setting.theme.value).toBe('light')
  })
})
