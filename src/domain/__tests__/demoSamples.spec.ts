import { describe, it, expect } from 'vitest'
import { DEMO_SAMPLES, runDemoSample } from '../demoSamples'
import { recordedDemonstrationLabel } from '../providers'
import { buildSummaryText } from '../exports'

describe('demo samples: each result names its source', () => {
  it('labels every sample "Recorded demonstration: [provider/model]"', async () => {
    const labels = await Promise.all(
      DEMO_SAMPLES.map(async (sample) =>
        recordedDemonstrationLabel(await runDemoSample(sample.id)),
      ),
    )
    expect(labels).toEqual([
      'Recorded demonstration: GPT-6 Luna / gpt-6-luna',
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

  it('keeps the side damage on the side photo only', async () => {
    const [rear, side, clean] = await Promise.all(DEMO_SAMPLES.map((s) => runDemoSample(s.id)))
    expect(side?.damage?.photos).toEqual([{ photo: 'side-dented-grey.jpg', face: 'long-side' }])
    expect(side?.containerId).toBeNull()
    expect(rear?.damage).toBeNull()
    expect(clean?.damage).toBeNull()
  })
})
