import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { INSPECTION_SCHEMA_VERSION } from '../../domain/inspection'
import ManifestRetry from '../ManifestRetry.vue'
import { readNothingOfId, withAllSampleRecordings } from '../../__tests__/planRecordings'

// The side photo has no shipped recording yet: a test recording stands in so the sample can be chosen.
withAllSampleRecordings()

/** Demo mode: the damaged side (no ID read) or the APHU rear doors (ID read), with their own recorded check. */
async function setup(scenario: 'unidentified' | 'identified' = 'unidentified') {
  const store = useInspectionStore()
  store.enterDemo()
  store.chooseSample(scenario === 'unidentified' ? 'side-dented' : 'rear-aphu')
  const run = store.start()
  await vi.advanceTimersByTimeAsync(1600)
  await run
  return store
}

const KEY = 'test-only-openrouter-key-0000'

/** A live OpenRouter result with two positions unread; the manifest check is answered by a stubbed fetch. */
function liveSetup(pick: string) {
  const store = useInspectionStore()
  store.setProvider('openrouter')
  store.setModel('typesafe/jev-1.14')
  store.setApiKey(KEY)
  store.setPhoto({ name: 'rear.jpg', url: 'blob:a', orientation: 'portrait' })
  store.record = {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id: 'live-openrouter-test',
    provider: 'openrouter',
    model: 'typesafe/jev-1.14',
    resolvedVersion: 'typesafe/jev-1.14-20261014',
    rawResponses: [],
    source: 'live',
    status: 'complete',
    photo: { name: 'rear.jpg', orientation: 'portrait' },
    containerId: {
      value: 'MSCU44173??',
      observedCheckDigit: null,
      calculatedCheckDigit: null,
      checkDigitValid: false,
      certainty: "Can't tell",
      provenance: 'printed',
    },
    damage: null,
    sizeCode: null,
    weights: null,
  }
  store.status = 'complete'
  store.sentPhoto = new Blob(['jpeg 1176x1568'], { type: 'image/jpeg' })
  const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      questions: Record<string, { criteria: Record<string, string> }>
    }
    const answers = Object.fromEntries(
      Object.entries(body.questions).map(([name, q]) => [
        name,
        {
          type: 'choice',
          choice: pick,
          probabilities: Object.fromEntries(
            Object.keys(q.criteria).map((o) => [o, o === pick ? 0.95 : 0.01]),
          ),
        },
      ]),
    )
    return new Response(
      JSON.stringify({ model: 'typesafe/jev-1.14-20261014', answers, usage: { cost: 0.00008 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return { store, fetchMock }
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
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

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

  it('on a live error shows our own message once, without quoting the provider by name twice', async () => {
    const { store } = liveSetup('MSCU4417305')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Rate limited', code: 429 } }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('MSCU4417305')
    await primary(w).trigger('click')
    await vi.waitFor(() => expect(store.retry.status).toBe('error'))
    await nextTick()
    const alert = w.get('[role="alert"]').text()
    expect(alert).toContain('OpenRouter rate limit reached')
    expect(alert).not.toContain('said:')
    expect(alert.match(/OpenRouter/g)).toHaveLength(1)
    expect(alert).toContain('Your first result is unchanged.')
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
    const spy = vi.spyOn(store, 'retryManifest')
    await buttonNamed(w, 'Try again').trigger('click')
    expect(spy).toHaveBeenCalledWith(['APHU6586847'])
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    expect(store.retry.status).toBe('idle')
    w.unmount()
  })

  it('Keep first result closes the panel and changes nothing', async () => {
    const store = await setup()
    const w = mount(ManifestRetry, { attachTo: document.body })
    await buttonNamed(w, 'Keep first result').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(w.find('textarea').exists()).toBe(false)
    expect(readNothingOfId(store.record)).toBe(true)
    w.unmount()
  })

  it('on success the panel leaves and the new ID is in the store', async () => {
    const { store } = liveSetup('MSCU4417305')
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('MSCU4417305\nAPHU6586847')
    await primary(w).trigger('click')
    await vi.waitFor(() => expect(store.retry.status).toBe('idle'))
    expect(store.record?.containerId?.value).toBe('MSCU4417305')
    expect(store.record?.containerId?.provenance).toBe('manifest')
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(w.find('textarea').exists()).toBe(false)
    w.unmount()
  })

  it('after a live result, says the check is a new live call that adds to the cost total', () => {
    liveSetup('other_not_listed')
    const w = mount(ManifestRetry)
    expect(w.text()).toContain(
      'This runs a new live check on Jev 1.14 (TypeSafe) via OpenRouter and adds to the cost total.',
    )
    expect(w.text()).not.toContain('No live call')
  })

  it('when no entry matches the photo, stays open with the entries and says the first result is unchanged', async () => {
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('side-dented')
    const run = store.start()
    await vi.advanceTimersByTimeAsync(1600)
    await run
    const w = mount(ManifestRetry, { attachTo: document.body })
    await field(w).setValue('APHU 658684 7')
    await primary(w).trigger('click')
    await vi.advanceTimersByTimeAsync(1600)
    await nextTick()
    expect(w.find('[role="status"].qs-manifest__nomatch').text()).toBe(
      'No entry in this manifest matches what the photo shows. Your first result is unchanged.',
    )
    expect((field(w).element as HTMLTextAreaElement).value).toBe('APHU 658684 7')
    expect(readNothingOfId(store.record)).toBe(true)
    w.unmount()
  })
})
