import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { liveWeightsRecord } from '../../__tests__/liveWeights'
import type { PlannedRequestState } from '../../domain/runStages'
import ResultsPanel from '../ResultsPanel.vue'

const planned = (overrides: Partial<PlannedRequestState>): PlannedRequestState => ({
  id: 'survey',
  stages: ['id', 'details'],
  state: 'answered',
  optional: false,
  startedAt: null,
  settledAt: null,
  ...overrides,
})

describe('What we found in the results panel', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('is the first card of a recorded result, above the container ID', async () => {
    const store = useInspectionStore()
    store.demo = true
    store.record = await recordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)

    const cards = wrapper.findAll('.qs-found, .rs-card')
    expect(cards[0]!.classes()).toContain('qs-found')
    expect(cards[0]!.get('.qs-found__k').text()).toBe('What we found')
    expect(cards[1]!.find('.qs-id').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Still arriving')
  })

  it('shows a live result too, with its container details', async () => {
    const store = useInspectionStore()
    store.record = await liveWeightsRecord()
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.get('.qs-found').text()).toContain('The size and type code is 22G1')
  })

  it('lands mid-run with what arrived, names what is still coming, and animates in by itself', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.record = await liveWeightsRecord()
    store.planned = [
      planned({ id: 'survey', stages: ['id'], state: 'answered' }),
      planned({ id: 'weights', stages: ['details'], state: 'sent' }),
      planned({ id: 'side', stages: ['damage'], state: 'sent' }),
    ]
    const wrapper = mount(ResultsPanel)
    const card = wrapper.get('.qs-found')
    expect(card.classes()).toContain('qs-arrived')
    expect(card.text()).toContain('Still arriving: container details and damage.')
    expect(card.findAll('.qs-found__topic').map((t) => t.text())).toEqual(['ID'])

    store.planned = [
      planned({ id: 'survey', stages: ['id'], state: 'answered' }),
      planned({ id: 'weights', stages: ['details'], state: 'answered' }),
      planned({ id: 'side', stages: ['damage'], state: 'answered' }),
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.qs-found').text()).not.toContain('Still arriving')
    expect(wrapper.get('.qs-found').findAll('.qs-found__topic').length).toBe(5)
  })

  it('after Cancel, summarises only what arrived and says what did not finish', async () => {
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'survey', stages: ['id'], state: 'answered' }),
      planned({ id: 'weights', stages: ['details'], state: 'cancelled' }),
      planned({ id: 'side', stages: ['damage'], state: 'cancelled' }),
    ]
    store.cancelRequested = true
    store.record = { ...(await liveWeightsRecord()), status: 'partial' }
    store.status = 'complete'
    const card = mount(ResultsPanel).get('.qs-found')
    expect(card.text()).toContain('Not finished: container details and damage.')
    expect(card.findAll('.qs-found__topic').map((t) => t.text())).toEqual(['ID'])
  })

  it('says a failed part could not be read, not that it was not seen', async () => {
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'survey', stages: ['id'], state: 'answered' }),
      planned({ id: 'weights', stages: ['details'], state: 'answered' }),
      planned({ id: 'side', stages: ['damage'], state: 'failed' }),
    ]
    store.record = { ...(await liveWeightsRecord()), damage: null, status: 'partial' }
    store.status = 'complete'
    const text = mount(ResultsPanel).get('.qs-found').text()
    expect(text).toContain('Could not be checked: damage.')
    expect(text).not.toMatch(/Damage was not assessed/)
  })

  it('shows nothing before anything has landed', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.record = null
    expect(mount(ResultsPanel).find('.qs-found').exists()).toBe(false)
  })
})
