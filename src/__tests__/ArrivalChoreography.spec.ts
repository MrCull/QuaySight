import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { runRecordedInspection } from '../domain/recordedRun'
import App from '../App.vue'

describe('result arrival choreography', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Past the setup card: the inspection screen is showing.
    useSetupStore().view = 'inspection'
  })

  it('is .qs-arriving while analysing and .qs-arrived once the record lands', async () => {
    const store = useInspectionStore()
    const wrapper = mount(App)
    store.status = 'running'
    await nextTick()
    expect(wrapper.find('#stage').classes()).toContain('qs-arriving')
    expect(wrapper.find('#stage').classes()).not.toContain('qs-arrived')

    store.record = await runRecordedInspection('luna', { delayMs: 0 })
    store.status = 'complete'
    await nextTick()
    expect(wrapper.find('#stage').classes()).toContain('qs-arrived')
    expect(wrapper.find('#stage').classes()).not.toContain('qs-arriving')
  })

  it('marks the landing items with .qs-rise so the design-system motion applies', async () => {
    const store = useInspectionStore()
    store.record = await runRecordedInspection('openrouter', { delayMs: 0 })
    store.status = 'complete'
    const wrapper = mount(App)
    expect(wrapper.findAll('.qs-rise').length).toBeGreaterThan(0)
  })
})
