import { describe, it, expect } from 'vitest'
import {
  OFFERED_OWNER_CODES,
  OWNER_CODES,
  OWNER_CODE_ENTRIES,
  OWNER_CODE_LICENCE,
  UNCONFIRMED_OWNER_CODES,
  isOnOwnerList,
  ownerCodeRank,
} from '../ownerCodes'
import { NONE_OF_THESE, ownerQuestion } from '../ownerPick'

describe('owner code list', () => {
  it('holds the merged list of about 560 distinct codes, every one ending in U', () => {
    expect(OWNER_CODES.length).toBeGreaterThanOrEqual(540)
    expect(OWNER_CODES.length).toBeLessThanOrEqual(580)
    expect(new Set(OWNER_CODES).size).toBe(OWNER_CODES.length)
    for (const code of OWNER_CODES) expect(code).toMatch(/^[A-Z]{3}U$/)
  })

  it('keeps the supplied ranking: MSCU first, MAEU second, CMAU third', () => {
    expect(ownerCodeRank('MSCU')).toBe(1)
    expect(ownerCodeRank('MAEU')).toBe(2)
    expect(ownerCodeRank('CMAU')).toBe(3)
    expect(OWNER_CODES.slice(0, 3)).toEqual(['MSCU', 'MAEU', 'CMAU'])
  })

  it('gives every code a distinct rank, a source and the licence record', () => {
    const ranks = OWNER_CODE_ENTRIES.map((entry) => entry.rank)
    expect(new Set(ranks).size).toBe(OWNER_CODE_ENTRIES.length)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    for (const entry of OWNER_CODE_ENTRIES) expect(entry.source.length).toBeGreaterThan(0)
    expect(OWNER_CODE_LICENCE).toMatchObject({ licence: 'MIT', author: 'Jonathan Law', year: 2023 })
  })

  it('includes JDLU, RWTU and COYU, and the lines and lessors the earlier tickets named', () => {
    for (const code of ['JDLU', 'RWTU', 'COYU', 'MSCU', 'HLXU', 'COSU', 'ONEU', 'TCNU', 'CAXU']) {
      expect(isOnOwnerList(code)).toBe(true)
    }
    expect(isOnOwnerList('ZZZU')).toBe(false)
  })

  it('leaves out codes the BIC register had no entry for, except ones marked unconfirmed', () => {
    for (const code of ['HJCU', 'HJSU', 'TCOU', 'TCQU', 'TSEU', 'BMKU', 'BPCU', 'CBBU', 'CBWU']) {
      expect(OWNER_CODES).not.toContain(code)
    }
    expect(Object.keys(UNCONFIRMED_OWNER_CODES).sort()).toEqual(['COSU', 'KKLU', 'MOLU'])
    for (const code of Object.keys(UNCONFIRMED_OWNER_CODES)) expect(OWNER_CODES).toContain(code)
  })
})

describe('the codes the whole-prefix question offers', () => {
  it('are the top 250 by rank plus JDLU and RWTU, so at most 252 with "none" fitting the 255 limit', () => {
    expect(OFFERED_OWNER_CODES).toHaveLength(252)
    expect(OFFERED_OWNER_CODES.slice(0, 250)).toEqual(OWNER_CODES.slice(0, 250))
    expect(OFFERED_OWNER_CODES).toContain('JDLU')
    expect(OFFERED_OWNER_CODES).toContain('RWTU')
    expect(ownerCodeRank('JDLU')).toBeGreaterThan(250)
  })

  it('reach the model as the choices of the question, with "none" first', () => {
    const question = ownerQuestion('the photo')
    expect(question.choices.map((choice) => choice.value)).toEqual([
      NONE_OF_THESE,
      ...OFFERED_OWNER_CODES,
    ])
    expect(question.choices.length).toBeLessThanOrEqual(255)
  })

  it('leave a code outside the top 250 still on the list', () => {
    const outside = OWNER_CODES[400]!
    expect(OFFERED_OWNER_CODES).not.toContain(outside)
    expect(isOnOwnerList(outside)).toBe(true)
  })
})
