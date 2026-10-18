import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import SettingsChip from '../SettingsChip.vue'

const KEY = 'test-only-key-0000'

describe('SettingsChip (the setup folded into the top bar)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('names the provider and the model by its display name, never its wire id', () => {
    const store = useInspectionStore()
    store.setApiKey(KEY)
    const wrapper = mount(SettingsChip)
    expect(wrapper.get('.qs-settingschip__text').text()).toBe('OpenRouter · Jev latest · Live')
    expect(wrapper.text()).not.toContain('key set')
    expect(wrapper.text()).not.toContain('~typesafe/jev-latest')
    expect(wrapper.attributes('aria-label')).toBe('Settings: OpenRouter · Jev latest · Live')
  })

  it('puts the exact model version and the key status in the tooltip', () => {
    const store = useInspectionStore()
    store.setApiKey(KEY)
    const wrapper = mount(SettingsChip)
    expect(wrapper.attributes('title')).toBe('Jev latest (TypeSafe) via OpenRouter · key set')
    expect(wrapper.attributes('title')).not.toContain(KEY)
  })

  it('names OpenAI as the provider for GPT-6 Luna direct, and says when there is no key', () => {
    const store = useInspectionStore()
    store.setProvider('luna')
    const wrapper = mount(SettingsChip)
    expect(wrapper.attributes('aria-label')).toBe('Settings: OpenAI · GPT-6 Luna · no key · Live')
    expect(wrapper.attributes('title')).toContain('no key')
    expect(wrapper.classes()).toContain('qs-settingschip--nokey')
    expect(wrapper.text()).not.toContain(KEY)
  })
})
