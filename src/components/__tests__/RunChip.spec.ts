import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RunChip from '../RunChip.vue'

describe('RunChip (who answered a recorded sample)', () => {
  it('names a direct model by its maker', () => {
    const wrapper = mount(RunChip, { props: { provider: 'luna', model: 'gpt-6-luna' } })
    expect(wrapper.get('.qs-mono').text()).toBe('OA')
    expect(wrapper.get('.qs-runchip__name').text()).toBe('GPT-6 Luna')
    expect(wrapper.get('.qs-runchip__detail').text()).toBe('OpenAI · gpt-6-luna')
    expect(wrapper.attributes('title')).toBe('GPT-6 Luna · OpenAI · gpt-6-luna')
  })

  it('names a model reached through OpenRouter by maker and route', () => {
    const wrapper = mount(RunChip, {
      props: { provider: 'openrouter', model: '~typesafe/jev-latest' },
    })
    expect(wrapper.get('.qs-runchip__name').text()).toBe('Jev latest')
    expect(wrapper.get('.qs-runchip__detail').text()).toBe(
      'TypeSafe via OpenRouter · ~typesafe/jev-latest',
    )
  })
})
