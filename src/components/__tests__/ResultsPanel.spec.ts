import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { runRecordedInspection } from '../../domain/recordedRun'
import ResultsPanel from '../ResultsPanel.vue'

describe('ResultsPanel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the container ID with its certainty label and the recorded sample label for Luna', async () => {
    const store = useInspectionStore()
    store.record = await runRecordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('Recorded demonstration: GPT-6 Luna / gpt-6-luna')
    expect(wrapper.find('.qs-id').attributes('aria-label')).toContain('A P H U 6 5 8 6 8 4')
    expect(wrapper.text()).toContain('Confident')
    expect(wrapper.text()).toContain('Check digit valid')
  })

  it('labels a Jev recorded result with the Jev provider and model', async () => {
    const store = useInspectionStore()
    store.record = await runRecordedInspection('jev', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('Recorded demonstration: Jev / jev-1.14.0')
    expect(wrapper.text()).toContain('Likely')
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
    store.record = await runRecordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('40 ft High Cube')
    expect(wrapper.text()).toContain('32,500 kg')
    expect(wrapper.text()).toContain('28,630 kg')
    expect(wrapper.text()).toContain('Calculated')
  })
})
