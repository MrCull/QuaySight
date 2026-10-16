import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import type { PlannedRequestState } from '../../domain/runStages'
import ResultsPanel from '../ResultsPanel.vue'

const planned = (overrides: Partial<PlannedRequestState>): PlannedRequestState => ({
  id: 'read',
  stages: ['id'],
  state: 'answered',
  optional: false,
  startedAt: null,
  settledAt: null,
  ...overrides,
})

async function liveRecord(status: 'complete' | 'partial') {
  const base = await recordedInspection('luna', { delayMs: 0 })
  return { ...base, source: 'live' as const, status }
}

describe('ResultsPanel partial and landing states', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('after Cancel, says the result is partial and names what did not finish', async () => {
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'read', stages: ['id'], state: 'answered' }),
      planned({ id: 'survey', stages: ['details'], state: 'cancelled' }),
      planned({ id: 'side', stages: ['damage'], state: 'cancelled' }),
    ]
    store.cancelRequested = true
    store.record = await liveRecord('partial')
    store.status = 'complete'
    const notice = mount(ResultsPanel).get('.qs-notice--partial')

    expect(notice.attributes('role')).toBe('status')
    expect(notice.get('.qs-notice__title').text()).toBe(
      'Partial result: cancelled before every part finished.',
    )
    expect(notice.get('.qs-notice__body').text()).toBe(
      'What had arrived is shown. Not finished: container details, damage.',
    )
    expect(notice.get('.qs-notice__kicker').text()).toBe('Partial')
  })

  it('after Cancel with nothing arrived, says so and shows no result', () => {
    const store = useInspectionStore()
    store.status = 'cancelled'
    const wrapper = mount(ResultsPanel)
    expect(wrapper.get('.qs-notice--partial .qs-notice__title').text()).toBe(
      'Inspection cancelled before any result arrived.',
    )
    expect(wrapper.find('.qs-notice--error').exists()).toBe(false)
    expect(wrapper.find('.rs-card').exists()).toBe(false)
  })

  it('names a part that failed in an error notice, and keeps every part that answered', async () => {
    const store = useInspectionStore()
    store.planned = [
      planned({ id: 'read', stages: ['id'], state: 'answered' }),
      planned({ id: 'side', stages: ['damage'], state: 'failed' }),
    ]
    store.record = await liveRecord('partial')
    store.status = 'complete'
    const wrapper = mount(ResultsPanel)

    const alert = wrapper.get('.qs-notice--error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.get('.qs-notice__title').text()).toBe('Damage could not be checked.')
    expect(alert.get('.qs-notice__body').text()).toBe('Everything else found is shown.')
    expect(wrapper.find('.qs-notice--partial').exists()).toBe(false)
    expect(wrapper.find('.qs-id').exists()).toBe(true)
  })

  it('during a run, holds the ID back until its stage lands, then lands it on its own', async () => {
    const store = useInspectionStore()
    store.status = 'running'
    store.record = await liveRecord('complete')
    store.planned = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'sent', optional: true }),
    ]
    const wrapper = mount(ResultsPanel)
    expect(wrapper.find('.qs-id').exists()).toBe(false)
    expect(wrapper.find('.rs-id-skeleton').exists()).toBe(true)

    store.planned = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'answered', optional: true }),
      planned({ id: 'side', stages: ['damage'], state: 'sent' }),
    ]
    await wrapper.vm.$nextTick()
    const card = wrapper.get('.qs-id').element.closest('.rs-card')!
    expect(card.classList.contains('qs-arrived')).toBe(true)
    expect(wrapper.find('.rs-id-skeleton').exists()).toBe(false)
    // Exports and the manifest offer wait for the whole run.
    expect(wrapper.find('.rs-exports').exists()).toBe(false)
  })
})
