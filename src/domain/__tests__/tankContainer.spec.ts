import { describe, expect, it } from 'vitest'
import type { InspectionRecord } from '../inspection'
import { decodeSizeCode } from '../isoSizeCode'
import { isTankContainer } from '../tankContainer'

const check = (answer: 'yes' | 'no' | null, certainty: 'Confident' | 'Uncertain' = 'Confident') =>
  ({ answer, certainty, source: 'observed', conflict: null }) as const

function record(code: string | null, tank?: ReturnType<typeof check>, certainty = 'Confident') {
  return {
    sizeCode: decodeSizeCode(code, certainty as never),
    details: tank
      ? { equipment: { reefer: check('no'), openTop: check('no'), tank, flatRack: check('no') } }
      : undefined,
  } as unknown as InspectionRecord
}

describe('isTankContainer', () => {
  it('is a tank when a sure code decodes to one, whatever the check says', () => {
    expect(isTankContainer(record('22T6'))).toBe(true)
    expect(isTankContainer(record('22T6', check('no')))).toBe(true)
    expect(isTankContainer(record('22G1', check('yes')))).toBe(false)
  })

  it('falls back to a sure tank check when the code is missing or in doubt', () => {
    expect(isTankContainer(record(null, check('yes')))).toBe(true)
    expect(isTankContainer(record('22T6', check('no'), 'Uncertain'))).toBe(false)
    expect(isTankContainer(record(null, check('yes', 'Uncertain')))).toBe(false)
    expect(isTankContainer(null)).toBe(false)
  })
})
