import { describe, it, expect, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { recordedInspection } from '../../__tests__/recordedInspection'
import {
  NOT_VISIBLE,
  UNCLEAR,
  coyuReading,
  liveWeightsRecord,
  read,
} from '../../__tests__/liveWeights'
import { useUnits } from '../../composables/units'
import ContainerDetails from '../ContainerDetails.vue'

// The weights panel (ticket #34): two-unit rows with agreement and conflict evidence, and the
// Metric / Imperial toggle in the Container details heading. The toggle is display only.

const FORBIDDEN =
  /\b(verified|verify|supported|safe|passed|passes|pass|candidates?|retry|retries|loaded weight|cargo weight is)\b/i

const rowOf = (wrapper: VueWrapper, label: string) =>
  wrapper.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === label)!
const labels = (wrapper: VueWrapper) =>
  wrapper.findAll('.qs-field').map((r) => r.find('.qs-field__label').text())
const toggle = (wrapper: VueWrapper, name: 'Metric' | 'Imperial') =>
  wrapper.findAll('.qs-seg__opt').find((b) => b.text().includes(name))!

describe('the weights in Container details', () => {
  beforeEach(() => {
    useUnits().set('metric')
    localStorage.clear()
  })

  it('shows each printed weight on its own row with "kg and lb agree" as evidence, and the capacity', async () => {
    const wrapper = mount(ContainerDetails, { props: { record: await liveWeightsRecord() } })

    expect(labels(wrapper)).toEqual([
      'ISO CODE',
      'LENGTH',
      'HEIGHT',
      'WIDTH',
      'TYPE',
      'MAX GROSS',
      'TARE',
      'PAYLOAD',
      'PAYLOAD (CALCULATED)',
      'CUBIC CAPACITY',
      'REEFER',
      'OPEN TOP',
      'TANK',
      'FLAT RACK',
    ])
    const gross = rowOf(wrapper, 'MAX GROSS')
    expect(gross.find('.qs-field__value').text()).toContain('30,480 kg')
    expect(gross.find('.qs-prov').text()).toBe('Printed')
    expect(gross.text()).toContain('kg and lb agree')
    expect(gross.text()).toContain('Confident')
    expect(gross.text()).toMatch(/maximum rating, not the cargo weight/i)
    expect(rowOf(wrapper, 'TARE').find('.qs-field__value').text()).toContain('2,180 kg')
    const payload = rowOf(wrapper, 'PAYLOAD')
    expect(payload.find('.qs-field__value').text()).toContain('28,300 kg')
    expect(payload.find('.qs-prov').text()).toBe('Printed')
    const calculated = rowOf(wrapper, 'PAYLOAD (CALCULATED)')
    expect(calculated.find('.qs-field__value').text()).toContain('28,300 kg')
    expect(calculated.find('.qs-prov--calculated').text()).toBe('Calculated')
    const capacity = rowOf(wrapper, 'CUBIC CAPACITY')
    expect(capacity.find('.qs-field__value').text()).toContain('33.2 m³')
    expect(capacity.text()).toContain('m³ and cu ft agree')
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('has a Metric / Imperial toggle in the heading that starts on Metric', async () => {
    const wrapper = mount(ContainerDetails, { props: { record: await liveWeightsRecord() } })

    const head = wrapper.find('.rs-card__head')
    expect(head.text()).toContain('Container details')
    const group = head.find('.qs-seg')
    expect(group.attributes('role')).toBe('group')
    expect(group.attributes('aria-label')).toBe('Units')
    expect(toggle(wrapper, 'Metric').attributes('aria-pressed')).toBe('true')
    expect(toggle(wrapper, 'Imperial').attributes('aria-pressed')).toBe('false')
  })

  it('switches every weight and the capacity to lb and cu ft, without touching the record', async () => {
    const record = await liveWeightsRecord()
    const before = JSON.stringify(record)
    const wrapper = mount(ContainerDetails, { props: { record } })

    await toggle(wrapper, 'Imperial').trigger('click')

    expect(toggle(wrapper, 'Imperial').attributes('aria-pressed')).toBe('true')
    expect(toggle(wrapper, 'Metric').attributes('aria-pressed')).toBe('false')
    expect(rowOf(wrapper, 'MAX GROSS').find('.qs-field__value').text()).toContain('67,200 lb')
    expect(rowOf(wrapper, 'MAX GROSS').find('.qs-field__value').text()).not.toContain('kg')
    expect(rowOf(wrapper, 'TARE').find('.qs-field__value').text()).toContain('4,810 lb')
    expect(rowOf(wrapper, 'PAYLOAD').find('.qs-field__value').text()).toContain('62,390 lb')
    expect(rowOf(wrapper, 'PAYLOAD (CALCULATED)').find('.qs-field__value').text()).toContain(
      '62,390 lb',
    )
    expect(rowOf(wrapper, 'CUBIC CAPACITY').find('.qs-field__value').text()).toContain(
      '1,173 cu ft',
    )
    // Agreement is evidence in either unit.
    expect(rowOf(wrapper, 'MAX GROSS').text()).toContain('kg and lb agree')
    expect(JSON.stringify(record)).toBe(before)

    await toggle(wrapper, 'Metric').trigger('click')
    expect(rowOf(wrapper, 'MAX GROSS').find('.qs-field__value').text()).toContain('30,480 kg')
  })

  it('remembers the choice in browser storage', async () => {
    const wrapper = mount(ContainerDetails, { props: { record: await liveWeightsRecord() } })
    await toggle(wrapper, 'Imperial').trigger('click')
    expect(localStorage.getItem('quay-sight.units')).toBe('imperial')
  })

  it('shows a weight whose kg and lb still disagree as Uncertain, with both readings, in either unit', async () => {
    const record = await liveWeightsRecord(
      coyuReading({ tare: { metric: read(2180, 'Confident'), imperial: read(4710, 'Confident') } }),
    )
    const wrapper = mount(ContainerDetails, { props: { record } })

    const tare = rowOf(wrapper, 'TARE')
    expect(tare.find('.qs-field__value').text()).toContain('2,180 kg')
    expect(tare.find('.qs-cert').text()).toContain('Uncertain')
    expect(tare.find('.qs-field__note').text()).toContain('2,180 kg')
    expect(tare.find('.qs-field__note').text()).toContain('4,710 lb')
    expect(tare.find('.qs-field__note').text()).toMatch(/kg and lb disagree/)
    expect(tare.text()).not.toContain('kg and lb agree')

    await toggle(wrapper, 'Imperial').trigger('click')
    const imperial = rowOf(wrapper, 'TARE')
    expect(imperial.find('.qs-field__value').text()).toContain('4,710 lb')
    expect(imperial.find('.qs-cert').text()).toContain('Uncertain')
    expect(imperial.find('.qs-field__note').text()).toContain('2,180 kg')
    expect(imperial.find('.qs-field__note').text()).toContain('4,710 lb')
  })

  it('says why the calculated payload is Uncertain when a weight it comes from has kg and lb that disagree', async () => {
    const record = await liveWeightsRecord(
      coyuReading({ tare: { metric: read(2180, 'Confident'), imperial: read(4710, 'Confident') } }),
    )
    const wrapper = mount(ContainerDetails, { props: { record } })

    const calculated = rowOf(wrapper, 'PAYLOAD (CALCULATED)')
    expect(calculated.find('.qs-cert').text()).toContain('Uncertain')
    expect(calculated.find('.qs-field__note').text()).toContain('Maximum gross minus tare.')
    expect(calculated.find('.qs-field__note').text()).toMatch(
      /Uncertain because tare is: its kg and lb readings disagree\./,
    )
  })

  it('shows a conflict between printed and calculated payload in the unit in force, and lowers the rows', async () => {
    const record = await liveWeightsRecord(
      coyuReading({
        payload: { metric: read(28350, 'Confident'), imperial: read(62500, 'Confident') },
      }),
    )
    const wrapper = mount(ContainerDetails, { props: { record } })

    const calculated = rowOf(wrapper, 'PAYLOAD (CALCULATED)')
    expect(calculated.find('.qs-field__note').text()).toContain('28,350 kg')
    expect(calculated.find('.qs-field__note').text()).toContain('28,300 kg')
    expect(calculated.find('.qs-field__note').text()).not.toContain('lb')
    expect(calculated.find('.qs-cert').text()).toContain('Uncertain')
    expect(rowOf(wrapper, 'PAYLOAD').find('.qs-cert').text()).toContain('Uncertain')

    await toggle(wrapper, 'Imperial').trigger('click')
    const imperial = rowOf(wrapper, 'PAYLOAD (CALCULATED)').find('.qs-field__note').text()
    expect(imperial).toContain('62,500 lb')
    expect(imperial).toContain('62,390 lb')
    expect(imperial).not.toContain('kg')
  })

  it('converts a unit that was not read, tags it Calculated and says so', async () => {
    const record = await liveWeightsRecord(
      coyuReading({ tare: { metric: read(2180), imperial: UNCLEAR } }),
    )
    const wrapper = mount(ContainerDetails, { props: { record } })

    expect(rowOf(wrapper, 'TARE').find('.qs-prov').text()).toBe('Printed')
    expect(rowOf(wrapper, 'TARE').text()).not.toContain('kg and lb agree')

    await toggle(wrapper, 'Imperial').trigger('click')
    const tare = rowOf(wrapper, 'TARE')
    expect(tare.find('.qs-field__value').text()).toContain('4,806 lb')
    expect(tare.find('.qs-prov--calculated').text()).toBe('Calculated')
    expect(tare.find('.qs-field__note').text()).toMatch(/converted from kg/i)
  })

  it('says why a weight is absent: not visible, or not clear, and never shows a zero', async () => {
    const record = await liveWeightsRecord(
      coyuReading({
        maxGross: { metric: NOT_VISIBLE, imperial: NOT_VISIBLE },
        tare: { metric: UNCLEAR, imperial: UNCLEAR },
        capacity: { metric: UNCLEAR, imperial: NOT_VISIBLE },
      }),
    )
    const wrapper = mount(ContainerDetails, { props: { record } })

    const gross = rowOf(wrapper, 'MAX GROSS')
    expect(gross.find('.qs-field__value--absent').text()).toBe('Not visible in this photo')
    expect(gross.find('.qs-cert').text()).toContain('Not seen')
    const tare = rowOf(wrapper, 'TARE')
    expect(tare.find('.qs-field__value--absent').text()).toBe('Not clear from this photo')
    expect(tare.find('.qs-cert').text()).toContain("Can't tell")
    expect(rowOf(wrapper, 'CUBIC CAPACITY').find('.qs-cert').text()).toContain("Can't tell")
    expect(rowOf(wrapper, 'PAYLOAD (CALCULATED)').find('.qs-field__value--absent').exists()).toBe(
      true,
    )
    expect(wrapper.text()).not.toMatch(/\b0 (kg|lb)\b/)
  })

  it('shows the two units of a recorded sample too: its lb is converted from the printed kg', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(labels(wrapper).slice(5)).toEqual(['MAX GROSS', 'TARE', 'PAYLOAD'])
    expect(rowOf(wrapper, 'MAX GROSS').find('.qs-field__value').text()).toContain('32,500 kg')

    await toggle(wrapper, 'Imperial').trigger('click')
    const gross = rowOf(wrapper, 'MAX GROSS')
    expect(gross.find('.qs-field__value').text()).toContain('71,650 lb')
    expect(gross.find('.qs-prov--calculated').text()).toBe('Calculated')
    expect(gross.text()).toMatch(/rating/i)
    expect(rowOf(wrapper, 'PAYLOAD').find('.qs-field__value').text()).toContain('63,118 lb')
  })

  describe('the printed payload when it disagrees with itself (ticket #65)', () => {
    const C = 'Confident' as const
    const disagreeing = { metric: read(22330, C), imperial: read(63390, C) }
    const rowsFor = async (payload: typeof disagreeing, grossLb = 67200) =>
      mount(ContainerDetails, {
        props: {
          record: await liveWeightsRecord(
            coyuReading({
              maxGross: { metric: read(30480, C), imperial: read(grossLb, C) },
              tare: { metric: read(2180, C), imperial: read(4810, C) },
              payload,
            }),
          ),
        },
      })

    it('shows only the calculated payload when it is Confident and the printed one is not', async () => {
      const wrapper = await rowsFor(disagreeing)
      expect(labels(wrapper)).not.toContain('PAYLOAD')
      const calculated = rowOf(wrapper, 'PAYLOAD (CALCULATED)')
      expect(calculated.find('.qs-field__value').text()).toContain('28,300 kg')
      expect(calculated.find('.qs-cert').text()).toContain('Confident')
      expect(wrapper.text()).not.toContain('22,330')
    })

    it('shows both when both are Confident', async () => {
      const wrapper = await rowsFor({ metric: read(28300, C), imperial: read(62390, C) })
      expect(rowOf(wrapper, 'PAYLOAD').find('.qs-cert').text()).toContain('Confident')
    })

    it('shows both when neither is Confident', async () => {
      // Maximum gross disagrees with itself, so the calculated payload is Uncertain too.
      const wrapper = await rowsFor(disagreeing, 67900)
      expect(rowOf(wrapper, 'PAYLOAD (CALCULATED)').find('.qs-cert').text()).not.toContain(
        'Confident',
      )
      expect(labels(wrapper)).toContain('PAYLOAD')
    })
  })

  it('keeps the heading toggle off a run that read none of the details', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    record.sizeCode = null
    record.weights = null
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.find('.qs-seg').exists()).toBe(false)
  })
})
