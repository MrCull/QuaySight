import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../stores/inspection'
import App from '../App.vue'

function startButton(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('button')
    .find((b) => b.text().includes('Start inspection') || b.text().includes('Analysing'))
}

describe('App', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps Start disabled until a photo is chosen', () => {
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('enables Start once a photo is set, and shows it as busy while running', async () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeUndefined()
    store.status = 'running'
    await nextTick()
    expect(wrapper.text()).toContain('Analysing')
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })
})
