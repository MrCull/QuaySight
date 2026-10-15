import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { runRecordedInspection } from '../../domain/recordedRun'
import ResultsPanel from '../ResultsPanel.vue'

describe('ContainerId provenance tag after a manifest check', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('tags a manifest match Matched against manifest', async () => {
    const store = useInspectionStore()
    store.record = {
      ...(await runRecordedInspection('luna', { delayMs: 0 })),
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
      ...(await runRecordedInspection('luna', { delayMs: 0 })),
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
    const store = useInspectionStore()
    store.record = await runRecordedInspection('luna', { delayMs: 0, scenario: 'unidentified' })
    store.status = 'complete'
    const w = mount(ResultsPanel)
    expect(w.text()).toContain("Can't tell")
    expect(w.text()).toContain('Container ID not identified')
    expect(w.find('textarea').exists()).toBe(true)
  })
})
