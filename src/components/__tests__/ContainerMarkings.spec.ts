import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { liveDetailsRecord } from '../../__tests__/liveDetails'
import { recordedInspection } from '../../__tests__/recordedInspection'
import ContainerMarkings from '../ContainerMarkings.vue'

const FORBIDDEN =
  /\b(verified|verify|supported|safe|passed|passes|pass|candidates?|retry|retries|non-hazardous)\b/i

function rowOf(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === label)!
}

describe('ContainerMarkings', () => {
  it('checks each marking separately and says what was not seen, with no hazard badge', async () => {
    const wrapper = mount(ContainerMarkings, { props: { record: await liveDetailsRecord() } })
    const labels = wrapper.findAll('.qs-field__label').map((l) => l.text())
    expect(labels).toEqual([
      'DG PLACARD',
      'SUPER HEAVY',
      'HIGH CONTAINER',
      'OVERWIDTH',
      'FUMIGATION',
      'MARINE POLLUTANT',
    ])
    expect(rowOf(wrapper, 'OVERWIDTH').text()).toContain('Not visible in this photo')
    expect(rowOf(wrapper, 'OVERWIDTH').text()).toContain('Not seen')
    expect(wrapper.find('.qs-marking--hazard').exists()).toBe(false)
  })

  it('reports a missing placard as no DG placard visible, never as non-hazardous cargo', async () => {
    const wrapper = mount(ContainerMarkings, { props: { record: await liveDetailsRecord() } })
    const dg = rowOf(wrapper, 'DG PLACARD')
    expect(dg.find('.qs-marking').text()).toContain('No DG placard visible')
    expect(dg.find('.qs-marking__caveat').text()).toContain('Not evidence that the cargo is')
    expect(dg.find('.qs-marking--hazard').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('shows a DG placard by its class and symbol in the hazard style, with the cargo caveat', async () => {
    const record = await liveDetailsRecord()
    record.details!.dgPlacard = {
      answer: 'placard',
      dgClass: 3,
      symbol: 'Flame',
      certainty: 'Likely',
    }
    const wrapper = mount(ContainerMarkings, { props: { record } })
    const dg = rowOf(wrapper, 'DG PLACARD')
    const badge = dg.find('.qs-marking--hazard')
    expect(badge.text()).toContain('DG placard, class 3 (flammable liquids) visible')
    expect(badge.text()).toContain('Flame')
    expect(badge.find('.qs-glyph--hazard').exists()).toBe(true)
    expect(dg.find('.qs-marking__caveat').text()).toContain('Cargo status unknown')
    expect(dg.text()).toContain('Likely')
    // Seen markings come first.
    expect(wrapper.findAll('.qs-field__label')[0]!.text()).toBe('DG PLACARD')
  })

  it('keeps the high-container caution neutral and separate from overwidth', async () => {
    const record = await liveDetailsRecord()
    record.details!.markings.highContainer = {
      answer: 'yes',
      certainty: 'Confident',
      source: 'observed',
      conflict: null,
    }
    record.details!.markings.superHeavy = {
      answer: 'yes',
      certainty: 'Likely',
      source: 'observed',
      conflict: null,
    }
    const wrapper = mount(ContainerMarkings, { props: { record } })
    const high = rowOf(wrapper, 'HIGH CONTAINER')
    expect(high.find('.qs-marking').text()).toContain('High-container caution')
    expect(high.find('.qs-marking--hazard').exists()).toBe(false)
    expect(rowOf(wrapper, 'OVERWIDTH').text()).toContain('Not visible in this photo')
    expect(rowOf(wrapper, 'SUPER HEAVY').find('.qs-marking--hazard').text()).toContain(
      'SUPER HEAVY marking',
    )
    // Seen markings first, most certain first.
    expect(
      wrapper
        .findAll('.qs-field__label')
        .map((l) => l.text())
        .slice(0, 2),
    ).toEqual(['HIGH CONTAINER', 'SUPER HEAVY'])
  })

  it("says Can't tell for a marking the photo did not settle", async () => {
    const record = await liveDetailsRecord()
    record.details!.markings.fumigation = {
      answer: null,
      certainty: "Can't tell",
      source: 'observed',
      conflict: null,
    }
    const wrapper = mount(ContainerMarkings, { props: { record } })
    expect(rowOf(wrapper, 'FUMIGATION').text()).toContain('Not clear from this photo')
    expect(rowOf(wrapper, 'FUMIGATION').text()).toContain("Can't tell")
  })

  it('says markings were not assessed when the run did not check them', async () => {
    const wrapper = mount(ContainerMarkings, {
      props: { record: await recordedInspection('luna', { delayMs: 0 }) },
    })
    expect(wrapper.text()).toContain('Not assessed in this inspection')
    expect(wrapper.findAll('.qs-field')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Not seen')
  })
})
