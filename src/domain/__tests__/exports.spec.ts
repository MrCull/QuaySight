import { describe, it, expect } from 'vitest'
import { runRecordedInspection } from '../recordedRun'
import { buildContainerIdReading } from '../containerId'
import {
  buildInspectionExport,
  buildRawResponsesExport,
  buildSummaryText,
  exportFilenames,
  EXPORT_NOTICE,
} from '../exports'
import type { InspectionRecord } from '../inspection'

async function lunaRecord(): Promise<InspectionRecord> {
  return runRecordedInspection('luna', { delayMs: 0, id: 'run-luna-1' })
}

async function jevRecord(): Promise<InspectionRecord> {
  return runRecordedInspection('jev', { delayMs: 0, id: 'run-jev-1' })
}

describe('consolidated inspection JSON', () => {
  it('carries schema version, provider, model, resolved version and the POC notice', async () => {
    const json = buildInspectionExport(await lunaRecord())
    expect(json.schemaVersion).toBe(1)
    expect(json.inspection).toMatchObject({
      id: 'run-luna-1',
      provider: 'luna',
      providerName: 'GPT-6 Luna',
      model: 'gpt-6-luna',
      resolvedVersion: 'gpt-6-luna',
      source: 'recorded',
      status: 'complete',
    })
    expect(json.notice).toBe(EXPORT_NOTICE)
    expect(json.notice).toMatch(/POC/)
    expect(json.notice).toMatch(/non-certified/)
  })

  it('keeps printed, derived and unresolved values in separate categories with provenance and certainty', async () => {
    const json = buildInspectionExport(await lunaRecord())
    const byField = Object.fromEntries(json.values.map((v) => [v.field, v]))

    expect(byField['containerId']).toMatchObject({
      category: 'printed',
      value: 'APHU6586847',
      provenance: 'printed',
      certainty: 'Confident',
    })
    expect(byField['containerId.observedCheckDigit']).toMatchObject({
      category: 'printed',
      value: 7,
    })
    expect(byField['containerId.calculatedCheckDigit']).toMatchObject({
      category: 'derived',
      value: 7,
      provenance: 'calculated',
    })
    expect(byField['sizeCode']).toMatchObject({
      category: 'derived',
      value: '45G1',
      provenance: 'decoded',
    })
    expect(byField['sizeCode.meaning']).toMatchObject({
      category: 'derived',
      value: '40 ft High Cube, general purpose',
    })
    expect(byField['maxGross']).toMatchObject({
      category: 'printed',
      value: 32500,
      unit: 'kg',
      provenance: 'printed',
    })
    expect(byField['tare']).toMatchObject({ category: 'printed', value: 3870, unit: 'kg' })
    expect(byField['payload']).toMatchObject({
      category: 'derived',
      value: 28630,
      unit: 'kg',
      provenance: 'calculated',
    })
    expect(json.unresolved).toEqual([])
    expect(json.candidates).toEqual([])
  })

  it('lists unread positions and absent fields as unresolved, never filled in', async () => {
    const record = await lunaRecord()
    const json = buildInspectionExport({
      ...record,
      containerId: {
        ...buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Uncertain' }),
        value: 'APH?6586847',
      },
      sizeCode: null,
      weights: null,
    })
    expect(json.unresolved.map((u) => u.field)).toEqual(
      expect.arrayContaining([
        'containerId.position[3]',
        'sizeCode',
        'maxGross',
        'tare',
        'payload',
      ]),
    )
    expect(json.values.find((v) => v.field === 'sizeCode')).toBeUndefined()
    const idValue = json.values.find((v) => v.field === 'containerId')
    expect(idValue?.value).toBe('APH?6586847')
    expect(json.unresolved.find((u) => u.field === 'containerId.position[3]')?.reason).toMatch(
      /not read/,
    )
  })

  it('lists plausible alternatives as candidates, separate from the printed reading', async () => {
    const record = await lunaRecord()
    const json = buildInspectionExport({
      ...record,
      containerId: {
        ...record.containerId!,
        alternatives: ['APH?6586847', 'APHU658684Z'],
      },
    })
    expect(json.candidates).toEqual([
      {
        field: 'containerId',
        category: 'candidate',
        provenance: 'candidate',
        value: 'APH?6586847',
      },
      {
        field: 'containerId',
        category: 'candidate',
        provenance: 'candidate',
        value: 'APHU658684Z',
      },
    ])
    expect(json.values.find((v) => v.field === 'containerId')?.value).toBe('APHU6586847')
  })

  it('links each suspected defect to its photo, region and source pass', async () => {
    const json = buildInspectionExport(await lunaRecord())
    expect(json.damage.findings).toHaveLength(1)
    const [finding] = json.damage.findings
    expect(finding).toMatchObject({
      findingId: 1,
      title: 'Dents in the side panel',
      face: 'long-side',
      severity: 'minor',
      certainty: 'Likely',
      photo: 'side-dented-grey.jpg',
      region: {
        location: 'Approximate area on the lower middle of the long side',
        zone: { u0: 0.27, u1: 0.7, v0: 0.62, v1: 0.78 },
      },
      sourcePass: { passId: 'run-luna-1', kind: 'recorded-run' },
    })
  })

  it('states which faces were not seen rather than implying they are clear', async () => {
    const json = buildInspectionExport(await lunaRecord())
    expect(json.damage.faces).toEqual(
      expect.arrayContaining([
        { face: 'rear', status: 'not-seen' },
        { face: 'front', status: 'not-seen' },
        { face: 'roof', status: 'not-seen' },
        { face: 'left', status: 'side-unknown' },
        { face: 'right', status: 'side-unknown' },
      ]),
    )
  })

  it('reports an absent damage assessment as not assessed', async () => {
    const json = buildInspectionExport(await jevRecord())
    expect(json.damage.findings).toEqual([])
    expect(json.damage.assessed).toBe(false)
    expect(json.unresolved.map((u) => u.field)).toEqual(
      expect.arrayContaining(['sizeCode', 'maxGross', 'tare', 'payload']),
    )
  })
})

