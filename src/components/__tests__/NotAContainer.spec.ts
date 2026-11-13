import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore, type SelectedPhoto } from '../../stores/inspection'
import type { InspectionRecord } from '../../domain/inspection'
import NotAContainer from '../NotAContainer.vue'
import App from '../../App.vue'
import { useSetupStore } from '../../stores/setup'

// The screen as the uploader sees it. Its words are tested against the pure builder (domain/notAContainer).

const photo = (n: number): SelectedPhoto => ({
  name: `p${n}.jpg`,
  url: `data:image/png;base64,${n}`,
  orientation: 'landscape',
})

function finished(count: number) {
  const store = useInspectionStore()
  store.photo = photo(1)
  store.extraPhotos = Array.from({ length: count - 1 }, (_, i) => photo(i + 2))
  store.status = 'complete'
  store.record = (count === 1
    ? { photoFace: { face: 'not-container', probability: 0.9, certainty: 'Confident' } }
    : {
        photos: Array.from({ length: count }, () => ({ dropped: true })),
      }) as unknown as InspectionRecord
  return store
}

describe('NotAContainer', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('stamps one photo and gives the one-photo achievement', () => {
    finished(1)
    const wrapper = mount(NotAContainer)

    expect(wrapper.findAll('.qs-nac__stamp').map((s) => s.text())).toEqual(['REJECTED'])
    expect(wrapper.get('.qs-id').attributes('aria-label')).toBe(
      'T R O L 0 0 0 0 0 6, check digit 7',
    )
    expect(wrapper.get('.qs-nac__achtitle').text()).toBe('Wannabe QA')
    expect(wrapper.get('.qs-nac__xpgain').text()).toBe('+1 XP')
    expect(wrapper.find('.qs-nac__combo').exists()).toBe(false)
    expect(wrapper.get('.qs-nac__mock').text()).toBe(
      'wHaT aRe YoU gOiNg To Do NeXt, A bAnAnA sKiN?',
    )
  })

  it('counts three photos', () => {
    finished(3)
    const wrapper = mount(NotAContainer)

    expect(wrapper.findAll('.qs-nac__stamp').map((s) => s.text())).toEqual([
      'REJECTED',
      'REJECTED',
      'ALSO NO',
    ])
    expect(wrapper.get('.qs-nac__tally').text()).toBe('3 photos · 0 containers · 3 rejections')
    expect(wrapper.get('.qs-nac__combo').text()).toBe('COMBO x3')
    expect(wrapper.get('.qs-nac__xpgain').text()).toBe('+3 XP')
  })

  it('respawns: the button clears to a new inspection', async () => {
    const store = finished(1)
    const wrapper = mount(NotAContainer)

    await wrapper.get('.qs-nac__respawn').trigger('click')

    expect(store.photo).toBeNull()
    expect(store.record).toBeNull()
    expect(store.status).toBe('idle')
  })

  it('takes the place of the photo strip and results in the app', () => {
    finished(2)
    useSetupStore().view = 'inspection'
    const wrapper = mount(App)

    expect(wrapper.find('.qs-nac').exists()).toBe(true)
    expect(wrapper.find('.rs-band').exists()).toBe(false)
  })
})
