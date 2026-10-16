import { describe, it, expect } from 'vitest'
import { decodeSizeCode } from '../isoSizeCode'

// ISO 6346 size/type code: length character, height/width character, then the two-character type code.
// Worked example from spec 4.3: 45G1 is a standard-width 40-foot High Cube general-purpose container.
describe('ISO size/type code decoding', () => {
  it('decodes 45G1 as a 40-foot High Cube general-purpose container, not a 45-foot one', () => {
    const decoded = decodeSizeCode('45G1', 'Confident')!
    expect(decoded.code).toBe('45G1')
    expect(decoded.certainty).toBe('Confident')
    expect(decoded.length.feet).toBe(40)
    expect(decoded.height.highCube).toBe(true)
    expect(decoded.height.label).toBe('9 ft 6 in High Cube')
    expect(decoded.width.label).toBe('8 ft standard width')
    expect(decoded.type.label).toBe('General purpose')
    expect(decoded.type.equipment).toBe('general')
    expect(decoded.summary).toBe('40 ft High Cube, general purpose')
  })

  it('decodes 22G1 as a 20-foot, 8 ft 6 in, general-purpose container', () => {
    const decoded = decodeSizeCode('22G1', 'Likely')!
    expect(decoded.length).toEqual({ feet: 20, label: '20 ft' })
    expect(decoded.height).toEqual({ highCube: false, label: '8 ft 6 in standard' })
    expect(decoded.width.label).toBe('8 ft standard width')
    expect(decoded.type).toEqual({ label: 'General purpose', equipment: 'general' })
    expect(decoded.certainty).toBe('Likely')
    expect(decoded.summary).toBe('20 ft standard height, general purpose')
  })

  it('decodes 42R1 as a 40-foot standard-height reefer', () => {
    const decoded = decodeSizeCode('42R1', 'Confident')!
    expect(decoded.length.feet).toBe(40)
    expect(decoded.height.highCube).toBe(false)
    expect(decoded.type).toEqual({ label: 'Reefer', equipment: 'reefer' })
    expect(decoded.summary).toBe('40 ft standard height, reefer')
  })

  it.each([
    ['L5G1', 45, '9 ft 6 in High Cube', 'General purpose', 'general'],
    ['22U1', 20, '8 ft 6 in standard', 'Open top', 'open-top'],
    ['22T6', 20, '8 ft 6 in standard', 'Tank', 'tank'],
    ['42P3', 40, '8 ft 6 in standard', 'Flat rack', 'flat-rack'],
    ['20P0', 20, '8 ft', 'Platform', 'platform'],
    ['45R1', 40, '9 ft 6 in High Cube', 'Reefer', 'reefer'],
    ['22V1', 20, '8 ft 6 in standard', 'Ventilated', 'ventilated'],
    ['22B0', 20, '8 ft 6 in standard', 'Dry bulk', 'bulk'],
    ['22H0', 20, '8 ft 6 in standard', 'Insulated', 'insulated'],
  ])('decodes %s', (code, feet, height, type, equipment) => {
    const decoded = decodeSizeCode(code, 'Confident')!
    expect(decoded.length.feet).toBe(feet)
    expect(decoded.height.label).toBe(height)
    expect(decoded.type).toEqual({ label: type, equipment })
  })

  it('says a pallet-wide code is wider than standard, and never infers width otherwise', () => {
    const decoded = decodeSizeCode('LEG1', 'Confident')!
    expect(decoded.width.label).toBe('Pallet-wide, over 8 ft')
    expect(decoded.height.highCube).toBe(true)
  })

  it('normalises spacing and case', () => {
    expect(decodeSizeCode(' 22 g1 ', 'Confident')!.code).toBe('22G1')
  })

  it('returns null for an empty or unknown code, never a guessed size', () => {
    expect(decodeSizeCode(null, 'Confident')).toBeNull()
    expect(decodeSizeCode('9Z9', 'Confident')).toBeNull()
    expect(decodeSizeCode('Z2G1', 'Confident')).toBeNull()
    expect(decodeSizeCode('2ZG1', 'Confident')).toBeNull()
    expect(decodeSizeCode('22Q1', 'Confident')).toBeNull()
  })
})
