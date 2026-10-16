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

  it('moves through the providers with the arrow keys and chooses one with Enter', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect, { attachTo: document.body })
    const button = wrapper.get('#provider-button')
    await button.trigger('keydown', { key: 'ArrowDown' })
    const listbox = wrapper.get('[role="listbox"]')
    expect(document.activeElement).toBe(listbox.element)
    // The chosen provider is active first; ArrowDown moves on to OpenAI, ArrowUp back again.
    expect(wrapper.get('.qs-option.is-active').text()).toContain('OpenRouter')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('.qs-option.is-active').text()).toContain('OpenAI')
    expect(listbox.attributes('aria-activedescendant')).toBe(
      wrapper.get('.qs-option.is-active').attributes('id'),
    )
    await listbox.trigger('keydown', { key: 'Enter' })
    expect(store.provider).toBe('luna')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
    wrapper.unmount()
  })

  it('closes the provider list with Escape, changing nothing', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect, { attachTo: document.body })
    const button = wrapper.get('#provider-button')
    await button.trigger('click')
    const listbox = wrapper.get('[role="listbox"]')
    await listbox.trigger('keydown', { key: 'ArrowDown' })
    await listbox.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(store.provider).toBe('openrouter')
    expect(document.activeElement).toBe(button.element)
    expect(button.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('marks only the recommended provider as Recommended', async () => {
    const wrapper = mount(ProviderSelect)
    expect(wrapper.get('#provider-button').text()).toContain('Recommended')
    await wrapper.get('#provider-button').trigger('click')
    const options = wrapper.findAll('.qs-option')
    expect(options[0]!.text()).toContain('Recommended')
    expect(options[1]!.text()).not.toContain('Recommended')
    await options[1]!.trigger('click')
    expect(wrapper.get('#provider-button').text()).not.toContain('Recommended')
  })

  it('gives each provider option a stable test id', async () => {
    const wrapper = mount(ProviderSelect)
    await wrapper.get('#provider-button').trigger('click')
    expect(wrapper.findAll('.qs-option').map((o) => o.attributes('data-testid'))).toEqual([
      'provider-option-openrouter',
      'provider-option-luna',
    ])
  })

  it('offers no recorded replay, with or without a key: demo mode replaces it', async () => {
    const store = useInspectionStore()
    const wrapper = mount(ProviderSelect)
    store.setApiKey(KEY)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toMatch(/replay|recorded sample/i)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })
})
