import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { recordedInspection } from '../../__tests__/recordedInspection'
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
      'MAX GROSS',
      'TARE',
      'PAYLOAD',
    ])
    const gross = rows[4]!
    expect(gross.text()).toContain('32,500 kg')
    expect(gross.text()).toContain('Printed')
    expect(gross.text()).toContain('rating')
    const tare = rows[5]!
    expect(tare.text()).toContain('3,870 kg')
    const payload = rows[6]!
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

  it('uses only the approved status and provenance vocabulary', async () => {
    const record = await recordedInspection('luna', { delayMs: 0 })
    const wrapper = mount(ContainerDetails, { props: { record } })
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })
})
