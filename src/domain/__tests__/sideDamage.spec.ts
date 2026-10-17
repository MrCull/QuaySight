import { describe, it, expect } from 'vitest'
import { REQUEST_LIMITS, toWireRequest, type SharedAnswer } from '../questionSet'
import { SIDE_DAMAGE_SET, readSideDamage } from '../sideDamage'

const PHOTO = 'data:image/jpeg;base64,AAAA'

const ZONES = ['Z1T', 'Z1B', 'Z2T', 'Z2B', 'Z3T', 'Z3B', 'Z4T', 'Z4B', 'Z5T', 'Z5B']
const CODES = ['DT', 'BT', 'BW', 'HO', 'CK', 'CW', 'CO', 'CH', 'BR']

const predicate = (probability: number): SharedAnswer => ({ type: 'predicate', probability })
const choice = (value: string, p = 0.9): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: p },
  confidence: null,
})
/** A severity answer: probabilities over none, cosmetic, minor, moderate, major. */
const severity = (probabilities: number[]): SharedAnswer => {
  const level = probabilities.indexOf(Math.max(...probabilities))
  const labels = ['none', 'cosmetic', 'minor', 'moderate', 'major']
  return {
    type: 'score',
    level,
    label: labels[level]!,
    score: null,
    probabilities,
    confidence: null,
  }
}

/** A clean, clearly visible side: every zone none, every predicate low. */
function cleanSide(): Record<string, SharedAnswer> {
  const answers: Record<string, SharedAnswer> = {
    image_quality: choice('good'),
    side_panel_coverage: choice('full'),
    door_end_in_image: choice('not_identifiable'),
    any_visible_defect: predicate(0.05),
    potentially_significant_damage: predicate(0.03),
  }
  for (const zone of ZONES) {
    answers[`${zone}_visibility`] = choice('clear')
    answers[`${zone}_deformation_shape`] = choice('none')
    for (const code of CODES) answers[`${zone}_${code}`] = predicate(0.02)
    answers[`${zone}_severity`] = severity([0.95, 0.03, 0.01, 0.005, 0.005])
  }
  return answers
}

describe('the long-side damage set', () => {
  it('is the product owner’s v2 set: 132 questions, its wording generalised past 20 ft', () => {
    expect(SIDE_DAMAGE_SET.questions).toHaveLength(132)
    const text = SIDE_DAMAGE_SET.input
      .flatMap((m) => m.content)
      .map((p) => (p.type === 'input_text' ? p.text : ''))
      .join(' ')
    expect(text).not.toMatch(/20-foot/)
    expect(text).toMatch(/20 ft or 40 ft/)
  })

  it('fits one request on both wire formats, translated for OpenRouter', () => {
    expect(SIDE_DAMAGE_SET.questions.length).toBeLessThanOrEqual(
      REQUEST_LIMITS['openai-decisions'].maxQuestions,
    )
    const opts = { model: 'm', imageDataUrl: PHOTO }
    expect(toWireRequest('openai-decisions', SIDE_DAMAGE_SET, opts).questions).toHaveLength(132)
    const openRouter = toWireRequest('openrouter-decisions', SIDE_DAMAGE_SET, opts)
    expect(openRouter.questions.Z2B_DT).toMatchObject({ type: 'noul' })
    expect(openRouter.questions.Z2B_severity).toMatchObject({ type: 'score' })
  })
})

