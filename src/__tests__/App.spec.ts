import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
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

describe('App: setup gate', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows only the setup card before Continue, and the inspection screen after', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('.qs-setupcard').exists()).toBe(true)
    expect(wrapper.find('#stage').exists()).toBe(false)
    expect(startButton(wrapper)).toBeUndefined()

    useInspectionStore().setApiKey('test-only-key-0000')
    await nextTick()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Continue')!
      .trigger('click')
    expect(wrapper.find('.qs-setupcard').exists()).toBe(false)
    expect(wrapper.find('#stage').exists()).toBe(true)
    expect(wrapper.find('.qs-settingschip').text()).toContain('key set')
  })
})

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSetupStore().view = 'inspection'
  })

  it('keeps Start disabled until a photo is chosen', () => {
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
  })

  it('keeps Start disabled with a photo but no key, even for a recorded sample', () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const wrapper = mount(App)
    expect(startButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain("Enter this provider's key in settings to start")
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

  it('opens the settings drawer from the word "settings" in the key hint', async () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    const wrapper = mount(App)
    const link = wrapper.get('.rs-gate-hint button')
    expect(link.text()).toBe('settings')
    await link.trigger('click')
    expect(useSetupStore().drawerOpen).toBe(true)
  })

  it('offers no second run once the result has landed: New inspection is the next step', async () => {
    const store = useInspectionStore()
    store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
    store.setApiKey('test-only-key-0000')
    const wrapper = mount(App)
    store.status = 'complete'
    await nextTick()
    expect(startButton(wrapper)).toBeUndefined()
    store.status = 'failed'
    await nextTick()
    expect(startButton(wrapper)?.attributes('disabled')).toBeUndefined()
  })
})

describe('App in demo mode: the sample option', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSetupStore().view = 'inspection'
  })

  async function demoResult(sample: 'rear-aphu' | 'rear-chsu') {
    vi.useFakeTimers()
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample(sample)
    const run = store.start()
    await vi.advanceTimersByTimeAsync(2000)
    await run
    vi.useRealTimers()
    return mount(App)
  }

  it('is offered while the manifest offer is open: the recorded ID has a position unread', async () => {
    // Luna's earlier recorded read of the APHU photo leaves one position unread.
    const wrapper = await demoResult('rear-aphu')
    expect(wrapper.text()).toContain('Container ID not identified')
    expect(wrapper.text()).toContain('Make the manifest check fail')
  })

  it('is not offered once the recorded ID is complete', async () => {
    const wrapper = await demoResult('rear-chsu')
    expect(wrapper.text()).not.toContain('Container ID not identified')
    expect(wrapper.text()).not.toContain('Make the manifest check fail')
  })
})
