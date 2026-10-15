import { describe, it, expect } from 'vitest'
import { decodeSizeCode } from '../isoSizeCode'

// ISO 6346 size/type code: length digit, height/width digit, type letters.
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
    expect(decoded.summary).toBe('40 ft High Cube, general purpose')
  })

  it('decodes 22G1 as a 20-foot standard-height container', () => {
    const decoded = decodeSizeCode('22G1', 'Confident')!
    expect(decoded.length.feet).toBe(20)
    expect(decoded.height.highCube).toBe(false)
    expect(decoded.summary).toBe('20 ft standard height, general purpose')
  })

  it('returns null for an empty or unknown code, never a guessed size', () => {
    expect(decodeSizeCode(null, 'Confident')).toBeNull()
    expect(decodeSizeCode('9Z9', 'Confident')).toBeNull()
  })
})
