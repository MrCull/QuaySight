import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

  it('asks for a key even for a recorded sample, and says the replay makes no network call', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('A key is needed to start, even for a recorded sample')
    store.setApiKey('test-only-key-0000')
    await nextTick()
    expect(wrapper.text()).toContain('Replay the recorded sample instead (no network call)')
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
    const input = wrapper.find('input[type="password"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-label')).toBe('TypeSafe API key')
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.text()).toContain('Moving target')
  })
})