describe('reading the long-side answers', () => {
  it('says nothing is suspected on a clean, clearly visible side, and that every zone was seen', () => {
    const reading = readSideDamage(cleanSide())
    expect(reading.face).toBe('long-side')
    expect(reading.inspectable).toBe(true)
    expect(reading.findings).toEqual([])
    expect(reading.zones).toHaveLength(10)
    expect(reading.zones.every((z) => z.visibility === 'clear')).toBe(true)
    expect(reading).toMatchObject({
      imageQuality: 'good',
      coverage: 'full',
      doorEnd: null,
      significantProbability: 0.03,
    })
  })

  it('places a dent in the bottom-middle zones as panel findings with severity, certainty and visibility', () => {
    const answers = cleanSide()
    answers.Z2B_DT = predicate(0.92)
    answers.Z2B_BT = predicate(0.3)
    answers.Z2B_severity = severity([0.02, 0.03, 0.3, 0.6, 0.05])
    answers.Z2B_deformation_shape = choice('local_dent')
    answers.Z3B_DT = predicate(0.88)
    answers.Z3B_visibility = choice('partial')
    answers.Z3B_severity = severity([0.05, 0.05, 0.7, 0.15, 0.05])
    answers.potentially_significant_damage = predicate(0.8)

    const reading = readSideDamage(answers)

    expect(reading.findings).toHaveLength(2)
    const [z2b, z3b] = reading.findings
    expect(z2b).toMatchObject({
      face: 'long-side',
      component: 'panel',
      zone: { u0: 0.2, u1: 0.4, v0: 0.5, v1: 1 },
      visibility: 'clear',
      severity: 'moderate',
      certainty: 'Confident',
      title: 'Dent in the side sheet',
      severityProbabilities: [0.02, 0.03, 0.3, 0.6, 0.05],
    })
    expect(z2b!.types.map((t) => t.code)).toEqual(['DT', 'BT'])
    expect(z2b!.types[0]).toEqual({ code: 'DT', name: 'Dent', probability: 0.92 })
    expect(z2b!.location).toBe('Photo column 2 of 5 from the left, lower half of the side sheet')
    expect(z2b!.uncertainty).toMatch(/minor/)
    // Partly visible: one step less certain, and said so.
    expect(z3b).toMatchObject({
      zone: { u0: 0.4, u1: 0.6, v0: 0.5, v1: 1 },
      visibility: 'partial',
      severity: 'minor',
      certainty: 'Likely',
    })
    expect(z3b!.caveats.join(' ')).toMatch(/only part of this zone/i)
    expect(reading.significantProbability).toBe(0.8)
  })

  it('makes no finding of a zone whose severity is none, whatever its predicates say', () => {
    const answers = cleanSide()
    answers.Z4T_CO = predicate(0.7)
    expect(readSideDamage(answers).findings).toEqual([])
  })

  it('records a cosmetic zone as the lightest finding', () => {
    const answers = cleanSide()
    answers.Z1T_CO = predicate(0.65)
    answers.Z1T_severity = severity([0.2, 0.7, 0.05, 0.03, 0.02])
    const [finding] = readSideDamage(answers).findings
    expect(finding).toMatchObject({ severity: 'cosmetic', title: 'Surface wear on the side sheet' })
  })

  it('reports rust as surface wear at the lowest severity, listed after real findings', () => {
    const answers = cleanSide()
    answers.Z1T_CO = predicate(0.8)
    answers.Z1T_severity = severity([0.1, 0.1, 0.2, 0.5, 0.1])
    answers.Z3B_DT = predicate(0.8)
    answers.Z3B_severity = severity([0.05, 0.05, 0.8, 0.05, 0.05])
    const { findings } = readSideDamage(answers)
    expect(findings.map((f) => [f.id, f.surfaceWear === true, f.severity])).toEqual([
      [1, false, 'minor'],
      [2, true, 'cosmetic'],
    ])
  })

  it('shows an unseen zone as not visible and never makes it a finding', () => {
    const answers = cleanSide()
    answers.Z5T_visibility = choice('not_visible')
    answers.Z5T_severity = severity([0.1, 0.1, 0.6, 0.1, 0.1])
    const reading = readSideDamage(answers)
    expect(reading.findings).toEqual([])
    expect(reading.zones.find((z) => z.id === 'Z5T')).toMatchObject({
      visibility: 'not-visible',
      zone: { u0: 0.8, u1: 1, v0: 0, v1: 0.5 },
    })
  })

  it('keeps a zone the model did not answer as unread, not clear', () => {
    const answers = cleanSide()
    delete answers.Z1B_visibility
    expect(readSideDamage(answers).zones.find((z) => z.id === 'Z1B')?.visibility).toBeNull()
  })

  it('reports rails, corner posts and castings as component findings with no severity rating', () => {
    const answers = cleanSide()
    answers.bottom_rail_bent = predicate(0.75)
    answers.bottom_rail_corrosion = predicate(0.6)
    answers.bottom_rail_broken = predicate(0.1)
    answers.right_end_corner_post_damage = predicate(0.55)
    answers.corner_casting_damage = predicate(0.9)

    const findings = readSideDamage(answers).findings

    expect(findings.map((f) => [f.component, f.title])).toEqual([
      ['rail', 'Damage to the bottom side rail'],
      ['corner-post', 'Damage to the corner post at photo right'],
      ['casting', 'Damage to a corner casting'],
    ])
    const [rail, post, casting] = findings
    expect(rail!.types.map((t) => t.code)).toEqual(['BT', 'CO'])
    expect(rail).toMatchObject({ severity: null, visibility: null, certainty: 'Likely' })
    expect(rail!.zone).toMatchObject({ v1: 1 })
    expect(post!.zone).toMatchObject({ u1: 1 })
    expect(post!.certainty).toBe('Uncertain')
    expect(casting!.zone).toBeNull()
    expect(casting!.certainty).toBe('Confident')
    expect(findings.map((f) => f.id)).toEqual([1, 2, 3])
  })

  it('contributes nothing when its own coverage check says the side is not inspectable', () => {
    const answers = cleanSide()
    answers.side_panel_coverage = choice('not_inspectable')
    answers.Z2B_severity = severity([0.1, 0.1, 0.6, 0.1, 0.1])
    const reading = readSideDamage(answers)
    expect(reading.inspectable).toBe(false)
    expect(reading.coverage).toBe('not-inspectable')
  })

  it('names the door end only when the photo shows it directly', () => {
    const answers = cleanSide()
    answers.door_end_in_image = choice('image_right')
    expect(readSideDamage(answers).doorEnd).toBe('image-right')
  })

  it('reads an empty reply as nothing seen, never as clean', () => {
    const reading = readSideDamage({})
    expect(reading.findings).toEqual([])
    expect(reading.zones.every((z) => z.visibility === null)).toBe(true)
    expect(reading).toMatchObject({
      imageQuality: null,
      coverage: null,
      significantProbability: null,
    })
  })
})
