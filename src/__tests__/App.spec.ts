import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { useLedgerStore } from '../stores/ledger'
import App from '../App.vue'

function buttonNamed(wrapper: ReturnType<typeof mount>, pattern: RegExp) {
  return wrapper.findAll('button').find((b) => pattern.test(b.text()))
}
const startButton = (wrapper: ReturnType<typeof mount>) =>
  buttonNamed(wrapper, /Start inspection|Run live inspection|Analysing|Replace photo/)

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
    expect(wrapper.find('.qs-settingschip').attributes('title')).toContain('key set')
  })
})

describe('App: the inspection starts itself', () => {
  const photo = { name: 'a.jpg', url: 'blob:a', orientation: 'landscape' as const }
  beforeEach(() => {
    setActivePinia(createPinia())
    useSetupStore().view = 'inspection'
  })

  it('has no Start, Run live inspection or Replace photo button, with or without a photo', async () => {
    const store = useInspectionStore()
    store.setApiKey('test-only-key-0000')
    const wrapper = mount(App)
    expect(startButton(wrapper)).toBeUndefined()
    store.setPhoto(photo)
    await nextTick()
    expect(startButton(wrapper)).toBeUndefined()
    store.status = 'running'
    await nextTick()
    expect(startButton(wrapper)).toBeUndefined()
    store.status = 'complete'
    await nextTick()
    expect(startButton(wrapper)).toBeUndefined()
  })

  it('reads New inspection at rest and Cancel during a run', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    const wrapper = mount(App)
    expect(buttonNamed(wrapper, /^New inspection$/)).toBeDefined()
    store.status = 'running'
    await nextTick()
    expect(buttonNamed(wrapper, /^Cancel$/)).toBeDefined()
    expect(buttonNamed(wrapper, /New inspection/)).toBeUndefined()
  })

  it('Cancel clears straight back to the empty picker and keeps the session total', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    const wrapper = mount(App)
    store.status = 'running'
    await nextTick()
    const ledgerBefore = JSON.stringify(useLedgerStore().session)
    await buttonNamed(wrapper, /^Cancel$/)!.trigger('click')
    expect(store.photo).toBeNull()
    expect(store.status).toBe('idle')
    expect(store.record).toBeNull()
    expect(JSON.stringify(useLedgerStore().session)).toBe(ledgerBefore)
    // Back at the empty picker there is nothing to clear, so New inspection is gone.
    expect(buttonNamed(wrapper, /^New inspection$/)).toBeUndefined()
    expect(wrapper.find('.rs-top__centre').exists()).toBe(true)
  })

  it('offers Try again in a failed inspection notice, and it re-runs the same photos', async () => {
    const store = useInspectionStore()
    store.setPhoto(photo)
    const start = vi.spyOn(store, 'start').mockResolvedValue()
    const wrapper = mount(App)
    expect(buttonNamed(wrapper, /Try again/)).toBeUndefined()
    store.status = 'failed'
    store.errorMessage = 'The provider did not answer.'
    await nextTick()
    await buttonNamed(wrapper, /Try again/)!.trigger('click')
    expect(start).toHaveBeenCalledTimes(1)
    expect(store.photo).toEqual(photo)
  })

  it('opens the settings drawer when photos are chosen without a key, and starts once the key is saved with Enter', async () => {
    const store = useInspectionStore()
    const start = vi.spyOn(store, 'start').mockResolvedValue()
    const wrapper = mount(App)
    store.setPhoto(photo)
    void store.startWhenReady()
    await nextTick()
    expect(useSetupStore().drawerOpen).toBe(true)
    expect(start).not.toHaveBeenCalled()

    const key = wrapper.find<HTMLInputElement>(`#${store.provider}-key`)
    await key.setValue('test-only-key-0000')
    expect(start).not.toHaveBeenCalled()
    await key.trigger('keydown', { key: 'Enter' })

    expect(useSetupStore().drawerOpen).toBe(false)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('starts a recorded sample as soon as it is picked', async () => {
    const store = useInspectionStore()
    store.enterDemo()
    const start = vi.spyOn(store, 'start').mockResolvedValue()
    const wrapper = mount(App)
    await wrapper.find('.qs-sample').trigger('click')
    expect(store.photo).not.toBeNull()
    expect(start).toHaveBeenCalledTimes(1)
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
