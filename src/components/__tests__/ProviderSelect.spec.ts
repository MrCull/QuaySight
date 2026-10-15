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
    expect(store.model).toBe('jev-1.14.0')
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
})
