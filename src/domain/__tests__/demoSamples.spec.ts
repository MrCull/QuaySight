import { describe, it, expect, afterEach } from 'vitest'
import {
  demoSamples,
  pendingDemoRecordings,
  registerDemoRecording,
  runDemoManifestRetry,
  runDemoSample,
} from '../demoSamples'
import { idResultState } from '../certainty'
import { recordedDemonstrationLabel } from '../providers'
import { buildSummaryText } from '../exports'
import { dentedSideRecording, fullChsuRecording } from '../../__tests__/planRecordings'

// Demo mode replays real recordings only (spec #27, ticket #37): a sample's result is what a model
// answered on that sample's own photo, replayed through the live answer mappers. A sample with no
// recording is not offered, and nothing hand-written stands in for one.

const undo: (() => void)[] = []
afterEach(() => {
  while (undo.length) undo.pop()!()
})
const register = (recording: Parameters<typeof registerDemoRecording>[0]) =>
  undo.push(registerDemoRecording(recording))

describe('demo samples: each result is a recording of its own photo', () => {
  it('offers the samples that have a recording, each with the photo it was recorded on', () => {
    for (const sample of demoSamples()) {
      expect(sample.photo.name).toMatch(/\.jpg$/)
    }
    expect(demoSamples().map((s) => s.id)).toEqual(['rear-aphu', 'rear-chsu'])
  })

  it('labels every sample "Recorded demonstration: [provider/model]" with the model that answered', async () => {
    const labels = await Promise.all(
      demoSamples().map(async (sample) =>
        recordedDemonstrationLabel(await runDemoSample(sample.id)),
      ),
    )
    expect(labels).toEqual([
      'Recorded demonstration: GPT-6 Luna / gpt-6-luna',
      'Recorded demonstration: Jev latest (TypeSafe) via OpenRouter / ~typesafe/jev-latest',
    ])
  })

  it('the summary export carries the same label as the screen', async () => {
    const record = await runDemoSample('rear-chsu')
    expect(buildSummaryText(record)).toContain(recordedDemonstrationLabel(record))
  })

  it('replays the real Jev latest response for the clean grey rear doors, with the version that answered', async () => {
    const record = await runDemoSample('rear-chsu')
    expect(record.resolvedVersion).toBe('typesafe/jev-1.14-20261014')
    // Jev misread some digits of CHSU 205183 1 on this photo; the recording keeps that honest reading.
    expect(record.containerId?.value).toBe('CHSG8318881')
    expect(record.containerId?.certainty).not.toBe('Confident')
  })

  it('is a replay: recorded source, every saved body marked as a recorded fixture, complete', async () => {
    for (const sample of demoSamples()) {
      const record = await runDemoSample(sample.id)
      expect(record).toMatchObject({ source: 'recorded', status: 'complete' })
      expect(record.photo?.name).toBe(sample.photo.name)
      expect(record.rawResponses.length).toBeGreaterThan(0)
      expect(new Set(record.rawResponses.map((r) => r.capturedFrom))).toEqual(
        new Set(['recorded-fixture']),
      )
    }
  })

  it('says nothing about parts a recording never asked: no details, no weights, no damage', async () => {
    // The recordings made before the survey existed asked only for the container ID.
    const record = await runDemoSample('rear-chsu')
    expect(record.details).toBeUndefined()
    expect(record.weights).toBeNull()
    expect(record.damage).toBeNull()
    expect(record.sizeCode).toBeNull()
  })
})

describe('a sample with no recording yet', () => {
  it('is not offered, and nothing hand-written stands in for it', async () => {
    expect(demoSamples().map((s) => s.id)).not.toContain('side-dented')
    await expect(runDemoSample('side-dented')).rejects.toThrow(/recording/)
  })

  it('is listed as pending, with the routes still to be recorded', () => {
    expect(pendingDemoRecordings()).toContainEqual({
      sample: 'side-dented',
      photo: 'samples/side-dented-grey.jpg',
      route: { provider: 'luna', model: 'gpt-6-luna' },
      covers: 'nothing',
    })
  })

  it('is offered once its photo has a recording, replayed with the findings that recording made', async () => {
    register(dentedSideRecording())

    expect(demoSamples().map((s) => s.id)).toContain('side-dented')
    const record = await runDemoSample('side-dented')

    expect(idResultState(record.containerId!)).toBe('insufficient')
    expect(record.damage?.photos).toEqual([{ photo: 'side-dented-grey.jpg', face: 'long-side' }])
    expect(record.damage?.findings.map((f) => f.location)).toHaveLength(1)
    expect(recordedDemonstrationLabel(record)).toBe(
      'Recorded demonstration: GPT-6 Luna / gpt-6-luna',
    )
    // Its Luna slot is filled; Jev's is still to record.
    const pending = pendingDemoRecordings().filter((p) => p.sample === 'side-dented')
    expect(pending.map((p) => p.route.provider)).toEqual(['openrouter'])
  })
})

describe('which recording a sample replays', () => {
  it('prefers a recording of the whole plan over one made before the survey existed', async () => {
    register(fullChsuRecording())

    const record = await runDemoSample('rear-chsu')

    expect(record.containerId?.value).toBe('CHSU2051831')
    expect(record.details?.sizeCode.code).toBe('22G1')
    expect(record.photoFace?.face).toBe('rear-doors')
  })

  it('never replays a recording of another photo', async () => {
    register(dentedSideRecording())

    const rear = await runDemoSample('rear-aphu')

    expect(rear.photo?.name).toBe('rear-door-aphu-45g1.jpg')
    expect(rear.damage).toBeNull()
    expect(rear.rawResponses.map((r) => r.passId)).toEqual([`${rear.id}-read`])
  })
})

describe('the recorded manifest check', () => {
  it('replays the recording’s own reading: a manifest entry that matches is confirmed', async () => {
    const reading = await runDemoManifestRetry('rear-chsu', ['CHSG8318881'])
    expect(reading).toMatchObject({
      value: 'CHSG8318881',
      provenance: 'manifest',
      manifestChecked: true,
    })
  })

  it('finds no match where the recording read nothing of the ID, and fails as the sample option asks', async () => {
    register(dentedSideRecording())
    expect(await runDemoManifestRetry('side-dented', ['APHU6586847'])).toBeNull()
    await expect(runDemoManifestRetry('rear-chsu', ['X'], { fail: true })).rejects.toThrow(
      /Service is busy/,
    )
  })
})