describe('raw provider responses export', () => {
  it('returns each provider response with its pass, provider, model and origin', async () => {
    const raw = buildRawResponsesExport(await lunaRecord())
    expect(raw.schemaVersion).toBe(1)
    expect(raw.notice).toMatch(/non-certified/)
    expect(raw.inspectionId).toBe('run-luna-1')
    expect(raw.responses).toHaveLength(1)
    const [response] = raw.responses
    expect(response).toMatchObject({
      passId: 'run-luna-1',
      provider: 'luna',
      model: 'gpt-6-luna',
      capturedFrom: 'recorded-fixture',
    })
    expect(response?.body).toMatchObject({ containerNumber: 'APHU658684', observedCheckDigit: 7 })
  })
})

describe('plain-text summary', () => {
  it('is labelled POC and non-certified and names the recorded run', async () => {
    const text = buildSummaryText(await lunaRecord())
    expect(text.split('\n')[0]).toBe('Quay Sight - POC, non-certified')
    expect(text).toContain('Recorded demonstration: GPT-6 Luna / gpt-6-luna')
    expect(text).toContain('Container ID (printed): APHU6586847 - Confident')
    expect(text).toContain('Max gross (printed): 32,500 kg')
    expect(text).toContain('Payload (calculated): 28,630 kg')
    expect(text).toContain('Dents in the side panel - Likely, minor')
    expect(text).toContain('side-dented-grey.jpg')
    expect(text).toContain('run-luna-1')
  })

  it('never uses the forbidden status words', async () => {
    for (const record of [await lunaRecord(), await jevRecord()]) {
      const text = buildSummaryText(record).toLowerCase()
      expect(text).not.toMatch(/supported|verified|\bsafe\b/)
    }
  })
})

describe('export filenames', () => {
  it('derives three distinct filenames from the inspection id', async () => {
    const names = exportFilenames(await lunaRecord())
    expect(names).toEqual({
      json: 'quay-sight-run-luna-1-inspection.json',
      raw: 'quay-sight-run-luna-1-raw-responses.json',
      summary: 'quay-sight-run-luna-1-summary.txt',
    })
  })
})

describe('no API key in any export', () => {
  // Key-shaped text: OpenAI-style "sk-" secrets, bearer tokens, key/auth headers, and e-mail addresses.
  const keyPatterns = [
    /sk-[A-Za-z0-9_-]{6,}/,
    /bearer\s/i,
    /api[-_ ]?key/i,
    /authorization/i,
    /x-api-key/i,
    /[\w.+-]+@[\w-]+\.[\w.]+/,
  ]

  it('builds every export for both providers and finds no key-like text', async () => {
    for (const record of [await lunaRecord(), await jevRecord()]) {
      const texts = [
        JSON.stringify(buildInspectionExport(record)),
        JSON.stringify(buildRawResponsesExport(record)),
        buildSummaryText(record),
      ]
      for (const text of texts) {
        for (const pattern of keyPatterns) {
          expect(text, `pattern ${pattern} in export`).not.toMatch(pattern)
        }
      }
    }
  })

  it('takes only the inspection record as input, so no key can be passed in', () => {
    expect(buildInspectionExport.length).toBe(1)
    expect(buildRawResponsesExport.length).toBe(1)
    expect(buildSummaryText.length).toBe(1)
  })
})
