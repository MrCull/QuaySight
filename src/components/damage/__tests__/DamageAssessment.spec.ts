import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DamageView from '../DamageView.vue'
import type { DamageAssessment, DamageFinding } from '../../../domain/damage'
import { readSideDamage } from '../../../domain/sideDamage'
import { readDoorDamage } from '../../../domain/doorDamage'
import { assessDamage } from '../../../domain/damageSets'
import type { SharedAnswer } from '../../../domain/questionSet'

const FORBIDDEN =
  /\b(clear|clean|undamaged|safe|verified|supported|green|passed|confirmed|repair required)\b/i

const predicate = (probability: number): SharedAnswer => ({ type: 'predicate', probability })
const choice = (value: string): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: 0.9 },
  confidence: null,
})
const severity = (probabilities: number[]): SharedAnswer => {
  const level = probabilities.indexOf(Math.max(...probabilities))
  return {
    type: 'score',
    level,
    label: ['none', 'cosmetic', 'minor', 'moderate', 'major'][level]!,
    score: null,
    probabilities,
    confidence: null,
  }
}

/** A live long-side assessment, built the way a live run builds it. */
function liveSide(edit: (answers: Record<string, SharedAnswer>) => void = () => {}) {
  const answers: Record<string, SharedAnswer> = {
    image_quality: choice('good'),
    side_panel_coverage: choice('most'),
    door_end_in_image: choice('image_right'),
    potentially_significant_damage: predicate(0.8),
  }
  for (const n of [1, 2, 3, 4, 5]) {
    for (const half of ['T', 'B']) {
      answers[`Z${n}${half}_visibility`] = choice('clear')
      answers[`Z${n}${half}_severity`] = severity([0.95, 0.02, 0.01, 0.01, 0.01])
    }
  }
  answers.Z2B_DT = predicate(0.92)
  answers.Z2B_severity = severity([0.02, 0.03, 0.3, 0.6, 0.05])
  answers.Z4T_CO = predicate(0.7)
  answers.Z4T_severity = severity([0.2, 0.7, 0.05, 0.03, 0.02])
  answers.Z4T_visibility = choice('partial')
  answers.Z5T_visibility = choice('not_visible')
  answers.bottom_rail_bent = predicate(0.7)
  answers.corner_casting_damage = predicate(0.8)
  edit(answers)
  return assessDamage(
    { face: 'long-side', probability: 0.95, certainty: 'Confident' },
    [readSideDamage(answers)],
    'side.jpg',
  )!
}

function cardFor(wrapper: ReturnType<typeof mount>, f: DamageFinding) {
  return wrapper.find(`.qs-finding[data-finding="${f.id}"]`)
}

