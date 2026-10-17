import { describe, it, expect } from 'vitest'
import type { ChoiceQuestion, SharedAnswer } from '../questionSet'
import { REQUEST_LIMITS } from '../questionSet'
import { readWeights, weightQuestions, weightQuestionName } from '../weightQuestions'

// How the weights are asked (ticket #34): each printed figure digit by digit, by the place of the digit
// in the figure, in both unit systems, so each can check the other.

const choice = (value: string, probability = 0.97, other?: [string, number]): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: probability, ...(other ? { [other[0]]: other[1] } : {}) },
  confidence: probability,
})

type Place = 'units' | 'tens' | 'hundreds' | 'thousands' | 'ten_thousands' | 'tenths'

/** The answers for one figure as printed: its digits, then 'none' for the places above them. */
function figure(
  quantity: Parameters<typeof weightQuestionName>[0],
  unit: Parameters<typeof weightQuestionName>[1],
  printed: string,
  places: Place[],
  probability = 0.97,
): Record<string, SharedAnswer> {
  const digits = printed.replace(/[,.]/g, '').split('').reverse()
  const out: Record<string, SharedAnswer> = {}
  places.forEach((place, i) => {
    out[weightQuestionName(quantity, unit, place)] = choice(digits[i] ?? 'none', probability)
  })
  return out
}

const INTEGER: Place[] = ['units', 'tens', 'hundreds', 'thousands', 'ten_thousands']

/** The COYU door: MAX GROSS 30,480 KG 67,200 LB, TARE 2,180 KG 4,810 LB, NET 28,300 KG 62,390 LB, CU. CAP. 33.2 M3 1,173 CU.FT. */
function coyuAnswers(probability = 0.97): Record<string, SharedAnswer> {
  return {
    ...figure('maxGross', 'kg', '30480', INTEGER, probability),
    ...figure('maxGross', 'lb', '67200', INTEGER, probability),
    ...figure('tare', 'kg', '2180', INTEGER, probability),
    ...figure('tare', 'lb', '4810', INTEGER, probability),
    ...figure('payload', 'kg', '28300', INTEGER, probability),
    ...figure('payload', 'lb', '62390', INTEGER, probability),
    // 33.2: the tenths digit is read from the right, so the digits run 2, 3, 3.
    [weightQuestionName('capacity', 'm3', 'tenths')]: choice('2', probability),
    [weightQuestionName('capacity', 'm3', 'units')]: choice('3', probability),
    [weightQuestionName('capacity', 'm3', 'tens')]: choice('3', probability),
    ...figure('capacity', 'cuft', '1173', ['units', 'tens', 'hundreds', 'thousands'], probability),
  }
}

describe('the weight questions', () => {
  const all = weightQuestions(['maxGross', 'tare', 'payload', 'capacity'], { box: false })
  const choices = all.filter((q): q is ChoiceQuestion => q.type === 'choice')

  it('ask every figure in both units, one place at a time, within the provider limits', () => {
    const names = all.map((q) => q.name)
    expect(new Set(names).size).toBe(names.length)
    // 3 weights x 2 units x 5 places, then the capacity: 3 places of m3 and 4 of cu ft.
    expect(all).toHaveLength(37)
    expect(all.length).toBeLessThanOrEqual(REQUEST_LIMITS['openai-decisions'].maxQuestions)
    for (const q of choices)
      expect(q.choices.length).toBeLessThanOrEqual(REQUEST_LIMITS['openai-decisions'].maxChoices)
    expect(names).toContain('max_gross_kg_thousands')
    expect(names).toContain('tare_lb_units')
    expect(names).toContain('payload_kg_ten_thousands')
    expect(names).toContain('capacity_cuft_hundreds')
    expect(names).toContain('capacity_m3_tenths')
  })

  it('offer the ten digits, no digit at this place, unreadable and not visible', () => {
    const tens = choices.find((q) => q.name === 'tare_kg_tens')!
    expect(tens.choices.map((c) => c.value)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'none',
      'unreadable',
      'not_visible',
    ])
    // The units digit is always there.
    const units = choices.find((q) => q.name === 'tare_kg_units')!
    expect(units.choices.map((c) => c.value)).not.toContain('none')
  })

  it('name the row, the unit and the digit by its place in the figure, from the right-hand end', () => {
    const q = choices.find((x) => x.name === 'max_gross_kg_thousands')!
    expect(q.instructions).toMatch(/MAX\.? GROSS/i)
    expect(q.instructions).toMatch(/kg/i)
    expect(q.instructions).toMatch(/thousands digit/i)
    expect(q.instructions).toMatch(/fourth/i)
    expect(q.instructions).toMatch(/right-hand end/i)
    const lb = choices.find((x) => x.name === 'tare_lb_hundreds')!
    expect(lb.instructions).toMatch(/TARE/)
    expect(lb.instructions).toMatch(/lb/i)
    expect(lb.instructions).toMatch(/third/i)
  })

  it('tell the model to read the printed figure, not to work it out from another unit or row', () => {
    for (const q of choices) expect(q.instructions).toMatch(/do not work it out/i)
  })

  it('call the net weight NET or PAYLOAD, and never present a maximum as a loaded weight', () => {
    const q = choices.find((x) => x.name === 'payload_kg_units')!
    expect(q.instructions).toMatch(/NET/)
    expect(q.instructions).toMatch(/PAYLOAD/)
    for (const x of all)
      expect(x.instructions).not.toMatch(/loaded weight|cargo weight|actual weight/i)
  })

  it('ask only the quantities wanted', () => {
    const tare = weightQuestions(['tare'], { box: false })
    expect(tare).toHaveLength(10)
    expect(tare.every((q) => q.name.startsWith('tare_'))).toBe(true)
  })

  it('ask where the weight block is on box-capable models only', () => {
    const boxed = weightQuestions(['maxGross', 'tare', 'payload', 'capacity'], { box: true })
    expect(boxed[boxed.length - 1]).toMatchObject({ type: 'box', name: 'weights_box' })
    expect(all.some((q) => q.type === 'box')).toBe(false)
    // A second look is already on the crop: it does not ask for a box again.
    expect(weightQuestions(['tare'], { box: false }).some((q) => q.type === 'box')).toBe(false)
  })
})

