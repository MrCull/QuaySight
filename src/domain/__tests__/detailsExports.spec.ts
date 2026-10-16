import { describe, it, expect } from 'vitest'
import { liveDetailsRecord } from '../../__tests__/liveDetails'
import { buildInspectionExport, buildSummaryText } from '../exports'

// The container details a live survey read, in the JSON and summary exports (ticket #32): each value
// with its source and certainty, what was not established, and any conflict.
describe('container details in the exports', () => {
  it('exports the printed code, what it decodes to, each check and each marking with its source', async () => {
    const json = buildInspectionExport(await liveDetailsRecord())
    const byField = Object.fromEntries(json.values.map((v) => [v.field, v]))
    expect(byField['sizeCode']).toMatchObject({
      category: 'printed',
      value: '22G1',
      provenance: 'printed',
      certainty: 'Confident',
    })
    expect(byField['sizeCode.length']).toMatchObject({
      category: 'derived',
      value: '20 ft',
      provenance: 'decoded',
    })
    expect(byField['sizeCode.height']).toMatchObject({ value: '8 ft 6 in standard' })
    expect(byField['sizeCode.type']).toMatchObject({ value: 'General purpose' })
    expect(byField['equipment.reefer']).toMatchObject({
      category: 'printed',
      value: 'no',
      provenance: 'observed',
      certainty: 'Confident',
    })
    expect(byField['markings.overwidth']).toMatchObject({
      value: 'not visible',
      certainty: 'Not seen',
    })
    expect(byField['dgPlacard']).toMatchObject({
      value: 'no DG placard visible',
      uncertainty: 'Not evidence that the cargo is non-hazardous.',
    })
  })

  it('lists what could not be established and any conflict with the code', async () => {
    const record = await liveDetailsRecord()
    record.details!.markings.fumigation = {
      answer: null,
      certainty: "Can't tell",
      source: 'observed',
      conflict: null,
    }
    record.details!.equipment.reefer = {
      answer: 'yes',
      certainty: 'Uncertain',
      source: 'observed',
      conflict: 'The photo was read as a reefer, but the size/type code 22G1 is general purpose.',
    }
    const json = buildInspectionExport(record)
    expect(json.unresolved).toContainEqual(
      expect.objectContaining({ field: 'markings.fumigation' }),
    )
    expect(json.conflicts).toContain(
      'The photo was read as a reefer, but the size/type code 22G1 is general purpose.',
    )
  })

  it('names the details in the summary, with the placard caveat', async () => {
    const text = buildSummaryText(await liveDetailsRecord())
    expect(text).toContain('Size/type code (printed): 22G1 - Confident')
    expect(text).toContain('  Decoded: 20 ft standard height, general purpose')
    expect(text).toContain('Equipment: reefer no, open top no, tank no, flat rack no')
    expect(text).toContain(
      'DG placard: no DG placard visible (not evidence that the cargo is non-hazardous)',
    )
    expect(text).toContain('Markings seen: none')
    expect(text).not.toMatch(/\bnon-hazardous cargo\b|cargo is non-hazardous\./i)
  })
})
