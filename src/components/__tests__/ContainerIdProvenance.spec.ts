import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import ResultsPanel from '../ResultsPanel.vue'
import { withSideSampleRecording } from '../../__tests__/planRecordings'

// The side photo has no shipped recording yet: a test recording stands in so the sample can be chosen.
withSideSampleRecording()

describe('ContainerId provenance tag after a manifest check', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('tags a manifest match Matched against manifest', async () => {
    const store = useInspectionStore()
    store.record = {
      ...(await recordedInspection('luna', { delayMs: 0 })),
      containerId: {
        value: 'APHU6586847',
        observedCheckDigit: 7,
        calculatedCheckDigit: 7,
        checkDigitValid: true,
        certainty: 'Confident',
        provenance: 'manifest',
        manifestChecked: true,
      },
    }
    store.status = 'complete'
    expect(mount(ResultsPanel).text()).toContain('Matched against manifest')
  })

  it('tags a reading from the photo after a manifest check Read from image', async () => {
    const store = useInspectionStore()
    store.record = {
      ...(await recordedInspection('luna', { delayMs: 0 })),
      containerId: {
        value: 'APHU6586847',
        observedCheckDigit: 7,
        calculatedCheckDigit: 7,
        checkDigitValid: true,
        certainty: 'Confident',
        provenance: 'printed',
        manifestChecked: true,
      },
    }
    store.status = 'complete'
    expect(mount(ResultsPanel).text()).toContain('Read from image')
  })

  it("keeps the unidentified first result visible with Can't tell and the paste panel", async () => {
    vi.useFakeTimers()
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('side-dented')
    const run = store.start()
    await vi.advanceTimersByTimeAsync(1600)
    await run
    vi.useRealTimers()
    const w = mount(ResultsPanel)
    expect(w.text()).toContain("Can't tell")
    expect(w.text()).toContain('Container ID not identified')
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('offers no paste panel for a recorded result outside demo mode: no replay against another photo', async () => {
    const store = useInspectionStore()
    store.record = await recordedInspection('luna', { delayMs: 0, scenario: 'unidentified' })
    store.status = 'complete'
    expect(mount(ResultsPanel).find('textarea').exists()).toBe(false)
  })
})
