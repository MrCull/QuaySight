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

    setup.chooseProvider('jev')
    expect(inspection.photo).toBeNull()
    expect(inspection.status).toBe('idle')
    expect(inspection.model).toBe('jev-latest')
    expect(inspection.apiKey).toBe('')

    setup.chooseProvider('luna')
    expect(inspection.apiKey).toBe(KEY)
  })

  it('choosing the same provider or model again keeps the screen', () => {
    const inspection = useInspectionStore()
    const setup = useSetupStore()
    inspection.setPhoto(photo)
    setup.chooseProvider('luna')
    setup.chooseModel('gpt-6-luna')
    expect(inspection.photo).toEqual(photo)
  })

  it('remembers the provider and model, never a key, and restores them in a new session', () => {
    const inspection = useInspectionStore()
    const setup = useSetupStore()
    setup.chooseProvider('jev')
    inspection.setApiKey(KEY)
    setup.chooseModel('jev-1.14.0')
    expect(localStorage.getItem(REMEMBERED_SELECTION_KEY)).not.toContain(KEY)

    setActivePinia(createPinia())
    useSetupStore().restore()
    const fresh = useInspectionStore()
    expect(fresh.provider).toBe('jev')
    expect(fresh.model).toBe('jev-1.14.0')
    expect(fresh.apiKey).toBe('')
    expect(useSetupStore().view).toBe('setup')
  })

  it('ignores a remembered provider the catalogue no longer lists', () => {
    localStorage.setItem(REMEMBERED_SELECTION_KEY, '{"provider":"typesafe-direct","model":"x"}')
    useSetupStore().restore()
    expect(useInspectionStore().provider).toBe('luna')
  })
})
