import { describe, it, expect } from 'vitest'
import type { CertaintyLabel } from '../inspection'
import type { ChoiceReading } from '../idQuestions'
import { combineIdReadings } from '../cropRead'
import type { SealReading } from '../sealFamily'
import { combineSealReads } from '../sealZoom'

function seal(text: string, certainty: CertaintyLabel = 'Likely'): SealReading {
  const characters = [...text].map((c) =>
    c === '?' ? { value: null, certainty: "Can't tell" as CertaintyLabel } : { value: c, certainty },
  )
  const unread = characters.some((c) => c.value === null)
  return {
    visible: true,
    characters,
    value: text,
    certainty: unread ? 'Uncertain' : certainty,
  }
}

describe('the zoomed seal read joining the whole-photo one', () => {
  it('fills the characters the whole photo left unread', () => {
    const out = combineSealReads(seal('0????2'), seal('015462'))
    expect(out?.value).toBe('015462')
  })

  it('raises a character both reads give by one step', () => {
    const out = combineSealReads(seal('0154620'), seal('0154620'))
    expect(out?.value).toBe('0154620')
    expect(out?.certainty).toBe('Confident')
  })

  it('takes the more certain character where they disagree, at no better than Uncertain', () => {
    const out = combineSealReads(seal('0154620', 'Confident'), seal('0154680', 'Uncertain'))
    expect(out?.value).toBe('0154620')
    expect(out?.characters[5]?.certainty).toBe('Uncertain')
  })

  it('takes the zoomed read when the whole photo saw no seal number', () => {
    const none: SealReading = { visible: false, characters: [], value: '', certainty: 'Not seen' }
    expect(combineSealReads(none, seal('0154620'))?.value).toBe('0154620')
    expect(combineSealReads(undefined, seal('0154620'))?.value).toBe('0154620')
  })

  it('changes nothing when the zoomed read finds no seal number', () => {
    const full = seal('0154620')
    const none: SealReading = { visible: false, characters: [], value: '', certainty: 'Not seen' }
    expect(combineSealReads(full, none)).toBe(full)
    expect(combineSealReads(full, null)).toBe(full)
  })

  it('keeps the reading with fewer unread places when they count the number differently', () => {
    expect(combineSealReads(seal('01?6'), seal('0154620'))?.value).toBe('0154620')
    expect(combineSealReads(seal('0154620'), seal('01?6'))?.value).toBe('0154620')
  })
})

const read = (value: string, certainty: CertaintyLabel, p: number): ChoiceReading => ({
  value,
  certainty,
  runnerUp: null,
  probability: p,
})

describe('the zoomed ID read joining the whole-photo one', () => {
  const unread: ChoiceReading = { value: null, certainty: "Can't tell", runnerUp: null }

  it('fill-only: fills an unread character, corroborates, and never overrules a whole-photo one', () => {
    const full = [read('C', 'Confident', 0.99), unread, read('1', 'Likely', 0.7)]
    const zoom = [read('C', 'Confident', 0.99), read('O', 'Likely', 0.8), read('7', 'Confident', 0.95)]
    const out = combineIdReadings(full, zoom, 'fill-only')
    expect(out.readings.map((r) => r.value)).toEqual(['C', 'O', '1'])
    expect(out.readings[2]?.certainty).toBe('Likely')
    expect(out.disagreements.map((d) => [d.position, d.kept])).toEqual([[3, 'full']])
    expect(out.corroborated).toBe(false)
  })

  it('weigh: the more confident character wins, as before', () => {
    const full = [read('1', 'Likely', 0.7)]
    const zoom = [read('7', 'Confident', 0.95)]
    expect(combineIdReadings(full, zoom).readings[0]?.value).toBe('7')
  })
})
