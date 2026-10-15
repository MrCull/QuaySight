import { describe, it, expect } from 'vitest'
import { parseManifest, MANIFEST_LIMIT } from '../manifest'

describe('parseManifest', () => {
  it('splits one ID per line', () => {
    expect(parseManifest('QSIU3074288\nMSCU4417305\nCAIU5527380').ids).toEqual([
      'QSIU3074288',
      'MSCU4417305',
      'CAIU5527380',
    ])
  })

  it('splits CSV, semicolons, tabs and spaces alike, and handles CRLF', () => {
    const text = 'AAAU1111111,BBBU2222222;CCCU3333333\tDDDU4444444 EEEU5555555\r\nFFFU6666666'
    expect(parseManifest(text).ids).toEqual([
      'AAAU1111111',
      'BBBU2222222',
      'CCCU3333333',
      'DDDU4444444',
      'EEEU5555555',
      'FFFU6666666',
    ])
  })

  it('treats a space inside an ID as a separator, so each part is an entry', () => {
    expect(parseManifest('QSIU 307428 8').ids).toEqual(['QSIU', '307428', '8'])
  })

  it('ignores case when counting duplicates, keeping the first spelling', () => {
    const result = parseManifest('APHU658684, aphu658684\nAPHU658684')
    expect(result.ids).toEqual(['APHU658684'])
    expect(result.duplicates).toBe(2)
  })

  it('returns nothing for empty or separator-only text', () => {
    expect(parseManifest('')).toEqual({ ids: [], duplicates: 0 })
    expect(parseManifest(' ,;\n\t ')).toEqual({ ids: [], duplicates: 0 })
  })

  it('does not validate entries: no ISO or check-digit filtering', () => {
    expect(parseManifest('NOTANID').ids).toEqual(['NOTANID'])
  })

  it('sets the paste limit at 500', () => {
    expect(MANIFEST_LIMIT).toBe(500)
  })
})
