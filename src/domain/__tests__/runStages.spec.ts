import { describe, it, expect } from 'vitest'
import {
  RUN_STAGES,
  failedStagesByPhoto,
  stageProgress,
  type PlannedRequestState,
} from '../runStages'

const planned = (overrides: Partial<PlannedRequestState>): PlannedRequestState => ({
  id: 'read',
  stages: ['id'],
  state: 'waiting',
  optional: false,
  startedAt: null,
  settledAt: null,
  ...overrides,
})

const stateOf = (requests: PlannedRequestState[], stage: string) =>
  stageProgress(requests).find((s) => s.id === stage)?.state

describe('run stages', () => {
  it('are reading the ID, container details and checking for damage, in that order', () => {
    expect(RUN_STAGES.map((s) => s.title)).toEqual([
      'Reading the ID',
      'Reading container details',
      'Checking for damage',
    ])
  })

  it('show a stage with no request in this run as not part of it', () => {
    const stages = stageProgress([planned({ stages: ['id'], state: 'sent' })])
    expect(stages.map((s) => s.state)).toEqual(['active', 'not-in-run', 'not-in-run'])
  })

  it('stay active while any of their requests is waiting or in flight', () => {
    const requests = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'sent', optional: true }),
    ]
    expect(stateOf(requests, 'id')).toBe('active')
  })

  it('advance per stage: one stage done while another is still working', () => {
    const requests = [
      planned({ id: 'read', stages: ['id'], state: 'answered' }),
      planned({ id: 'side', stages: ['damage'], state: 'sent' }),
    ]
    expect(stageProgress(requests).map((s) => s.state)).toEqual(['done', 'not-in-run', 'active'])
  })

  it('are done when every request answered or was not needed', () => {
    const requests = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'not-needed', optional: true }),
    ]
    expect(stateOf(requests, 'id')).toBe('done')
  })

  it('fail when a required request failed, was stopped by the cap or never ran for want of its prerequisite', () => {
    for (const state of ['failed', 'blocked', 'skipped'] as const) {
      const requests = [
        planned({ id: 'read', stages: ['id', 'details'], state: 'answered' }),
        planned({ id: 'side', stages: ['damage'], state }),
      ]
      expect(stageProgress(requests).map((s) => s.state)).toEqual(['done', 'done', 'failed'])
    }
  })

  it('stay done when only an optional request failed: the result is already usable', () => {
    const requests = [
      planned({ id: 'read', state: 'answered' }),
      planned({ id: 'recheck', state: 'failed', optional: true }),
    ]
    expect(stateOf(requests, 'id')).toBe('done')
  })

  it('show cancelled when a request was cancelled, and failed when one also failed', () => {
    expect(stateOf([planned({ state: 'answered' }), planned({ state: 'cancelled' })], 'id')).toBe(
      'cancelled',
    )
    expect(stateOf([planned({ state: 'failed' }), planned({ state: 'cancelled' })], 'id')).toBe(
      'failed',
    )
  })

  it('measure a settled stage from its first request sent to its last settled, and nothing before', () => {
    const requests = [
      planned({ id: 'read', state: 'answered', startedAt: 1000, settledAt: 2400 }),
      planned({ id: 'recheck', state: 'answered', startedAt: 2400, settledAt: 3100 }),
      planned({ id: 'side', stages: ['damage'], state: 'sent', startedAt: 1000 }),
    ]
    const [id, , damage] = stageProgress(requests)
    expect(id?.elapsedMs).toBe(2100)
    expect(damage?.elapsedMs).toBeNull()
  })

  describe('with several photos', () => {
    // The 25 Oct 2026 run: the seal close-up's survey failed, the door photo read the ID and the damage.
    const sealFailed = [
      planned({ id: 'p1-read', photo: 1, stages: ['id', 'details'], state: 'failed' }),
      planned({ id: 'p1-side', photo: 1, stages: ['damage'], state: 'skipped' }),
      planned({ id: 'p2-read', photo: 2, stages: ['id', 'details'], state: 'answered' }),
      planned({ id: 'p2-side', photo: 2, stages: ['damage'], state: 'answered' }),
    ]

    it('count a part done when any photo gave it, though another photo lost its request', () => {
      expect(stageProgress(sealFailed).map((s) => s.state)).toEqual(['done', 'done', 'done'])
    })

    it('fail a part only when no photo gave it', () => {
      const both = sealFailed.map((r) =>
        r.id === 'p2-side' ? { ...r, state: 'failed' as const } : r,
      )
      expect(stageProgress(both).map((s) => s.state)).toEqual(['done', 'done', 'failed'])
    })

    it('stay active while any photo is still working on the part', () => {
      const working = sealFailed.map((r) =>
        r.id === 'p2-read' ? { ...r, state: 'sent' as const } : r,
      )
      expect(stateOf(working, 'id')).toBe('active')
    })

    it('name each photo that lost a part, with the parts it lost', () => {
      expect(failedStagesByPhoto(sealFailed)).toEqual([
        { photo: 1, stages: ['id', 'details', 'damage'] },
      ])
    })
  })

  it('name the parts a single-photo run lost under no photo', () => {
    const requests = [
      planned({ id: 'read', stages: ['id', 'details'], state: 'failed' }),
      planned({ id: 'side', stages: ['damage'], state: 'answered' }),
    ]
    expect(failedStagesByPhoto(requests)).toEqual([{ photo: null, stages: ['id', 'details'] }])
    expect(failedStagesByPhoto([planned({ state: 'answered' })])).toEqual([])
  })
})
