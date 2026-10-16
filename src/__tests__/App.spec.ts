import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../stores/inspection'
import App from '../App.vue'

function startButton(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('button')
    .find(
      (b) =>
        b.text().includes('Start inspection') ||
        b.text().includes('Run live inspection') ||
        b.text().includes('Analysing'),
    )
}

describe('App', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps Start disabled until a photo is chosen', () => {
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('keeps Start disabled with a photo but no key, even for a recorded sample', () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain("Enter this provider's key to start")
  })

  it('enables Start once a photo and a key are set, and shows it as busy while running', async () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setApiKey('test-only-key-0000')
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeUndefined()
    store.status = 'running'
    await nextTick()
    expect(wrapper.text()).toContain('Analysing')
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })
})
