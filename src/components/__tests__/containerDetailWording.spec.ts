import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { sizeGroup, weightGroup } from '../containerDetailRows'
import {
  absentCodeText,
  capacityEvidence,
  dgSeenCaveat,
  dgSeenText,
  inheritedDoubtText,
  joinNotes,
  sizeCodeNote,
  unitEvidence,
  yesNoText,
} from '../containerDetailWording'

// The panel's wording functions on their own, with the recorded Luna sample's weight and size code, and
// then through the rows that carry them.

describe('container detail wording', () => {
  it('words the size code note and the code row that was not read', () => {
    expect(sizeCodeNote('20 ft general purpose', null)).toBe('20 ft general purpose')
    expect(sizeCodeNote('20 ft general purpose', '22G0')).toBe(
      '20 ft general purpose Also possible: 22G0.',
    )
    expect(absentCodeText('other')).toBe('Printed, but not one of the common codes')
    expect(absentCodeText('unreadable')).toBe('Printed, but not clear enough to read')
    expect(absentCodeText('not-visible')).toBe('Not visible in this photo')
    expect(absentCodeText('unclear')).toBe('Not clear from this photo')
  })

  it('words what the units say about the recorded sample weight', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const tare = record.weights!.tare!
    expect(unitEvidence({ ...tare, units: 'agree' }, 'metric', false)).toBe('kg and lb agree.')
    expect(unitEvidence({ ...tare, units: 'single' as never }, 'imperial', true)).toBe(
      'Converted from kg (1 kg = 2.20462 lb): the lb figure was not read.',
    )
    expect(unitEvidence({ ...tare, units: 'single' as never }, 'metric', false)).toBeNull()
    const row = weightGroup(record).rows.find((r) => r.label === 'TARE')!
    expect(row.value).toContain('kg')
  })

  it('words capacity evidence, shared doubt, markings and yes/no', () => {
    const capacity = { valueM3: 33.1, valueCuFt: 1169, units: 'single' } as never
    expect(capacityEvidence(capacity, true, true)).toBe(
      'Converted from cu ft (1 m³ = 35.3147 cu ft): the m³ figure was not read.',
    )
    expect(inheritedDoubtText([])).toBeNull()
    expect(inheritedDoubtText(['tare'])).toBe(
      'Uncertain because tare is: its kg and lb readings disagree.',
    )
    expect(inheritedDoubtText(['maximum gross', 'tare'])).toBe(
      'Uncertain because maximum gross and tare are: their kg and lb readings disagree.',
    )
    expect(dgSeenText(3, 'flammable liquids')).toBe(
      'DG placard, class 3 (flammable liquids) visible',
    )
    expect(dgSeenText(null, null)).toBe('DG placard visible, class not readable')
    expect(dgSeenCaveat('Flame')).toBe('Symbol: Flame. Cargo status unknown without a declaration')
    expect(yesNoText('yes')).toBe('Yes')
    expect(joinNotes('a', null, 'b')).toBe('a b')
    expect(joinNotes(null)).toBeNull()
  })

  it('still reaches the recorded sample size group', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const code = sizeGroup(record).rows[0]!
    expect(code.label).toBe('ISO CODE')
    expect(code.note).toBe(sizeCodeNote(record.sizeCode!.summary, undefined))
  })
})