describe('reading the weights back', () => {
  it('assembles each figure from its digits, in both units, with the capacity to a tenth', () => {
    const w = readWeights(coyuAnswers())
    expect(w.maxGross).toEqual({
      metric: { state: 'read', value: 30480, certainty: 'Confident' },
      imperial: { state: 'read', value: 67200, certainty: 'Confident' },
    })
    expect(w.tare?.metric.value).toBe(2180)
    expect(w.tare?.imperial.value).toBe(4810)
    expect(w.payload?.metric.value).toBe(28300)
    expect(w.payload?.imperial.value).toBe(62390)
    expect(w.capacity?.metric.value).toBe(33.2)
    expect(w.capacity?.imperial.value).toBe(1173)
  })

  it('gives a figure the certainty of its weakest digit, margin included', () => {
    const answers = coyuAnswers()
    answers[weightQuestionName('tare', 'kg', 'tens')] = choice('8', 0.62)
    answers[weightQuestionName('tare', 'lb', 'units')] = choice('0', 0.62, ['6', 0.55])
    const w = readWeights(answers)
    expect(w.tare?.metric.certainty).toBe('Likely')
    expect(w.tare?.imperial.certainty).toBe('Uncertain')
  })

  it('leaves a figure unread when a digit is unreadable, a tie or missing, never filling it in', () => {
    const answers = coyuAnswers()
    answers[weightQuestionName('tare', 'kg', 'tens')] = choice('unreadable', 0.9)
    answers[weightQuestionName('tare', 'lb', 'hundreds')] = choice('8', 0.4, ['3', 0.38]) // below Uncertain
    delete answers[weightQuestionName('maxGross', 'kg', 'units')]
    const w = readWeights(answers)
    expect(w.tare?.metric).toMatchObject({ state: 'unclear', value: null, certainty: "Can't tell" })
    // What every place said is kept, so the other unit and the arithmetic can settle the figure (weightInference.ts).
    expect(w.tare?.metric.dist?.[0]).toMatchObject({ '0': expect.any(Number) })
    expect(w.tare?.metric.dist?.[1]).toBeUndefined()
    expect(w.tare?.imperial.state).toBe('unclear')
    expect(w.maxGross?.metric).toMatchObject({
      state: 'unclear',
      value: null,
      certainty: "Can't tell",
    })
    expect(w.maxGross?.imperial.value).toBe(67200)
  })

  it('reads a figure whose units digit is not visible as not seen', () => {
    const answers = coyuAnswers()
    for (const place of INTEGER) {
      answers[weightQuestionName('payload', 'lb', place)] = choice('not_visible', 0.95)
    }
    const w = readWeights(answers)
    expect(w.payload?.imperial).toEqual({
      state: 'not-visible',
      value: null,
      certainty: 'Not seen',
    })
    expect(w.payload?.metric.value).toBe(28300)
  })

  it('treats a leading zero as no digit, and refuses a digit above a gap or an all-zero figure', () => {
    const answers = coyuAnswers()
    answers[weightQuestionName('tare', 'kg', 'ten_thousands')] = choice('0')
    expect(readWeights(answers).tare?.metric.value).toBe(2180)

    answers[weightQuestionName('tare', 'kg', 'hundreds')] = choice('none')
    // 2 above a gap: the thousands digit is there but the hundreds place says nothing.
    expect(readWeights(answers).tare?.metric.state).toBe('unclear')

    const zeros = coyuAnswers()
    for (const place of INTEGER) zeros[weightQuestionName('tare', 'kg', place)] = choice('0')
    expect(readWeights(zeros).tare?.metric.state).toBe('unclear')
  })

  it('reads a capacity with no tenths digit as a whole number of cubic metres', () => {
    const answers = coyuAnswers()
    answers[weightQuestionName('capacity', 'm3', 'tenths')] = choice('none')
    expect(readWeights(answers).capacity?.metric.value).toBe(33)
  })

  it('reads only the quantities it is told were asked', () => {
    const w = readWeights(coyuAnswers(), ['tare'])
    expect(Object.keys(w)).toEqual(['tare'])
  })

  it('leaves a reply with none of the weight answers unread', () => {
    const w = readWeights({})
    expect(w.maxGross?.metric).toEqual({ state: 'unclear', value: null, certainty: "Can't tell" })
    expect(w.capacity?.imperial.state).toBe('unclear')
  })
})
