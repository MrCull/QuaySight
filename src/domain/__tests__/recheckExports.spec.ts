import { describe, it, expect } from 'vitest'
import { runRecordedInspection } from '../recordedRun'
import { buildContainerIdReading } from '../containerId'
import { buildInspectionExport, buildRawResponsesExport, buildSummaryText } from '../exports'
import type { InspectionRecord, RecheckRecord } from '../inspection'

// Hand-written expectations: the re-check resolved positions 7 and 9 of APHU6586847 (check digit 7).
async function liveRecordWithRecheck(): Promise<InspectionRecord> {
  const base = await runRecordedInspection('luna', { delayMs: 0, id: 'live-luna-7' })
  const recheck: RecheckRecord = {
    id: 'live-luna-7-recheck',
    field: 'containerId',
    positions: [7, 9],
    provider: 'luna',
    model: 'gpt-6-luna',
    resolvedVersion: 'gpt-6-luna-20260922',
    outcome: 'resolved',
    resolvedPositions: [7, 9],
    observations: [
      { position: 7, value: '8', certainty: 'Likely' },
      { position: 9, value: '8', certainty: 'Confident' },
    ],
    reason: null,
  }
  return {
    ...base,
    source: 'live',
    model: 'gpt-6-luna',
    resolvedVersion: 'gpt-6-luna-20260922',
    containerId: buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Confident' }),
    rawResponses: [
      {
        passId: 'live-luna-7',
        provider: 'luna',
        model: 'gpt-6-luna',
        capturedFrom: 'provider',
        body: { answers: ['first'] },
      },
      {
        passId: 'live-luna-7-recheck',
        provider: 'luna',
        model: 'gpt-6-luna',
        capturedFrom: 'provider',
        body: { answers: ['recheck'] },
      },
    ],
    rechecks: [recheck],
  }
}

describe('re-check in the exports', () => {
  it('lists the re-check with its observations and outcome in the consolidated JSON', async () => {
    const json = buildInspectionExport(await liveRecordWithRecheck())
    expect(json.rechecks).toEqual([
      expect.objectContaining({
        id: 'live-luna-7-recheck',
        positions: [7, 9],
        provider: 'luna',
        model: 'gpt-6-luna',
        outcome: 'resolved',
        resolvedPositions: [7, 9],
        observations: [
          { position: 7, value: '8', certainty: 'Likely' },
          { position: 9, value: '8', certainty: 'Confident' },
        ],
      }),
    ])
  })

  it('has no re-check entries when none ran', async () => {
    const json = buildInspectionExport(
      await runRecordedInspection('luna', { delayMs: 0, id: 'run-luna-2' }),
    )
    expect(json.rechecks).toEqual([])
  })

  it('keeps the re-check raw response as a separate entry in the raw responses export', async () => {
    const raw = buildRawResponsesExport(await liveRecordWithRecheck())
    expect(raw.responses).toHaveLength(2)
    expect(raw.responses[1]).toMatchObject({
      passId: 'live-luna-7-recheck',
      capturedFrom: 'provider',
      body: { answers: ['recheck'] },
    })
    expect(raw.responses[0]).toMatchObject({ passId: 'live-luna-7', body: { answers: ['first'] } })
  })

  it('states the re-check outcome in the plain-text summary', async () => {
    const text = buildSummaryText(await liveRecordWithRecheck())
    expect(text).toMatch(/Re-check of container ID \(positions 7, 9\): resolved/)
  })
})
