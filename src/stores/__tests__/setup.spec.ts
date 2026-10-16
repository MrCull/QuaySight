import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../inspection'
import { useSetupStore } from '../setup'
import { REMEMBERED_SELECTION_KEY } from '../../domain/rememberedSelection'

const KEY = 'test-only-key-0000'
const photo = {
  name: 'a.jpg',
  url: 'https://example.invalid/a.jpg',
  orientation: 'landscape' as const,
}

describe('setup store: gate, changes and the remembered selection', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('continues to the inspection screen only with a key', () => {
    const setup = useSetupStore()
    expect(setup.continueToInspection()).toBe(false)
    expect(setup.view).toBe('setup')
    useInspectionStore().setApiKey(KEY)
    expect(setup.continueToInspection()).toBe(true)
    expect(setup.view).toBe('inspection')
  })

  it('a provider change blanks the screen and keeps each provider its own key', () => {
    const inspection = useInspectionStore()
    const setup = useSetupStore()
    inspection.setApiKey(KEY)
    inspection.setPhoto(photo)

    setup.chooseProvider('luna')
    expect(inspection.photo).toBeNull()
    expect(inspection.status).toBe('idle')
    expect(inspection.model).toBe('gpt-6-luna')
    expect(inspection.apiKey).toBe('')

    setup.chooseProvider('openrouter')
    expect(inspection.apiKey).toBe(KEY)
  })

  it('choosing the same provider or model again keeps the screen', () => {
    const inspection = useInspectionStore()
    const setup = useSetupStore()
    inspection.setPhoto(photo)
    setup.chooseProvider('openrouter')
    setup.chooseModel('~typesafe/jev-latest')
    expect(inspection.photo).toEqual(photo)
  })

  it('remembers the provider and model, never a key, and restores them in a new session', () => {
    const inspection = useInspectionStore()
    const setup = useSetupStore()
    setup.chooseProvider('luna')
    setup.chooseProvider('openrouter')
    inspection.setApiKey(KEY)
    setup.chooseModel('typesafe/jev-1.14')
    expect(localStorage.getItem(REMEMBERED_SELECTION_KEY)).not.toContain(KEY)

    setActivePinia(createPinia())
    useSetupStore().restore()
    const fresh = useInspectionStore()
    expect(fresh.provider).toBe('openrouter')
    expect(fresh.model).toBe('typesafe/jev-1.14')
    expect(fresh.apiKey).toBe('')
    expect(useSetupStore().view).toBe('setup')
  })

  it('ignores a remembered provider the catalogue no longer lists', () => {
    localStorage.setItem(REMEMBERED_SELECTION_KEY, '{"provider":"jev","model":"jev-1.14.0"}')
    useSetupStore().restore()
    expect(useInspectionStore().provider).toBe('openrouter')
    expect(useInspectionStore().model).toBe('~typesafe/jev-latest')
  })
})
