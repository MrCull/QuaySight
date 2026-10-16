import { describe, it, expect } from 'vitest'
import { REQUEST_LIMITS, toWireRequest, type SharedAnswer } from '../questionSet'
import { assessDamage } from '../damageSets'
import { readSideDamage } from '../sideDamage'
import { DOOR_DAMAGE_SET, readDoorDamage } from '../doorDamage'

const PHOTO = 'data:image/jpeg;base64,AAAA'

const ZONES = ['D1T', 'D1M', 'D1B', 'D2T', 'D2M', 'D2B']
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

/** A clean, clearly visible door end: every region none, every predicate low. */
function cleanDoors(): Record<string, SharedAnswer> {
  const answers: Record<string, SharedAnswer> = {
    image_quality: choice('good'),
    door_end_coverage: choice('full'),
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

describe('the door-end damage set', () => {
  it('has the side set’s rubric: six regions with visibility, nine CEDEX types and five levels', () => {
    const names = DOOR_DAMAGE_SET.questions.map((q) => q.name)
    for (const zone of ZONES) {
      expect(names).toContain(`${zone}_visibility`)
      expect(names).toContain(`${zone}_severity`)
      for (const code of CODES) expect(names).toContain(`${zone}_${code}`)
    }
    const severityQuestion = DOOR_DAMAGE_SET.questions.find((q) => q.name === 'D1T_severity')
    expect(severityQuestion).toMatchObject({ type: 'score' })
    expect(
      severityQuestion?.type === 'score' && severityQuestion.levels.map((l) => l.label),
    ).toEqual(['none', 'cosmetic', 'minor', 'moderate', 'major'])
    const text = DOOR_DAMAGE_SET.input
      .flatMap((m) => m.content)
      .map((p) => (p.type === 'input_text' ? p.text : ''))
      .join(' ')
    expect(text).toMatch(/ISO 9897 CEDEX/)
    expect(text).toMatch(/door end/)
    // Not the side set's grid wording.
    expect(text).not.toMatch(/side sheet|Z1 to Z5/i)
  })

  it('fits OpenAI’s 200-question limit, and translates for OpenRouter', () => {
    expect(DOOR_DAMAGE_SET.questions.length).toBeLessThanOrEqual(
      REQUEST_LIMITS['openai-decisions'].maxQuestions,
    )
    const opts = { model: 'm', imageDataUrl: PHOTO }
    expect(toWireRequest('openai-decisions', DOOR_DAMAGE_SET, opts).questions).toHaveLength(
      DOOR_DAMAGE_SET.questions.length,
    )
    const openRouter = toWireRequest('openrouter-decisions', DOOR_DAMAGE_SET, opts)
    expect(openRouter.questions.D2M_DT).toMatchObject({ type: 'noul' })
    expect(openRouter.questions.D2M_severity).toMatchObject({ type: 'score' })
    expect(openRouter.questions.left_leaf_locking_bar_bent).toMatchObject({ type: 'noul' })
  })
})

describe('reading the door-end answers', () => {
  it('suspects nothing on clean doors, and says every region was seen', () => {
    const reading = readDoorDamage(cleanDoors())
    expect(reading.face).toBe('rear-doors')
    expect(reading.inspectable).toBe(true)
    expect(reading.findings).toEqual([])
    expect(reading.zones).toHaveLength(6)
    expect(reading.zones.every((z) => z.visibility === 'clear' && z.face === 'rear')).toBe(true)
    expect(reading).toMatchObject({
      imageQuality: 'good',
      coverage: 'full',
      doorEnd: null,
      significantProbability: 0.03,
    })
  })

  it('places regions as two leaves by three bands inside the corner posts, header and sill', () => {
    const zones = readDoorDamage(cleanDoors()).zones
    const byId = Object.fromEntries(zones.map((z) => [z.id, z]))
    expect(byId.D1T!.zone).toMatchObject({ u0: 0.05, u1: 0.5 })
    expect(byId.D2B!.zone).toMatchObject({ u0: 0.5, u1: 0.95 })
    expect(byId.D1T!.zone.v0).toBeCloseTo(0.06)
    expect(byId.D1B!.zone.v1).toBeCloseTo(0.94)
    expect(byId.D1M!.zone.v0).toBeCloseTo(byId.D1T!.zone.v1)
    expect(byId.D1M!.label).toBe('photo-left door leaf, middle third')
    expect(byId.D2T!.label).toBe('photo-right door leaf, top third')
  })

  it('places a dent in the photo-right leaf’s lower third as a panel finding in plain words', () => {
    const answers = cleanDoors()
    answers.D2B_DT = predicate(0.9)
    answers.D2B_BT = predicate(0.25)
    answers.D2B_deformation_shape = choice('local_dent')
    answers.D2B_severity = severity([0.02, 0.03, 0.3, 0.6, 0.05])
    answers.potentially_significant_damage = predicate(0.7)

    const reading = readDoorDamage(answers)

    expect(reading.findings).toHaveLength(1)
    const [dent] = reading.findings
    expect(dent).toMatchObject({
      id: 1,
      face: 'rear',
      component: 'panel',
      visibility: 'clear',
      severity: 'moderate',
      certainty: 'Confident',
      title: 'Dent in the door panel',
      location: 'Photo-right door leaf, bottom third',
    })
    expect(dent!.zone).toMatchObject({ u0: 0.5, u1: 0.95 })
    expect(dent!.types.map((t) => t.code)).toEqual(['DT', 'BT'])
    expect(dent!.description).toMatch(/local dent/)
    expect(dent!.caveats.join(' ')).toMatch(/Approximate area: photo-right door leaf, bottom third/)
    // Never a CEDEX location code: only damage-type codes are named.
    expect(JSON.stringify(dent)).not.toMatch(/\bD2B\b/)
    expect(reading.significantProbability).toBe(0.7)
  })

  it('makes no finding where severity is none, and none where a region was not seen', () => {
    const answers = cleanDoors()
    answers.D1M_CO = predicate(0.8)
    answers.D2T_visibility = choice('not_visible')
    answers.D2T_severity = severity([0.1, 0.1, 0.6, 0.1, 0.1])
    const reading = readDoorDamage(answers)
    expect(reading.findings).toEqual([])
    expect(reading.zones.find((z) => z.id === 'D2T')?.visibility).toBe('not-visible')
  })

  it('steps certainty down for a region only partly visible', () => {
    const answers = cleanDoors()
    answers.D1T_CO = predicate(0.7)
    answers.D1T_visibility = choice('partial')
    answers.D1T_severity = severity([0.02, 0.9, 0.04, 0.02, 0.02])
    const [finding] = readDoorDamage(answers).findings
    expect(finding).toMatchObject({
      severity: 'cosmetic',
      certainty: 'Likely',
      title: 'Corrosion on the door panel',
    })
    expect(finding!.caveats.join(' ')).toMatch(/only part of this region/i)
  })

  it('reports the door parts as component findings with no severity rating', () => {
    const answers = cleanDoors()
    answers.left_leaf_locking_bar_bent = predicate(0.8)
    answers.right_leaf_hinge_damage = predicate(0.6)
    answers.door_gasket_damage = predicate(0.7)
    answers.door_header_bent = predicate(0.55)
    answers.door_sill_corrosion = predicate(0.9)
    answers.left_corner_post_damage = predicate(0.6)
    answers.cam_keeper_damage = predicate(0.52)
    answers.corner_casting_damage = predicate(0.9)

    const findings = readDoorDamage(answers).findings

    expect(findings.map((f) => [f.component, f.title])).toEqual([
      ['locking-bar', 'Damage to a locking bar on the photo-left door leaf'],
      ['cam', 'Damage to a locking cam or cam keeper'],
      ['hinge', 'Damage to the hinges on the photo-right door leaf'],
      ['gasket', 'Damage to a door gasket'],
      ['header', 'Damage to the door header'],
      ['sill', 'Damage to the door sill'],
      ['corner-post', 'Damage to the corner post at photo left'],
      ['casting', 'Damage to a corner casting'],
    ])
    expect(findings.every((f) => f.face === 'rear' && f.severity === null)).toBe(true)
    expect(findings.map((f) => f.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    const bar = findings[0]!
    expect(bar.types.map((t) => t.code)).toEqual(['BT'])
    expect(bar.zone).not.toBeNull()
    expect(bar.visibility).toBeNull()
    // A part with no place on the drawing has a card but no pin.
    expect(findings.filter((f) => f.zone === null).map((f) => f.component)).toEqual([
      'cam',
      'gasket',
      'casting',
    ])
    expect(findings.find((f) => f.component === 'sill')!.types.map((t) => t.code)).toEqual(['CO'])
  })

  it('contributes nothing when its own coverage says the door end is not inspectable', () => {
    const answers = cleanDoors()
    answers.door_end_coverage = choice('not_inspectable')
    const reading = readDoorDamage(answers)
    expect(reading.inspectable).toBe(false)
    expect(reading.coverage).toBe('not-inspectable')
  })

  it('reads an empty reply as nothing seen, never as clean', () => {
    const reading = readDoorDamage({})
    expect(reading.findings).toEqual([])
    expect(reading.zones.every((z) => z.visibility === null)).toBe(true)
    expect(reading).toMatchObject({
      imageQuality: null,
      coverage: null,
      significantProbability: null,
    })
  })
})

describe('the door set chosen by the rear-doors face', () => {
  const doorsWithDent = () => {
    const answers = cleanDoors()
    answers.D1B_DT = predicate(0.9)
    answers.D1B_severity = severity([0.05, 0.05, 0.7, 0.15, 0.05])
    return readDoorDamage(answers)
  }
  const sideWithDent = () => {
    const answers: Record<string, SharedAnswer> = { side_panel_coverage: choice('full') }
    answers.Z2B_DT = predicate(0.9)
    answers.Z2B_visibility = choice('clear')
    answers.Z2B_severity = severity([0.05, 0.05, 0.7, 0.15, 0.05])
    return readSideDamage(answers)
  }
  const seen = (face: 'rear-doors' | 'long-side') => ({
    face,
    probability: 0.95,
    certainty: 'Confident' as const,
  })

  it('shows the door findings on the rear face, and ignores the side set’s', () => {
    const damage = assessDamage(seen('rear-doors'), [sideWithDent(), doorsWithDent()], 'doors.jpg')
    expect(damage?.photos).toEqual([{ photo: 'doors.jpg', face: 'rear' }])
    expect(damage?.findings.map((f) => f.location)).toEqual(['Photo-left door leaf, bottom third'])
    expect(damage?.zones).toHaveLength(6)
  })

  it('shows the side findings for a long side, and ignores the door set’s', () => {
    const damage = assessDamage(seen('long-side'), [sideWithDent(), doorsWithDent()], 'side.jpg')
    expect(damage?.photos).toEqual([{ photo: 'side.jpg', face: 'long-side' }])
    expect(damage?.findings.every((f) => f.face === 'long-side')).toBe(true)
  })

  it('says not inspectable for a door end the door set cannot see', () => {
    const answers = cleanDoors()
    answers.door_end_coverage = choice('not_inspectable')
    const damage = assessDamage(seen('rear-doors'), [readDoorDamage(answers)], 'x.jpg')
    expect(damage?.findings).toEqual([])
    expect(damage?.notAssessed?.reason).toMatch(/door end is not inspectable/)
  })

  it('with no detected face, uses the one set whose own coverage says inspectable', () => {
    const answers = cleanDoors()
    const side = readSideDamage({ side_panel_coverage: choice('not_inspectable') })
    const damage = assessDamage(null, [side, readDoorDamage(answers)], 'doors.jpg')
    expect(damage?.photos).toEqual([{ photo: 'doors.jpg', face: 'rear' }])
  })
})
