import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { liveDetailsRecord } from '../../__tests__/liveDetails'
import ContainerDetails from '../ContainerDetails.vue'

const FORBIDDEN =
  /\b(verified|verify|supported|safe|passed|passes|pass|candidates?|retry|retries)\b/i

describe('ContainerDetails', () => {
  it('shows the printed ISO code and its decoded meaning as a 40 ft High Cube, not a 45 ft container', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).toContain('45G1')
    expect(wrapper.text()).toContain('40 ft')
    expect(wrapper.text()).toContain('9 ft 6 in High Cube')
    expect(wrapper.text()).toContain('8 ft standard width')
    expect(wrapper.text()).not.toContain('45 ft')
  })

  it('keeps maximum gross and tare as separate printed rows, and payload as a calculated row', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    const rows = wrapper.findAll('.qs-field')
    const labels = rows.map((r) => r.find('.qs-field__label').text())
    expect(labels).toEqual([
      'ISO CODE',
      'LENGTH',
      'HEIGHT',
      'WIDTH',
      'TYPE',
      'MAX GROSS',
      'TARE',
      'PAYLOAD',
    ])
    const gross = rows[5]!
    expect(gross.text()).toContain('32,500 kg')
    expect(gross.text()).toContain('Printed')
    expect(gross.text()).toContain('rating')
    const tare = rows[6]!
    expect(tare.text()).toContain('3,870 kg')
    const payload = rows[7]!
    expect(payload.text()).toContain('28,630 kg')
    expect(payload.find('.qs-prov--calculated').text()).toBe('Calculated')
  })

  it('shows a flagged conflict when printed NET disagrees with the arithmetic', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    record.weights = {
      ...record.weights!,
      conflict: 'Printed NET 28,000 kg does not match maximum gross minus tare, 28,630 kg.',
      payload: { valueKg: 28630, provenance: 'calculated', certainty: 'Uncertain' },
    }
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).toContain('Printed NET 28,000 kg does not match')
    expect(wrapper.text()).toContain('Uncertain')
  })

  it('marks absent readings as not visible rather than zero, and keeps Jev honest', async () => {
    const record = await recordedInspection('openrouter', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).toContain('Not visible in this photo')
    expect(wrapper.text()).not.toContain('0 kg')
    expect(wrapper.find('.qs-prov--calculated').exists()).toBe(false)
  })

  it('says the details were not assessed when the run never read them, with no Not seen chips', async () => {
    // A run that read only the container ID (every live run today): no size code, no weights.
    const record = await recordedInspection('luna', { delayMs: 0 })
    record.sizeCode = null
    record.weights = null
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).toContain('Not assessed in this inspection')
    expect(wrapper.text()).not.toContain('Not seen')
    expect(wrapper.text()).not.toContain('Not visible in this photo')
    expect(wrapper.findAll('.qs-field')).toHaveLength(0)
  })

  it('shows a live size/type code as printed, and what it decodes to as decoded', async () => {
    const wrapper = mount(ContainerDetails, { props: { record: await liveDetailsRecord() } })
    const row = (label: string) =>
      wrapper.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === label)!
    expect(row('ISO CODE').text()).toContain('22G1')
    expect(row('ISO CODE').find('.qs-prov').text()).toBe('Printed')
    expect(row('ISO CODE').text()).toContain('Confident')
    expect(row('LENGTH').text()).toContain('20 ft')
    expect(row('HEIGHT').text()).toContain('8 ft 6 in')
    expect(row('WIDTH').text()).toContain('8 ft standard width')
    expect(row('TYPE').text()).toContain('General purpose')
    for (const label of ['LENGTH', 'HEIGHT', 'WIDTH', 'TYPE']) {
      expect(row(label).find('.qs-prov').text()).toBe('Decoded from ISO')
    }
  })

  it('shows each equipment check as its own row, with a conflict with the code explained', async () => {
    const record = await liveDetailsRecord()
    record.details!.equipment.reefer = {
      answer: 'no',
      certainty: 'Uncertain',
      source: 'observed',
      conflict: 'The size/type code 42R1 is a reefer code, but the photo was read as not a reefer.',
    }
    record.details!.equipment.tank = {
      answer: null,
      certainty: "Can't tell",
      source: 'observed',
      conflict: null,
    }
    const wrapper = mount(ContainerDetails, { props: { record } })
    const row = (label: string) =>
      wrapper.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === label)!
    expect(row('REEFER').text()).toContain('No')
    expect(row('REEFER').text()).toContain('Uncertain')
    expect(row('REEFER').find('.qs-field__note').text()).toContain('42R1')
    expect(row('OPEN TOP').text()).toContain('No')
    expect(row('TANK').text()).toContain("Can't tell")
    expect(row('FLAT RACK').text()).toContain('Confident')
  })

  it("keeps a code it cannot read honest: not visible is Not seen, unreadable is Can't tell", async () => {
    const record = await liveDetailsRecord()
    record.sizeCode = null
    record.details!.sizeCode = {
      state: 'not-visible',
      code: null,
      certainty: 'Not seen',
      source: 'printed',
      alternative: null,
      decoded: null,
    }
    let wrapper = mount(ContainerDetails, { props: { record } })
    const iso = () =>
      wrapper.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === 'ISO CODE')!
    expect(iso().text()).toContain('Not visible in this photo')
    expect(iso().text()).toContain('Not seen')

    record.details!.sizeCode = {
      ...record.details!.sizeCode,
      state: 'unreadable',
      certainty: "Can't tell",
    }
    wrapper = mount(ContainerDetails, { props: { record } })
    expect(iso().text()).toContain('not clear enough to read')
    expect(iso().text()).toContain("Can't tell")
  })

  it('shows a plausible other code beside an uncertain one', async () => {
    const record = await liveDetailsRecord()
    record.details!.sizeCode = {
      ...record.details!.sizeCode,
      certainty: 'Uncertain',
      alternative: '22G0',
    }
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).toContain('Also possible: 22G0')
  })

  it('says the weights were not assessed on a live run that did not ask them, never Not seen', async () => {
    const wrapper = mount(ContainerDetails, { props: { record: await liveDetailsRecord() } })
    const labels = wrapper.findAll('.qs-field__label').map((l) => l.text())
    expect(labels).not.toContain('MAX GROSS')
    expect(wrapper.text()).toContain('Weights: not assessed in this inspection.')
  })

  it('uses only the approved status and provenance vocabulary', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
    const live = mount(ContainerDetails, { props: { record: await liveDetailsRecord() } })
    expect(live.text()).not.toMatch(FORBIDDEN)
  })

  describe('length from the shape (ticket #66)', () => {
    const shape = (feet: 20 | 40 | 45) => ({
      feet,
      probability: 0.95,
      certainty: 'Confident' as const,
    })

    it('says "40 ft" with the Estimated from shape tag when no code decided', async () => {
      const base = await liveDetailsRecord()
      const record = { ...base, sizeCode: null, shapeLength: shape(40) }
      const wrapper = mount(ContainerDetails, { props: { record } })
      const row = wrapper.findAll('.qs-field').find((r) => r.text().startsWith('LENGTH'))!
      expect(row.find('.qs-field__value').text()).toBe('40 ft Estimated from shape')
      expect(row.text()).toContain('Confident')
      expect(row.text()).not.toContain('Decoded from ISO')
    })

    it('keeps "Decoded from ISO" when the code decided', async () => {
      const record = { ...(await liveDetailsRecord()), shapeLength: shape(20) }
      const wrapper = mount(ContainerDetails, { props: { record } })
      const row = wrapper.findAll('.qs-field').find((r) => r.text().startsWith('LENGTH'))!
      expect(row.text()).toContain('Decoded from ISO')
      expect(wrapper.text()).not.toContain('The size code says')
    })

    it('warns, and marks the length Uncertain with the shape as the alternative, on disagreement', async () => {
      const record = { ...(await liveDetailsRecord()), shapeLength: shape(40) }
      const wrapper = mount(ContainerDetails, { props: { record } })
      const row = wrapper.findAll('.qs-field').find((r) => r.text().startsWith('LENGTH'))!
      expect(row.text()).toContain('Uncertain')
      expect(row.text()).toContain('Also possible: 40 ft')
      expect(wrapper.text()).toContain('The size code says 20 ft but the shape')
    })
  })
})
