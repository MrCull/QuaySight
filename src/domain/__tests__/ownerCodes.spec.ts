import { describe, it, expect } from 'vitest'
import { OWNER_CODES } from '../ownerCodes'

describe('owner code list', () => {
  it('holds about 200 distinct four-letter codes, every one ending in U', () => {
    expect(OWNER_CODES.length).toBeGreaterThanOrEqual(190)
    expect(OWNER_CODES.length).toBeLessThanOrEqual(255)
    expect(new Set(OWNER_CODES).size).toBe(OWNER_CODES.length)
    for (const code of OWNER_CODES) expect(code).toMatch(/^[A-Z]{3}U$/)
  })

  it('includes the lines and lessors the ticket names', () => {
    for (const code of [
      'MSCU',
      'MAEU',
      'CMAU',
      'HLXU',
      'COSU',
      'EGHU',
      'ONEU',
      'TCNU',
      'TGHU',
      'CAXU',
    ]) {
      expect(OWNER_CODES).toContain(code)
    }
  })
})
