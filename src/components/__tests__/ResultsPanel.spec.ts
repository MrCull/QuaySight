import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import ResultsPanel from '../ResultsPanel.vue'

describe('ResultsPanel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the container ID with its certainty label and the recorded sample label for Luna', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('Recorded demonstration: GPT-6 Luna / gpt-6-luna')
    expect(wrapper.find('.qs-id').attributes('aria-label')).toContain('A P H U 6 5 8 6 8 4')
    expect(wrapper.text()).toContain('Confident')
    expect(wrapper.text()).toContain('Check digit valid')
  })

  it('labels a Jev recorded result with the model, maker and route', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('openrouter', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain(
      'Recorded demonstration: Jev 1.14 (TypeSafe) via OpenRouter / typesafe/jev-1.14',
    )
    expect(wrapper.text()).toContain('Likely')
  })

  it('attributes a live OpenRouter result to model, maker and route, with the version that answered', async () => {
    const store = useInspectionStore()
    const recorded = await recordedInspection('openrouter', { delayMs: 0 })
    store.record = {
      ...recorded,
      source: 'live',
      model: '~typesafe/jev-latest',
      resolvedVersion: 'typesafe/jev-1.14-20261014',
    }
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    // One plain title, and the exact version in the body so the title stays short on a projector.
    const notice = wrapper.get('.qs-notice--live')
    expect(notice.get('.qs-notice__title').text()).toBe(
      'Live result: Jev latest (TypeSafe) via OpenRouter',
    )
    expect(notice.get('.qs-notice__body').text()).toContain(
      'Answered by typesafe/jev-1.14-20261014 (requested ~typesafe/jev-latest, a moving target).',
    )
  })

  it('shows no result or sample label before a run completes', () => {
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).not.toContain('Recorded demonstration')
    expect(wrapper.find('.qs-id').exists()).toBe(false)
  })

  it('shows a plain error when the run fails', () => {
    const store = useInspectionStore()
    store.status = 'failed'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('could not be loaded')
  })
})

describe('ResultsPanel deterministic checks', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows decoded size, printed maximum gross and tare, and calculated payload for Luna', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('40 ft High Cube')
    expect(wrapper.text()).toContain('32,500 kg')
    expect(wrapper.text()).toContain('28,630 kg')
    expect(wrapper.text()).toContain('Calculated')
  })

  it('says the size code in plain words under the ID, from the code alone', async () => {
    const store = useInspectionStore()
    const base = await recordedInspection('luna', { delayMs: 0 })
    store.record = base
    store.status = 'complete'
    expect(mount(ResultsPanel).text()).toContain('40 ft High Cube, general purpose')
    store.record = { ...base, sizeCode: null }
    expect(mount(ResultsPanel).text()).not.toContain('general purpose')
  })
})
