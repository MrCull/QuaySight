import { describe, it, expect } from 'vitest'
import { OWNER_CODES, UNCONFIRMED_OWNER_CODES } from '../ownerCodes'

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

  it('includes COYU and the other real owners the register showed were missing', () => {
    for (const code of ['COYU', 'SITU', 'TSTU', 'WHSU', 'FFAU', 'GAEU', 'GCXU', 'SKYU']) {
      expect(OWNER_CODES).toContain(code)
    }
  })

  it('leaves out codes the BIC register had no entry for, except ones marked unconfirmed', () => {
    for (const code of [
      'HJCU',
      'HJSU',
      'TCOU',
      'TCQU',
      'TSEU',
      'BMKU',
      'BPCU',
      'CBBU',
      'CBWU',
      'SBLU',
      'SNKU',
    ]) {
      expect(OWNER_CODES).not.toContain(code)
    }
    expect(Object.keys(UNCONFIRMED_OWNER_CODES).sort()).toEqual(['COSU', 'KKLU', 'MOLU'])
    for (const [code, reason] of Object.entries(UNCONFIRMED_OWNER_CODES)) {
      expect(OWNER_CODES).toContain(code)
      expect(reason.length).toBeGreaterThan(0)
    }
  })
})
