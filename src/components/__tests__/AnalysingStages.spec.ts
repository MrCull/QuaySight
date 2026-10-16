import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { ANALYSING_STAGES } from '../../domain/analysingStages'
import AnalysingStages from '../AnalysingStages.vue'
import PhotoPanel from '../PhotoPanel.vue'

describe('AnalysingStages', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('lists the plain stages in order, from the design-system wording', () => {
    expect([...ANALYSING_STAGES]).toEqual([
      'Reading markings',
      'Looking for damage',
      'Checking the details',
    ])
    const wrapper = mount(AnalysingStages)
    const titles = wrapper.findAll('.qs-stage__title').map((t) => t.text())
    expect(titles).toEqual([...ANALYSING_STAGES])
  })

  it('marks the first stage active and the rest pending, with no measured times or percentages', () => {
    const wrapper = mount(AnalysingStages)
    const items = wrapper.findAll('li.qs-stage')
    const classesAt = (i: number) => items[i]?.classes() ?? []
    expect(classesAt(0)).toContain('qs-stage--active')
    expect(classesAt(1)).not.toContain('qs-stage--active')
    expect(classesAt(2)).not.toContain('qs-stage--done')
    expect(wrapper.text()).not.toMatch(/%/)
    expect(wrapper.findAll('.qs-stage__time').every((t) => t.text() === '')).toBe(true)
  })

  it('names the model doing the analysis: the chosen one live, the recorded one for a sample', () => {
    const store = useInspectionStore()
    const live = mount(AnalysingStages)
    expect(live.get('.rs-stagecard__k').text()).toBe('Analysing with Jev latest')
    store.enterDemo()
    store.chooseSample('rear-aphu')
    const demo = mount(AnalysingStages)
    expect(demo.get('.rs-stagecard__k').text()).toBe('Analysing with GPT-6 Luna')
  })

  it('never names passes, retries, candidates or refinement', () => {
    const wrapper = mount(AnalysingStages)
    expect(wrapper.text()).not.toMatch(/pass|retr|candidate|refine|round/i)
  })

  it('is announced politely to assistive technology', () => {
    const wrapper = mount(AnalysingStages)
    expect(wrapper.find('ol.qs-stages').attributes('aria-live')).toBe('polite')
  })
})

describe('PhotoPanel analysing overlay', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the stage card over the photo once a photo is chosen', () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'door.jpg', orientation: 'landscape', url: 'blob:x' } as never)
    const wrapper = mount(PhotoPanel)
    const overlay = wrapper.find('.rs-photo .rs-analysing')
    expect(overlay.exists()).toBe(true)
    expect(overlay.find('.rs-sweep').exists()).toBe(true)
    expect(overlay.findAll('.qs-stage__title').map((t) => t.text())).toEqual([...ANALYSING_STAGES])
  })
})
