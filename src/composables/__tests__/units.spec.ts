import { describe, it, expect } from 'vitest'
import { createUnitsSetting } from '../units'
import { UNITS_KEY } from '../../domain/unitPreference'

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

describe('the units setting', () => {
  it('starts on Metric when nothing was remembered', () => {
    const setting = createUnitsSetting(() => memoryStorage())
    expect(setting.units.value).toBe('metric')
  })

  it('remembers a choice in browser storage, and the next load starts on it', () => {
    const storage = memoryStorage()
    const first = createUnitsSetting(() => storage)
    first.set('imperial')
    expect(first.units.value).toBe('imperial')
    expect(storage.getItem(UNITS_KEY)).toBe('imperial')

    const reloaded = createUnitsSetting(() => storage)
    expect(reloaded.units.value).toBe('imperial')
    reloaded.set('metric')
    expect(createUnitsSetting(() => storage).units.value).toBe('metric')
  })

  it('works where storage is blocked: Metric to start, and the choice holds until reload', () => {
    const throwing = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    const setting = createUnitsSetting(throwing)
    expect(setting.units.value).toBe('metric')
    setting.set('imperial')
    expect(setting.units.value).toBe('imperial')

    const noStorage = createUnitsSetting(() => null)
    noStorage.set('imperial')
    expect(noStorage.units.value).toBe('imperial')
  })

  it('works where storage refuses a write', () => {
    const storage = memoryStorage()
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    const setting = createUnitsSetting(() => storage)
    expect(() => setting.set('imperial')).not.toThrow()
    expect(setting.units.value).toBe('imperial')
  })
})
