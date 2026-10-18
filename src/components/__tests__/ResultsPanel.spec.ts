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

  it('shows the key-facts tiles between the notices and the detail, and no What we found summary', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).not.toContain('What we found')
    const tiles = wrapper.get('[aria-label="Key facts"]').element
    const detail = wrapper.get('.rs-detail').element
    expect(tiles.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.get('[data-tile="id"]').text()).toContain('Confident')
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
    // The model and version live in the header chip's tooltip now, not in the results.
    expect(wrapper.find('.qs-notice--live').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Live result')
    expect(wrapper.text()).not.toContain('Answered by')
  })

  it('tags an ID whose check digit passes but whose owner is not a common one', async () => {
    const store = useInspectionStore()
    const recorded = await recordedInspection('luna', { delayMs: 0 })
    // ZZZU 000000 5 passes the check digit; ZZZU is not on the owner list.
    store.record = {
      ...recorded,
      containerId: {
        ...recorded.containerId!,
        value: 'ZZZU0000005',
        observedCheckDigit: 5,
        calculatedCheckDigit: 5,
        checkDigitValid: true,
        certainty: 'Likely',
        alternatives: undefined,
      },
    }
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).toContain('Not a common owner code')
  })

  it('does not tag an ID whose owner is on the list', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.text()).not.toContain('Not a common owner code')
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
