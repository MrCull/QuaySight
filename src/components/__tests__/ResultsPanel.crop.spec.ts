import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import type { ContainerIdReading } from '../../domain/inspection'
import ResultsPanel from '../ResultsPanel.vue'

const BOX = { left: 0.4, right: 0.6, top: 0.45, bottom: 0.55, confidence: 0.9 }

async function mounted(containerId: Partial<ContainerIdReading>, photoUrl: string | null) {
  const store = useInspectionStore()
  const base = await recordedInspection('luna', { delayMs: 0 })
  store.record = { ...base, containerId: { ...base.containerId!, ...containerId } }
  store.status = 'complete'
  store.photo = photoUrl ? { name: 'door.jpg', url: photoUrl, orientation: 'landscape' } : null
  return mount(ResultsPanel)
}

describe('the ID card’s enlarged crop', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the crop of the photo beside the ID, captioned "Where we read the ID"', async () => {
    const wrapper = await mounted({ box: BOX }, 'blob:door')
    const img = wrapper.get('.rs-crop img')
    expect(img.attributes('src')).toBe('blob:door')
    expect(wrapper.get('.rs-crop figcaption').text()).toBe('Where we read the ID')
  })

  it('arrives with the card: it rises in as part of the card, like the alternatives', async () => {
    const wrapper = await mounted({ box: BOX }, 'blob:door')
    expect(wrapper.get('.rs-crop').classes()).toContain('qs-rise')
  })

  it('shows no crop when the reading carries no box', async () => {
    const wrapper = await mounted({ box: undefined }, 'blob:door')
    expect(wrapper.find('.rs-crop').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Where we read the ID')
  })

  it('shows no crop when there is no photo to cut it from', async () => {
    const wrapper = await mounted({ box: BOX }, null)
    expect(wrapper.find('.rs-crop').exists()).toBe(false)
  })
})
