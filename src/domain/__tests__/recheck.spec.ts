import { describe, it, expect } from 'vitest'
import { mergeRecheck, unresolvedPositions, recheckOutcome } from '../recheck'
import { assembleLunaReading, buildLunaRequest, type ChoiceReading } from '../luna'

// Expected values are hand-written: APHU6586847 is the spec's worked example (check digit 7 is valid).

const read = (
  value: string,
  certainty: ChoiceReading['certainty'] = 'Confident',
): ChoiceReading => ({
  value,
  certainty,
  runnerUp: null,
})
const unread = (): ChoiceReading => ({ value: null, certainty: "Can't tell", runnerUp: null })

// First pass: positions 6 and 7 unread (the ID APHU65?8?47 is not fully legible).
function firstPass(): ChoiceReading[] {
  const chars = ['A', 'P', 'H', 'U', '6', '5', null, '6', null, '4', '7']
  return chars.map((c) => (c === null ? unread() : read(c)))
}

describe('unresolvedPositions', () => {
  it('returns the 1-based positions the first pass could not read', () => {
    expect(unresolvedPositions(firstPass())).toEqual([7, 9])
  })

  it('returns nothing when every position was read', () => {
    const full = 'APHU6586847'.split('').map((c) => read(c))
    expect(unresolvedPositions(full)).toEqual([])
  })
})

describe('buildLunaRequest with positions', () => {
  it('asks only the requested positions, one question each', () => {
    const body = buildLunaRequest('data:image/jpeg;base64,AAAA', [7, 9])
    expect(body.questions.map((q) => q.name)).toEqual(['id_char_07', 'id_char_09'])
  })

  it('still asks every position (and the face) when no subset is given', () => {
    const { questions } = buildLunaRequest('data:image/jpeg;base64,AAAA')
    expect(questions.filter((q) => q.name.startsWith('id_char_'))).toHaveLength(11)
  })

  it('asks only the positions, never the face, on a re-check', () => {
    const { questions } = buildLunaRequest('data:image/jpeg;base64,AAAA', [3, 7])
    expect(questions.map((q) => q.name)).toEqual(['id_char_03', 'id_char_07'])
  })
})

describe('mergeRecheck', () => {
  it('fills only the unread positions from the re-check and keeps its certainty', () => {
    const again = [
      unread(),
      unread(),
      unread(),
      unread(),
      unread(),
      unread(),
      read('5', 'Likely'),
      unread(),
      read('8', 'Confident'),
      unread(),
      unread(),
    ]
    const merged = mergeRecheck(firstPass(), again, [7, 9])
    expect(merged.readings.map((r) => r.value).join('')).toBe('APHU6556847')
    expect(merged.readings[6]?.certainty).toBe('Likely')
    expect(merged.resolved).toEqual([7, 9])
  })

  it('never overwrites a character the first pass read, even when the re-check disagrees', () => {
    const again = [read('Z'), ...Array.from({ length: 10 }, () => unread())]
    const merged = mergeRecheck(firstPass(), again, [7, 9])
    expect(merged.readings[0]?.value).toBe('A')
    expect(merged.readings[0]?.certainty).toBe('Confident')
  })

  it('leaves a position unread when the re-check cannot read it', () => {
    const again = Array.from({ length: 11 }, () => unread())
    const merged = mergeRecheck(firstPass(), again, [7, 9])
    expect(merged.readings[6]?.value).toBeNull()
    expect(merged.resolved).toEqual([])
  })

  it('a fully read ID after the re-check is assembled with its check digit verified', () => {
    const again = Array.from({ length: 11 }, () => unread())
    again[6] = read('8')
    again[8] = read('8')
    const merged = mergeRecheck(firstPass(), again, [7, 9])
    const reading = assembleLunaReading(merged.readings)
    expect(reading.value).toBe('APHU6586847')
    expect(reading.checkDigitValid).toBe(true)
    expect(reading.provenance).toBe('printed')
  })
})

describe('recheckOutcome', () => {
  it('is resolved when every re-asked position was read', () => {
    expect(recheckOutcome([7, 9], [7, 9])).toBe('resolved')
  })

  it('is partly-resolved when some re-asked positions were read', () => {
    expect(recheckOutcome([7, 9], [9])).toBe('partly-resolved')
  })

  it('is unchanged when no re-asked position was read', () => {
    expect(recheckOutcome([7, 9], [])).toBe('unchanged')
  })
})
