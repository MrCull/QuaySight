// Where the analytics events fire (docs/adr/0002-*). The analytics service itself is in
// services/__tests__/analytics.spec.ts; here it is mocked, and only the calls are checked.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const trackMock = vi.fn<(event: AnalyticsEvent) => void>()
vi.mock('../../services/analytics', () => ({
  track: (event: AnalyticsEvent) => trackMock(event),
}))

import { useInspectionStore } from '../inspection'
import { useSetupStore } from '../setup'
import { useLedgerStore } from '../ledger'
import { demoSamples, registerDemoRecording, type DemoSampleId } from '../../domain/demoSamples'
import { dentedSideRecording } from '../../__tests__/planRecordings'
import type { ChargeableRequest } from '../../domain/ledger'
import type { AnalyticsEvent } from '../../services/analytics'

function names(): string[] {
  return trackMock.mock.calls.map(([event]) => event.name)
}

/** A live call that costs the whole per-inspection spend limit in one go. */
function costlyRequest(inspectionId: string, n: number): ChargeableRequest {
  return {
    id: `req-${n}`,
    inspectionId,
    purpose: 'test',
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/alpha/decisions',
    model: 'typesafe/jev-1.14',
    call: async () => ({
      resolvedModel: 'typesafe/jev-1.14',
      usage: null,
      latencyMs: 1,
      reportedCostUsd: 0.5,
    }),
  }
}

describe('analytics events', () => {
  let removeSideRecording = () => {}

  beforeEach(() => {
    removeSideRecording = registerDemoRecording(dentedSideRecording())
    localStorage.clear()
    setActivePinia(createPinia())
    trackMock.mockReset()
  })

  afterEach(() => {
    removeSideRecording()
    vi.useRealTimers()
  })

  it('entering demo mode sends demo_started', () => {
    useSetupStore().enterDemo()

    expect(trackMock).toHaveBeenCalledWith({ name: 'demo_started' })
  })

  it('choosing a provider sends provider_selected with its name only; the same one again sends nothing', () => {
    const setup = useSetupStore()

    setup.chooseProvider('luna')
    setup.chooseProvider('luna')

    expect(trackMock.mock.calls).toEqual([[{ name: 'provider_selected', provider: 'luna' }]])
  })

  it('a demo run sends inspection_started with its photo count, then inspection_finished', async () => {
    vi.useFakeTimers()
    useSetupStore().enterDemo()
    const store = useInspectionStore()
    const sample = demoSamples()[0]!
    trackMock.mockReset()

    store.chooseSample(sample.id as DemoSampleId)
    const run = store.start()
    await vi.advanceTimersByTimeAsync(2000)
    await run

    expect(trackMock.mock.calls).toEqual([
      [{ name: 'inspection_started', mode: 'demo', photo_count: store.photos.length }],
      [{ name: 'inspection_finished', mode: 'demo' }],
    ])
  })

  it('repeated clicks on a run in flight send inspection_started once', async () => {
    vi.useFakeTimers()
    useSetupStore().enterDemo()
    const store = useInspectionStore()
    store.chooseSample(demoSamples()[0]!.id as DemoSampleId)
    trackMock.mockReset()

    const run = store.start()
    void store.start()
    await vi.advanceTimersByTimeAsync(2000)
    await run

    expect(names().filter((n) => n === 'inspection_started')).toHaveLength(1)
  })

  it('a live call refused by the spend limit sends spend_cap_hit once per inspection', async () => {
    const ledger = useLedgerStore()

    await ledger.run(costlyRequest('live-a', 1))
    await ledger.run(costlyRequest('live-a', 2))
    await ledger.run(costlyRequest('live-a', 3))
    await ledger.run(costlyRequest('live-b', 4))

    expect(trackMock.mock.calls).toEqual([
      [{ name: 'spend_cap_hit', mode: 'live', reason: 'spend' }],
    ])
  })
})
