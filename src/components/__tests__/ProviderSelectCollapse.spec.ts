import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import ProviderSelect from '../ProviderSelect.vue'

const KEY = 'test-only-key-0000'

describe('ProviderSelect: key entry and collapse', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the key field before any key is entered, so nothing can start without one', () => {
    const wrapper = mount(ProviderSelect)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('.rs-setup__summary').exists()).toBe(false)
  })

  it('does not collapse while the key is still being typed, only when the presenter finishes', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await nextTick()
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.find('.rs-setup__summary').exists()).toBe(true)
  })

  it('collapses to one quiet summary row with fixed words and no status word', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    const summary = wrapper.get('.rs-setup__summary')
    expect(summary.text()).toContain('GPT-6 Luna')
    expect(summary.text()).toContain('gpt-6-luna')
    expect(summary.text()).toContain('key set')
    expect(summary.text()).toContain('Live')
    expect(summary.text()).not.toMatch(
      /Confident|Likely|Uncertain|Can't tell|Not seen|verified|safe/,
    )
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  })

  it('shows the recorded sample in the summary when replay is chosen', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    store.replaySample = true
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.get('.rs-setup__summary').text()).toContain('Recorded sample')
  })

  it('Edit expands the row again, and Done collapses it once the key is valid', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    await wrapper.get('.rs-setup__summary button').trigger('click')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Done')!
      .trigger('click')
    expect(wrapper.find('.rs-setup__summary').exists()).toBe(true)
  })

  it('returns to the key field when the key is cleared, and a new key does not collapse on its first character', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    store.clearApiKey()
    await nextTick()
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    store.setApiKey('t')
    await nextTick()
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('switching provider reopens the entry view for the new provider key', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    store.setProvider('jev')
    await nextTick()
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').attributes('aria-label')).toBe('TypeSafe API key')
  })
})
