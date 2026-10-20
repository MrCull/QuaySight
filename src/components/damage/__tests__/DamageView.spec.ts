import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DamageView from '../DamageView.vue'
import { recordedSideDamage } from '../../../__tests__/handWrittenDamage'

const FORBIDDEN = /\b(clear|undamaged|safe|verified|supported|green|passed|confirmed)\b/i

describe('DamageView schematic', () => {
  it('draws only the view that holds a photographed face, with a line for the other', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    const views = wrapper.findAll('.qs-schem__views-in > figure.qs-schem__view')
    expect(views).toHaveLength(1)
    expect(views[0]!.find('figcaption').text()).toContain('Rear and right side')
    expect(wrapper.find('.qs-schem__views-in > .qs-coverage__item--unseen').text()).toBe(
      'Front end (no doors) and left side: not photographed',
    )
  })

  it('greys the roof in each drawn view', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    expect(wrapper.findAll('.qs-schem__views-in .qs-c-roof')).toHaveLength(1)
  })

  it('draws the long-side finding once, on the side it was drawn on, and never on a third figure', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    expect(wrapper.find('figure[data-view="image-relative"]').exists()).toBe(false)
    expect(wrapper.findAll('.qs-schem__view')).toHaveLength(1)
    const right = wrapper.find('figure[data-view="rear-right"]')
    expect(right.findAll('.qs-pin')).toHaveLength(1)
    expect(right.find('.qs-pin').attributes('aria-label')).toContain('Finding 1')
  })

  it('shows Not seen for unphotographed faces and side Uncertain for the defaulted side, never clear', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    expect(wrapper.text()).toContain('Not seen')
    expect(wrapper.text()).toContain('side Uncertain')
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('shows no CEDEX location code', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    expect(wrapper.text()).not.toMatch(/location code|CEDEX location/i)
  })
})

describe('DamageView selection', () => {
  it('opens a finding with its damage type, plain description, severity, probability and caveats when a marker is selected', async () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    await wrapper.find('.qs-pin').trigger('click')
    const card = wrapper.find('.qs-finding[aria-pressed="true"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('DT')
    expect(card.text()).toContain('Dent')
    expect(card.text()).toContain('Probability unavailable')
    expect(card.text()).toContain('Approximate area')
    expect(card.text()).toContain('Best interpretation')
    expect(card.find('.qs-sev').text()).toContain('Minor')
    expect(card.find('.qs-cert').text()).toContain('Likely')
  })

  it('keeps severity and certainty as separate visual elements', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    const card = wrapper.find('.qs-finding')
    expect(card.find('.qs-sev').classes()).not.toContain('qs-cert')
    expect(card.find('.qs-cert').classes()).not.toContain('qs-sev')
    expect(card.find('.qs-sev').classes()).toContain('qs-sev--minor')
    expect(card.find('.qs-cert').classes()).toContain('qs-cert--likely')
  })

  it('selects the same finding from the card as from the marker', async () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    await wrapper.find('.qs-finding').trigger('click')
    expect(wrapper.find('.qs-pin').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.qs-region.is-selected').exists()).toBe(true)
  })
})

describe('DamageView states', () => {
  it('says damage was not assessed in this inspection (live or recorded), without implying clear', () => {
    const wrapper = mount(DamageView, { props: { assessment: null } })
    expect(wrapper.text()).toContain('Damage not assessed in this inspection')
    expect(wrapper.text()).not.toContain('recording')
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('summarises the number of suspected findings', () => {
    const wrapper = mount(DamageView, { props: { assessment: recordedSideDamage } })
    expect(wrapper.text()).toContain('1 suspected finding')
  })
})

describe('DamageView surface wear', () => {
  const [base] = recordedSideDamage.findings
  const wear = {
    ...base!,
    id: 2,
    title: 'Surface wear on the side sheet',
    severity: 'cosmetic' as const,
    surfaceWear: true,
  }
  const real = { ...base!, id: 1, title: 'Dent in the side sheet', severity: 'major' as const }
  const banner = 'Potentially significant damage, closer inspection advised'

  it('shows surface wear at the lowest severity without the closer-inspection banner', () => {
    const assessment = {
      ...recordedSideDamage,
      significantProbability: 0.9,
      findings: [{ ...wear, id: 1 }],
    }
    const wrapper = mount(DamageView, { props: { assessment } })
    expect(wrapper.text()).not.toContain(banner)
    expect(wrapper.find('[data-finding="1"] .qs-sev').classes()).toContain('qs-sev--cosmetic')
  })

  it('lists surface wear after real findings, which still raise the banner', () => {
    const assessment = {
      ...recordedSideDamage,
      significantProbability: 0.9,
      findings: [real, wear],
    }
    const wrapper = mount(DamageView, { props: { assessment } })
    expect(wrapper.text()).toContain(banner)
    const cards = wrapper.findAll('.qs-finding')
    expect(cards.map((c) => c.find('.qs-finding__title').text())).toEqual([
      'Dent in the side sheet',
      'Surface wear on the side sheet',
    ])
  })
})
