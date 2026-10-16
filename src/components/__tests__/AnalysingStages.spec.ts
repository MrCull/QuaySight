import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import type { PlannedRequestState } from '../../domain/runStages'
import AnalysingStages from '../AnalysingStages.vue'
import PhotoPanel from '../PhotoPanel.vue'

const STAGE_TITLES = ['Reading the ID', 'Reading container details', 'Checking for damage']

const planned = (overrides: Partial<PlannedRequestState>): PlannedRequestState => ({
  id: 'read',
  stages: ['id'],
  state: 'sent',
  optional: false,
  startedAt: null,
  settledAt: null,
  ...overrides,
})

describe('AnalysingStages', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('lists the run stages in order, in plain words', () => {
    const wrapper = mount(AnalysingStages)
    expect(wrapper.findAll('.qs-stage__title').map((t) => t.text())).toEqual(STAGE_TITLES)
  })

  it('shows each stage as its own requests stand: done with its measured time, active, or not part of this run', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.planned = [
      planned({ id: 'read', stages: ['id'], state: 'answered', startedAt: 1000, settledAt: 2400 }),
      planned({ id: 'side', stages: ['damage'], state: 'sent', startedAt: 1000 }),
    ]
    const wrapper = mount(AnalysingStages)
    const [id, details, damage] = wrapper.findAll('li.qs-stage')

    expect(id!.classes()).toContain('qs-stage--done')
    expect(id!.find('.qs-glyph--check').exists()).toBe(true)
    expect(id!.get('.qs-stage__time').text()).toBe('1.4 s')
    expect(details!.classes()).toContain('qs-stage--skipped')
    expect(details!.get('.qs-stage__detail').text()).toBe('Not part of this run')
    expect(damage!.classes()).toContain('qs-stage--active')
    expect(damage!.get('.qs-stage__time').text()).toBe('')
    expect(wrapper.text()).not.toMatch(/%/)
  })

  it('shows a failed stage with the error glyph and says what is kept', () => {
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'read', stages: ['id'], state: 'answered' }),
      planned({ id: 'survey', stages: ['details'], state: 'failed' }),
    ]
    const details = mount(AnalysingStages).findAll('li.qs-stage')[1]!
    expect(details.classes()).toContain('qs-stage--failed')
    expect(details.find('.qs-glyph--error').exists()).toBe(true)
    expect(details.get('.qs-stage__detail').text()).toBe(
      'Could not be completed. Everything else is kept.',
    )
  })

  it('shows a cancelled stage as cancelled', () => {
    const store = useInspectionStore()
    store.planned = [planned({ state: 'cancelled' })]
    const id = mount(AnalysingStages).findAll('li.qs-stage')[0]!
    expect(id.classes()).toContain('qs-stage--cancelled')
    expect(id.get('.qs-stage__detail').text()).toBe('Cancelled')
  })

  it('shows every stage at work while a recorded sample replays', () => {
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('rear-aphu')
    store.status = 'running'
    const items = mount(AnalysingStages).findAll('li.qs-stage')
    expect(items.every((li) => li.classes().includes('qs-stage--active'))).toBe(true)
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
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'sent', optional: true }),
    ]
    const wrapper = mount(AnalysingStages)
    expect(wrapper.text()).not.toMatch(/pass|retr|candidate|refine|round|re-check/i)
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
    expect(overlay.findAll('.qs-stage__title').map((t) => t.text())).toEqual(STAGE_TITLES)
  })
})
