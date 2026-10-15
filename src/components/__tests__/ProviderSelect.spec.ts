import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import ProviderSelect from '../ProviderSelect.vue'

describe('ProviderSelect', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('offers Luna and Jev and selecting Jev switches to its recommended model', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    await wrapper.find('.qs-combo__button').trigger('click')
    const options = wrapper.findAll('.qs-option')
    expect(options.map((o) => o.text())).toEqual([
      expect.stringContaining('GPT-6 Luna'),
      expect.stringContaining('Jev'),
    ])
    await options[1]!.trigger('click')
    expect(store.provider).toBe('jev')
    expect(store.model).toBe('jev-latest')
  })

  it('does not ask for an API key for recorded samples', () => {
    const wrapper = mount(ProviderSelect)
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  })

  it('disables provider and model choice while a run is in progress', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    const wrapper = mount(ProviderSelect)
    expect(wrapper.find('.qs-combo__button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
  })

  it('asks for a TypeSafe key, not an OpenAI key, when Jev runs live', async () => {
    const store = useInspectionStore()
    store.setProvider('jev')
    const wrapper = mount(ProviderSelect)
    await wrapper.find('button.qs-btn').trigger('click')
    const input = wrapper.find('input[type="password"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-label')).toBe('TypeSafe API key')
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.text()).toContain('Moving target')
  })
})
