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
  it('starts on light when nothing was remembered, and marks the page with it', () => {
    const root = document.createElement('html')
    const setting = createThemeSetting(() => memoryStorage(), root)
    expect(setting.theme.value).toBe('light')
    expect(root.getAttribute('data-theme')).toBe('light')
  })

  it('toggles, applies and remembers the choice for the next load', () => {
    const storage = memoryStorage()
    const root = document.createElement('html')
    const first = createThemeSetting(() => storage, root)
    first.toggle()
    expect(first.theme.value).toBe('dark')
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(storage.getItem(THEME_KEY)).toBe('dark')
    expect(createThemeSetting(() => storage, root).theme.value).toBe('dark')
  })

  it('ignores a stored value that is not a theme', () => {
    const setting = createThemeSetting(() => memoryStorage({ [THEME_KEY]: 'sepia' }), null)
    expect(setting.theme.value).toBe('light')
  })

  it('works where storage is blocked: light to start, and the choice holds until reload', () => {
    const throwing = () => {
      throw new Error('blocked')
    }
    const setting = createThemeSetting(throwing, null)
    expect(setting.theme.value).toBe('light')
    setting.toggle()
    expect(setting.theme.value).toBe('dark')
  })
})
