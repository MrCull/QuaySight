import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { runRecordedInspection } from '../../domain/recordedRun'
import ManifestRetry from '../ManifestRetry.vue'

async function setup(scenario: 'unidentified' | 'identified' = 'unidentified') {
  const store = useInspectionStore()
  store.setPhoto({ name: 'a.jpg', url: 'blob:a', orientation: 'landscape' })
  store.setApiKey('test-only-key-0000')
  store.replaySample = true
  store.record = await runRecordedInspection('luna', { delayMs: 0, scenario })
  store.status = 'complete'
  return store
}

function field(w: ReturnType<typeof mount>) {
  return w.find('textarea')
}

function primary(w: ReturnType<typeof mount>) {
  return w.findAll('button').find((b) => b.text() === 'Check again with this manifest')!
}

function buttonNamed(w: ReturnType<typeof mount>, name: string) {
  return w.findAll('button').find((b) => b.text() === name)!
}

describe('ManifestRetry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('shows the optional paste panel only when the container ID was not identified', async () => {
    await setup('identified')
    expect(mount(ManifestRetry).find('textarea').exists()).toBe(false)
  })

  it('renders the fixed title, body, kicker and field label', async () => {
    await setup()
    const w = mount(ManifestRetry)
    expect(w.text()).toContain('Container ID not identified')
    expect(w.text()).toContain(
      'If you have the manifest, paste the container numbers and check again.',
    )
    expect(w.text()).toContain('Optional')
    expect(w.find('label').text()).toBe('Container numbers from the manifest')
  })

  it('counts entries and duplicates live, ignoring case', async () => {
    await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111\nBBBU2222222, aaau1111111\nCCCU3333333')
    expect(w.find('[role="status"]').text()).toContain('3 container numbers found')
    expect(w.find('[role="status"]').text()).toContain('1 duplicate ignored')
    w.unmount()
  })

  it('uses singular wording for one entry and no duplicate line when none are ignored', async () => {
    await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111')
    expect(w.find('[role="status"]').text()).toContain('1 container number found')
    expect(w.find('[role="status"]').text()).not.toContain('duplicate')
    w.unmount()
  })

  it('shows the limit message and uses aria-disabled, not the disabled attribute, over 500 entries', async () => {
    const store = await setup()
    const spy = vi.spyOn(store, 'retryManifest').mockResolvedValue()
    const w = mount(ManifestRetry, { attachTo: document.body })
    const ids = Array.from({ length: 501 }, (_, i) => `AAAU${String(i).padStart(7, '0')}`)
    await field(w).setValue(ids.join('\n'))
    expect(w.text()).toContain('Limit for this demo is 500. Remove some to continue.')
    const go = primary(w)
    expect(go.attributes('aria-disabled')).toBe('true')
    expect(go.attributes('disabled')).toBeUndefined()
    await go.trigger('click')
    expect(spy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('is aria-disabled with no entries, and enables once an entry is pasted', async () => {
    await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    expect(primary(w).attributes('aria-disabled')).toBe('true')
    await field(w).setValue('AAAU1111111')
    expect(primary(w).attributes('aria-disabled')).toBeUndefined()
    w.unmount()
  })

  it('keeps entries as pasted, with no ISO or check-digit messages', async () => {
    await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('NOTVALID')
    expect(w.text()).not.toMatch(/check digit|ISO|invalid/i)
    expect(primary(w).attributes('aria-disabled')).toBeUndefined()
    w.unmount()
  })

  it('has keyboard order: text area, primary, secondary', async () => {
    await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    const order = w.findAll('textarea, button').map((el) => `${el.element.tagName}:${el.text()}`)
    expect(order).toEqual([
      'TEXTAREA:',
      'BUTTON:Check again with this manifest',
      'BUTTON:Keep first result',
    ])
    w.unmount()
  })

  it('sends the parsed entries to the store on the primary action', async () => {
    const store = await setup()
    const spy = vi.spyOn(store, 'retryManifest').mockResolvedValue()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111\nBBBU2222222')
    await primary(w).trigger('click')
    expect(spy).toHaveBeenCalledWith(['AAAU1111111', 'BBBU2222222'])
    w.unmount()
  })

  it('shows the recorded cost note: no live call and no charge', async () => {
    await setup()
    const w = mount(ManifestRetry)
    expect(w.text()).toContain('OpenAI GPT-6 Luna')
    expect(w.text()).toContain('No live call and no charge')
    expect(w.text()).not.toContain('adds to the cost total')
  })

  it('on error shows the provider message and offers Try again and Keep first result', async () => {
    const store = await setup()
    store.retryFails = true
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111')
    await primary(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    expect(w.find('[role="alert"]').text()).toContain('OpenAI said: "Rate limit reached')
    expect(w.text()).toContain('Your first result is unchanged.')
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Try again', 'Keep first result'])
    w.unmount()
  })

  it('moves focus to Try again after an error', async () => {
    const store = await setup()
    store.retryFails = true
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111')
    await primary(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(buttonNamed(w, 'Try again').element)
    w.unmount()
  })

  it('Try again reruns with the same entries', async () => {
    const store = await setup()
    store.retryFails = true
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('APHU6586847')
    await primary(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    store.retryFails = false
    await buttonNamed(w, 'Try again').trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    w.unmount()
  })

  it('Keep first result closes the panel and changes nothing', async () => {
    const store = await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await buttonNamed(w, 'Keep first result').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(w.find('textarea').exists()).toBe(false)
    expect(store.record?.containerId).toBeNull()
    w.unmount()
  })

  it('on success the panel leaves and the new ID is in the store', async () => {
    const store = await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('AAAU1111111')
    await primary(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    expect(store.record?.containerId?.value).toBe('APHU6586847')
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(w.find('textarea').exists()).toBe(false)
    w.unmount()
  })
})
