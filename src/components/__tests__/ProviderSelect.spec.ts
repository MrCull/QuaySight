import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import ProviderSelect from '../ProviderSelect.vue'

const KEY = 'test-only-key-0000'
const photo = { name: 'a.jpg', url: 'blob:a', orientation: 'landscape' as const }

describe('ProviderSelect (the form in the setup card and the settings drawer)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('offers OpenRouter and OpenAI, and choosing OpenAI takes its recommended model and blanks the screen', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    const wrapper = mount(ProviderSelect)
    await wrapper.find('.qs-combo__button').trigger('click')
    const options = wrapper.findAll('.qs-option')
    expect(options.map((o) => o.text())).toEqual([
      expect.stringContaining('OpenRouter'),
      expect.stringContaining('OpenAI'),
    ])
    expect(options.map((o) => o.text()).join(' ')).not.toMatch(/TypeSafe|System One/)
    await options[1]!.trigger('click')
    expect(store.provider).toBe('luna')
    expect(store.model).toBe('gpt-6-luna')
    expect(store.photo).toBeNull()
  })

  it('lists Jev latest (recommended, moving target), Jev 1.14, Jev 1.13 and GPT-6 Luna Decisions for OpenRouter', () => {
    const wrapper = mount(ProviderSelect)
    expect(wrapper.findAll('select option').map((o) => [o.attributes('value'), o.text()])).toEqual([
      ['~typesafe/jev-latest', 'Jev latest (recommended, moving target)'],
      ['typesafe/jev-1.14', 'Jev 1.14 (pinned)'],
      ['typesafe/jev-1.13', 'Jev 1.13 (pinned)'],
      ['openai/gpt-6-luna-decisions', 'GPT-6 Luna Decisions'],
    ])
  })

  it('a new model blanks the screen; typing a key does not', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    const wrapper = mount(ProviderSelect)
    await wrapper.find('input[type="password"]').setValue(KEY)
    expect(store.apiKey).toBe(KEY)
    expect(store.photo).not.toBeNull()

    await wrapper.find('select').setValue('typesafe/jev-1.13')
    expect(store.model).toBe('typesafe/jev-1.13')
    expect(store.photo).toBeNull()
  })

  it('labels the key for the chosen provider and says whose endpoint receives the photo and key', () => {
    const wrapper = mount(ProviderSelect)
    const input = wrapper.find('input[type="password"]')
    expect(input.attributes('aria-label')).toBe('OpenRouter API key')
    expect(wrapper.text()).toContain(
      "The photo and this key go only to OpenRouter's Decisions endpoint",
    )
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.text()).toContain('Moving target: TypeSafe points this alias')
  })

  it('asks to submit when Enter is pressed in the key field', async () => {
    const wrapper = mount(ProviderSelect)
    await wrapper.find('input[type="password"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('offers the recorded sample replay only once a key is entered', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    expect(wrapper.text()).not.toContain('Replay the recorded sample')
    store.setApiKey(KEY)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Replay the recorded sample instead (no network call)')
  })
})
