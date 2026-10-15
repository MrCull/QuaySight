import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { runRecordedInspection } from '../../domain/recordedRun'
import { downloadText } from '../../services/download'
import ExportActions from '../ExportActions.vue'

vi.mock('../../services/download', () => ({
  downloadText: vi.fn<(filename: string, text: string, mimeType: string) => void>(),
}))

describe('ExportActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(downloadText).mockClear()
  })

  it('renders nothing before a result exists', () => {
    const wrapper = mount(ExportActions)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('downloads the consolidated JSON, raw responses and summary as three files', async () => {
    const store = useInspectionStore()
    store.record = await runRecordedInspection('luna', { delayMs: 0, id: 'run-luna-1' })
    store.status = 'complete'
    const wrapper = mount(ExportActions)
    const labels = wrapper.findAll('button').map((b) => b.text())
    expect(labels).toEqual(['Export JSON', 'Download raw response', 'Download summary'])

    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    await wrapper.findAll('button')[2]!.trigger('click')

    const calls = vi.mocked(downloadText).mock.calls
    expect(calls.map((c) => c[0])).toEqual([
      'quay-sight-run-luna-1-inspection.json',
      'quay-sight-run-luna-1-raw-responses.json',
      'quay-sight-run-luna-1-summary.txt',
    ])
    expect(calls[0]![1]).toContain('"schemaVersion": 1')
    expect(calls[0]![2]).toBe('application/json')
    expect(calls[1]![1]).toContain('"capturedFrom": "recorded-fixture"')
    expect(calls[2]![1].split('\n')[0]).toBe('Quay Sight - POC, non-certified')
    expect(calls[2]![2]).toBe('text/plain')
  })
})
