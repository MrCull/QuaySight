import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { buildInspectionExport, buildSummaryText } from '../exports'
import {
  alsoPossibleLine,
  checkDigitLine,
  damageNotAssessedLine,
  facesLine,
  findingCountLine,
  findingLines,
  idLine,
  inspectionLine,
  notEstablishedLine,
  providerLine,
  recheckLine,
  sizeCodeLine,
} from '../exportWording'

// The summary's wording functions, each run against the recorded Luna sample, and then the sample's
// whole summary to show the lines still arrive in it.

const record = () => recordedInspection('luna', { delayMs: 0, id: 'run-luna-1' })

describe('export summary wording', () => {
  it('words the container ID and its check digit from the recorded reading', async () => {
    const reading = (await record()).containerId!
    expect(idLine(reading)).toBe(`Container ID (printed): ${reading.value} - ${reading.certainty}`)
    expect(checkDigitLine({ ...reading, calculatedCheckDigit: null })).toBe(
      `  Check digit: observed ${reading.observedCheckDigit}, not calculated (ID incomplete)`,
    )
    expect(checkDigitLine({ ...reading, calculatedCheckDigit: 7, checkDigitValid: false })).toBe(
      `  Check digit: observed ${reading.observedCheckDigit}, calculated 7, does not match`,
    )
    expect(alsoPossibleLine('ABCU 123456 0')).toBe('  Also possible: ABCU 123456 0')
  })

  it('words the provider, inspection, size code and re-check lines', async () => {
    const r = await record()
    expect(providerLine('Luna', r.model, r.resolvedVersion)).toBe(
      `Provider: Luna, model ${r.model}, resolved version ${r.resolvedVersion}`,
    )
    expect(inspectionLine('run-luna-1')).toBe('Inspection: run-luna-1')
    expect(sizeCodeLine('22G1', '20 ft general purpose', 'Likely')).toBe(
      'Size code (decoded): 22G1 - 20 ft general purpose - Likely',
    )
    expect(recheckLine({ positions: [3, 4], outcome: 'agreed', reason: 'call' } as never)).toBe(
      'Re-check of container ID (positions 3, 4): agreed (stopped at the per-inspection call limit)',
    )
  })

  it('words the damage lines from the recorded findings', async () => {
    const json = buildInspectionExport(await record())
    expect(findingCountLine(1)).toBe('Suspected damage: 1 finding')
    expect(findingCountLine(2)).toBe('Suspected damage: 2 findings')
    expect(damageNotAssessedLine(null)).toBe('Damage: not assessed.')
    expect(damageNotAssessedLine('Roof view.')).toBe(
      'Damage: not assessed for this view. Roof view.',
    )
    const finding = json.damage.findings[0]
    if (finding) {
      const [head, detail] = findingLines(finding)
      expect(head).toContain(`- ${finding.title} - ${finding.certainty}, `)
      expect(detail).toContain(`source pass: ${finding.sourcePass.passId}`)
    }
    expect(
      findingLines({ ...json.damage.findings[0]!, severity: 'not rated', photo: null })[1],
    ).toContain('Photo: not linked')
    expect(facesLine(json.damage.faces)).toMatch(/^Faces: Rear: .*; Roof: /)
    expect(notEstablishedLine('damage', 'Not assessed.')).toBe('- damage: Not assessed.')
  })

  it('still delivers those lines in the recorded sample summary', async () => {
    const r = await record()
    const summary = buildSummaryText(r)
    expect(summary).toContain(idLine(r.containerId!))
    expect(summary).toContain(inspectionLine(r.id))
  })
})