describe('a live long-side assessment in the damage view', () => {
  it('shows the set’s own photo checks, and the door end only because the photo shows it', () => {
    const wrapper = mount(DamageView, { props: { assessment: liveSide() } })
    const facts = wrapper.find('.qs-damage-facts')
    expect(facts.text()).toContain('Photo quality')
    expect(facts.text()).toContain('Good')
    expect(facts.text()).toContain('Side sheet visible')
    expect(facts.text()).toContain('Most')
    expect(facts.text()).toContain('At photo right')

    const noDoor = mount(DamageView, {
      props: {
        assessment: liveSide((a) => (a.door_end_in_image = choice('not_identifiable'))),
      },
    })
    expect(noDoor.find('.qs-damage-facts').text()).not.toContain('Door end')
  })

  it('says potentially significant damage, closer inspection advised, only when the model says so', () => {
    const flagged = mount(DamageView, { props: { assessment: liveSide() } })
    expect(flagged.find('.qs-significant').text()).toBe(
      'Potentially significant damage, closer inspection advised',
    )
    const calm = mount(DamageView, {
      props: {
        assessment: liveSide((a) => (a.potentially_significant_damage = predicate(0.1))),
      },
    })
    expect(calm.find('.qs-significant').exists()).toBe(false)
  })

  it('draws the 5 × 2 zone grid with each zone’s visibility; an unseen zone is Not seen, never clean', () => {
    const wrapper = mount(DamageView, {
      props: { assessment: liveSide((a) => delete a.Z1B_visibility) },
    })
    const figure = wrapper.find('figure[data-view="rear-right"]')
    expect(figure.findAll('.qs-c-zone')).toHaveLength(10)
    expect(figure.findAll('.qs-c-zone--partial')).toHaveLength(1)
    const unseen = figure.findAll('.qs-c-zone--unseen')
    expect(unseen).toHaveLength(2)
    expect(unseen.map((z) => z.find('.qs-c-zone__tag').text()).sort()).toEqual([
      "Can't tell",
      'Not seen',
    ])
    expect(wrapper.find('.qs-schem').classes()).toContain('qs-schem--show-grid')
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('shows a cosmetic finding as the lightest severity, on four bars', () => {
    const assessment = liveSide()
    const cosmetic = assessment.findings.find((f) => f.severity === 'cosmetic')!
    const wrapper = mount(DamageView, { props: { assessment } })
    const badge = cardFor(wrapper, cosmetic).find('.qs-sev')
    expect(badge.classes()).toContain('qs-sev--cosmetic')
    expect(badge.text()).toContain('Cosmetic')
    expect(badge.findAll('.qs-sev__bars i')).toHaveLength(4)
    expect(cardFor(wrapper, cosmetic).find('.qs-finding__n').classes()).toContain(
      'qs-finding__n--cosmetic',
    )
  })

  it('shows rail and casting damage as component findings with no severity rating', () => {
    const assessment = liveSide()
    const rail = assessment.findings.find((f) => f.component === 'rail')!
    const casting = assessment.findings.find((f) => f.component === 'casting')!
    const wrapper = mount(DamageView, { props: { assessment } })

    const railCard = cardFor(wrapper, rail)
    expect(railCard.text()).toContain('Bottom side rail')
    expect(railCard.find('.qs-sev').classes()).toContain('qs-sev--unrated')
    expect(railCard.find('.qs-sev').text()).toContain('Not rated')
    expect(wrapper.find(`.qs-pin[data-finding="${rail.id}"]`).classes()).toContain(
      'qs-marker--unrated',
    )
    // Which casting is not said: a card, but no pin.
    expect(cardFor(wrapper, casting).exists()).toBe(true)
    expect(wrapper.find(`.qs-pin[data-finding="${casting.id}"]`).exists()).toBe(false)
  })

  it('names the zone in photo-relative words, never a CEDEX location code', async () => {
    const assessment = liveSide()
    const dent = assessment.findings.find((f) => f.types[0]?.code === 'DT')!
    const wrapper = mount(DamageView, { props: { assessment } })
    await cardFor(wrapper, dent).trigger('click')
    const card = cardFor(wrapper, dent)
    expect(card.text()).toContain(
      'Photo column 2 of 5 from the front end, lower half of the side sheet',
    )
    expect(card.text()).toContain('Moderate')
    expect(card.text()).toContain('0.92')
    expect(wrapper.text()).not.toMatch(/location code|CEDEX location/i)
  })
})

describe('which side a live long-side photo is drawn on', () => {
  const door = (value: string) => liveSide((a) => (a.door_end_in_image = choice(value)))
  const left = (w: ReturnType<typeof mount>) => w.find('figure[data-view="front-left"]')
  const right = (w: ReturnType<typeof mount>) => w.find('figure[data-view="rear-right"]')
  const coverage = (w: ReturnType<typeof mount>, name: string) =>
    w
      .findAll('.qs-coverage__item')
      .find((li) => li.text().startsWith(name))!
      .text()

  it('draws doors at photo-left on the left side of Front and left side, with the right side Not seen', () => {
    const wrapper = mount(DamageView, { props: { assessment: door('image_left') } })
    expect(left(wrapper).findAll('.qs-pin').length).toBeGreaterThan(0)
    expect(left(wrapper).findAll('.qs-c-zone')).toHaveLength(10)
    expect(left(wrapper).text()).toContain('Left side')
    expect(right(wrapper).findAll('.qs-pin')).toHaveLength(0)
    expect(right(wrapper).text()).toContain('Right side · Not seen')
    expect(coverage(wrapper, 'Left side')).toContain('Photo 1')
    expect(coverage(wrapper, 'Right side')).toContain('Not seen')
    expect(wrapper.text()).not.toContain('side Uncertain')
    expect(wrapper.find('figure[data-view="image-relative"]').exists()).toBe(false)
  })

  it('draws doors at photo-right on the right side of Rear and right side', () => {
    const wrapper = mount(DamageView, { props: { assessment: door('image_right') } })
    expect(right(wrapper).findAll('.qs-pin').length).toBeGreaterThan(0)
    expect(left(wrapper).findAll('.qs-pin')).toHaveLength(0)
    expect(left(wrapper).text()).toContain('Left side · Not seen')
    expect(wrapper.text()).not.toContain('side Uncertain')
    expect(wrapper.find('figure[data-view="image-relative"]').exists()).toBe(false)
  })

  it('keeps photo-left at the start of the face on both sides, so the door end sits by the doors', () => {
    const dentZone = (w: ReturnType<typeof mount>) =>
      w.findAll('.qs-c-zone title').map((t) => t.text())
    // Doors at photo-left: the first column is by the doors, at the far end from the front wall.
    const l = mount(DamageView, { props: { assessment: door('image_left') } })
    expect(dentZone(l)[0]).toContain('Photo column 1 of 5 from the door end')
    // Doors at photo-right: the last column is by the doors, beside the rear end.
    const r = mount(DamageView, { props: { assessment: door('image_right') } })
    expect(dentZone(r)[0]).toContain('Photo column 1 of 5 from the front end')
    const first = (a: DamageAssessment) => a.zones!.find((z) => z.id === 'Z1T')!.zone
    expect(first(door('image_left'))).toEqual(first(door('image_right')))
  })

  it('draws an unclear door end on Rear and right side with a visible side-not-certain note', () => {
    const wrapper = mount(DamageView, { props: { assessment: door('not_identifiable') } })
    expect(right(wrapper).findAll('.qs-pin').length).toBeGreaterThan(0)
    expect(left(wrapper).findAll('.qs-pin')).toHaveLength(0)
    expect(right(wrapper).text()).toContain('Right side · side Uncertain')
    expect(wrapper.find('.qs-notice').text()).toContain('Right side · side Uncertain')
    expect(coverage(wrapper, 'Right side')).toContain('side Uncertain')
    expect(coverage(wrapper, 'Left side')).toContain('Not seen')
    expect(wrapper.find('figure[data-view="image-relative"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })
})

describe('a view no damage set covers', () => {
  const roof: DamageAssessment = assessDamage(
    { face: 'roof', probability: 0.9, certainty: 'Confident' },
    [],
    'roof.jpg',
  )!

  it('says damage is not assessed for this view, with the reason, and draws nothing', () => {
    const wrapper = mount(DamageView, { props: { assessment: roof } })
    expect(wrapper.text()).toContain('Damage not assessed for this view')
    expect(wrapper.text()).toContain('The photo shows the roof')
    expect(wrapper.find('.qs-schem').exists()).toBe(false)
    expect(wrapper.find('.qs-finding').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })
})

/** A live door-end assessment, built the way a live run builds it. */
function liveDoors(edit: (answers: Record<string, SharedAnswer>) => void = () => {}) {
  const answers: Record<string, SharedAnswer> = {
    image_quality: choice('good'),
    door_end_coverage: choice('most'),
    potentially_significant_damage: predicate(0.7),
  }
  for (const leaf of [1, 2]) {
    for (const band of ['T', 'M', 'B']) {
      answers[`D${leaf}${band}_visibility`] = choice('clear')
      answers[`D${leaf}${band}_severity`] = severity([0.95, 0.02, 0.01, 0.01, 0.01])
    }
  }
  answers.D2B_DT = predicate(0.9)
  answers.D2B_severity = severity([0.02, 0.03, 0.3, 0.6, 0.05])
  answers.D2T_visibility = choice('partial')
  answers.D1B_visibility = choice('not_visible')
  answers.left_leaf_locking_bar_bent = predicate(0.8)
  answers.door_sill_corrosion = predicate(0.7)
  answers.door_gasket_damage = predicate(0.8)
  edit(answers)
  return assessDamage(
    { face: 'rear-doors', probability: 0.95, certainty: 'Confident' },
    [readDoorDamage(answers)],
    'doors.jpg',
  )!
}

describe('a live door-end assessment in the damage view', () => {
  it('draws the six door regions on the end of the rear view, with visibility', () => {
    const wrapper = mount(DamageView, { props: { assessment: liveDoors() } })
    const rear = wrapper.find('figure[data-view="rear-right"]')
    const zones = rear.findAll('.qs-c-zone')
    expect(zones).toHaveLength(6)
    expect(rear.findAll('.qs-c-zone--partial')).toHaveLength(1)
    const unseen = rear.findAll('.qs-c-zone--unseen')
    expect(unseen).toHaveLength(1)
    expect(unseen[0]!.find('.qs-c-zone__tag').text()).toBe('Not seen')
    expect(unseen[0]!.find('title').text()).toBe('Photo-left door leaf, bottom third: not seen')
    // The other view holds the front end, so it has no door regions.
    expect(wrapper.find('figure[data-view="front-left"]').findAll('.qs-c-zone')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('says the door end is what is visible, and names no door end check of its own', () => {
    const facts = mount(DamageView, { props: { assessment: liveDoors() } }).find('.qs-damage-facts')
    expect(facts.text()).toContain('Door end visible')
    expect(facts.text()).toContain('Most')
    expect(facts.text()).not.toContain('At photo')
  })

  it('tints the dented region by severity and stands a pin on it', async () => {
    const assessment = liveDoors()
    const dent = assessment.findings.find((f) => f.component === 'panel')!
    const wrapper = mount(DamageView, { props: { assessment } })
    expect(wrapper.find(`.qs-region[data-finding="${dent.id}"]`).classes()).toContain(
      'qs-region--moderate',
    )
    expect(wrapper.find(`.qs-pin[data-finding="${dent.id}"]`).classes()).toContain(
      'qs-marker--moderate',
    )
    const card = cardFor(wrapper, dent)
    expect(card.text()).toContain('Dent in the door panel')
    expect(card.text()).toContain('Photo-right door leaf, bottom third')
    expect(card.text()).not.toMatch(/\bD2B\b/)
  })

  it('shows door parts as bands with no severity rating; a gasket has a card but no pin', () => {
    const assessment = liveDoors()
    const bar = assessment.findings.find((f) => f.component === 'locking-bar')!
    const sill = assessment.findings.find((f) => f.component === 'sill')!
    const gasket = assessment.findings.find((f) => f.component === 'gasket')!
    const wrapper = mount(DamageView, { props: { assessment } })
    for (const f of [bar, sill]) {
      expect(wrapper.find(`.qs-region[data-finding="${f.id}"]`).classes()).toContain(
        'qs-region--unrated',
      )
      expect(wrapper.find(`.qs-pin[data-finding="${f.id}"]`).exists()).toBe(true)
      expect(cardFor(wrapper, f).find('.qs-sev').text()).toContain('Not rated')
    }
    expect(cardFor(wrapper, gasket).exists()).toBe(true)
    expect(wrapper.find(`.qs-pin[data-finding="${gasket.id}"]`).exists()).toBe(false)
  })

  it('does not draw the long-side figure for a door photo', () => {
    const wrapper = mount(DamageView, { props: { assessment: liveDoors() } })
    expect(wrapper.find('figure[data-view="image-relative"]').exists()).toBe(false)
  })
})
