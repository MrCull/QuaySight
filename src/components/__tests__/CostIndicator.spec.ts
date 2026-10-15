import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'
import { runRecordedInspection } from '../../domain/recordedRun'
import type { ChargeableRequest } from '../../domain/ledger'
import CostIndicator from '../CostIndicator.vue'

function liveRequest(overrides: Partial<ChargeableRequest> = {}): ChargeableRequest {
  return {
    id: 'req-1',
    inspectionId: 'live-insp-1',
    purpose: 'Reading markings',
    provider: 'luna',
    endpoint: 'decisions',
    model: 'gpt-6-luna',
    call: async () => ({
      resolvedModel: 'gpt-6-luna-2026-10-01',
      usage: { inputTokens: 15780, outputTokens: 0 },
      latencyMs: 2400,
    }),
    ...overrides,
  }
}

describe('CostIndicator', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows "no charge" for a recorded sample and adds nothing to the live ledger', async () => {
    const inspection = useInspectionStore()
    const ledger = useLedgerStore()
    inspection.record = await runRecordedInspection('luna', { delayMs: 0 })
    inspection.status = 'complete'

    const wrapper = mount(CostIndicator)
    expect(wrapper.text()).toContain('Sample')
    expect(wrapper.text()).toContain('Saved result · no charge')
    expect(wrapper.text()).not.toContain('This container')
    expect(ledger.session.requests).toBe(0)
    expect(ledger.entries()).toHaveLength(0)
  })

  it('shows this container and session totals for live requests, to four decimals', async () => {
    const inspection = useInspectionStore()
    const ledger = useLedgerStore()
    inspection.record = {
      schemaVersion: 1,
      id: 'live-insp-1',
      provider: 'luna',
      model: 'gpt-6-luna',
      source: 'live',
      status: 'complete',
      photo: null,
      containerId: null,
    }
    await ledger.run(liveRequest())

    const wrapper = mount(CostIndicator)
    expect(wrapper.text()).toContain('Live')
    expect(wrapper.text()).toContain('This container')
    expect(wrapper.text()).toContain('$0.0016')
    expect(wrapper.text()).toContain('Session')
    expect(wrapper.text()).not.toContain('$0.00 ')
  })

  it('expands to a per-request ledger with purpose, provider, exact model, status, tokens, cost and latency', async () => {
    const inspection = useInspectionStore()
    const ledger = useLedgerStore()
    inspection.record = {
      schemaVersion: 1,
      id: 'live-insp-1',
      provider: 'luna',
      model: 'gpt-6-luna',
      source: 'live',
      status: 'complete',
      photo: null,
      containerId: null,
    }
    await ledger.run(liveRequest())

    const wrapper = mount(CostIndicator)
    const toggle = wrapper.get('button.qs-cost__toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.qs-cost__table').exists()).toBe(false)

    await toggle.trigger('click')
    expect(wrapper.get('button.qs-cost__toggle').attributes('aria-expanded')).toBe('true')
    const row = wrapper.get('.qs-cost__table tbody tr')
    expect(row.text()).toContain('Reading markings')
    expect(row.text()).toContain('OpenAI · GPT-6 Luna')
    expect(row.text()).toContain('gpt-6-luna-2026-10-01')
    expect(row.text()).toContain('complete')
    expect(row.text()).toContain('15,780')
    expect(row.text()).toContain('$0.0016')
    expect(row.text()).toContain('2.4 s')
  })

  it('shows an incomplete estimate, never zero, when a request has unknown cost', async () => {
    const inspection = useInspectionStore()
    const ledger = useLedgerStore()
    inspection.record = {
      schemaVersion: 1,
      id: 'live-insp-2',
      provider: 'jev',
      model: 'jev-1.14.0',
      source: 'live',
      status: 'complete',
      photo: null,
      containerId: null,
    }
    await ledger.run(
      liveRequest({
        id: 'req-jev',
        inspectionId: 'live-insp-2',
        provider: 'jev',
        endpoint: 'system-one',
        model: 'jev-1.14.0',
        call: async () => ({ resolvedModel: 'jev-1.14.0', usage: null, latencyMs: 1200 }),
      }),
    )

    const wrapper = mount(CostIndicator)
    expect(wrapper.text()).toContain('Partial estimate')
    expect(wrapper.text()).not.toContain('$0.0000')

    await wrapper.get('button.qs-cost__toggle').trigger('click')
    expect(wrapper.get('.qs-cost__table tbody').text()).toContain('Cost unavailable')
  })

  it('labels the totals as estimates, not an invoice, in the expanded panel', async () => {
    const wrapper = mount(CostIndicator)
    await wrapper.get('button.qs-cost__toggle').trigger('click')
    expect(wrapper.text().toLowerCase()).toContain('not an invoice')
  })
})
