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

describe('the ID’s enlarged crop, in its key-facts tile', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows the crop of the photo under the ID in its tile, captioned "Where we read the ID"', async () => {
    const wrapper = await mounted({ box: BOX }, 'blob:door')
    const img = wrapper.get('[data-tile="id"] .qs-keytile__crop .rs-crop img')
    expect(img.attributes('src')).toBe('blob:door')
    expect(img.attributes('alt')).toBe('The container ID, enlarged')
    expect(wrapper.get('[data-tile="id"] .rs-crop figcaption').text()).toBe(
      'Where we read the ID · Photo 1',
    )
  })

  it('is its own control: tapping it shows the full photo and does not jump to the detail', async () => {
    const wrapper = await mounted({ box: BOX }, 'blob:door')
    const tap = wrapper.get('[data-tile="id"] .rs-crop__tap')
    await tap.trigger('click')
    expect(tap.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement?.id).not.toBe('detail-id')
  })

  it('shows no crop when the reading carries no box', async () => {
    const wrapper = await mounted({ box: undefined }, 'blob:door')
    expect(wrapper.find('.rs-crop').exists()).toBe(false)
    expect(wrapper.find('img[alt="The container ID, enlarged"]').exists()).toBe(false)
  })

  it('shows no crop when there is no photo to cut it from', async () => {
    const wrapper = await mounted({ box: BOX }, null)
    expect(wrapper.find('.rs-crop').exists()).toBe(false)
  })
})
