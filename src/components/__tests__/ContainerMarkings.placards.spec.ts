import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { liveDetailsRecord } from '../../__tests__/liveDetails'
import type { PlacardsReading } from '../../domain/placards'
import ContainerMarkings from '../ContainerMarkings.vue'

const mark = (answer: 'yes' | 'no') =>
  ({ answer, certainty: answer === 'yes' ? 'Confident' : 'Not seen' }) as const

async function withPlacards(placards: Partial<PlacardsReading>) {
  const record = await liveDetailsRecord()
  record.placards = {
    answer: 'present',
    certainty: 'Confident',
    placards: [],
    marinePollutant: mark('no'),
    limitedQuantity: mark('no'),
    ...placards,
  }
  return record
}

const labels = (w: ReturnType<typeof mount>) => w.findAll('.qs-field__label').map((l) => l.text())
const rowOf = (w: ReturnType<typeof mount>, label: string) =>
  w.findAll('.qs-field').find((r) => r.find('.qs-field__label').text() === label)!

describe('ContainerMarkings placards', () => {
  it('says no placards seen as a result, in the neutral style', async () => {
    const record = await withPlacards({ answer: 'none', certainty: 'Not seen' })
    const wrapper = mount(ContainerMarkings, { props: { record } })
    const row = rowOf(wrapper, 'PLACARDS')
    expect(row.text()).toContain('No placards seen')
    expect(row.text()).toContain('Not seen')
    expect(row.find('.qs-marking--hazard').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Not assessed')
    expect(wrapper.text()).not.toMatch(/\b(verified|supported|safe)\b/i)
  })

  it('shows a placard by class and UN number in the hazard style, with a crop when it has a box', async () => {
    const record = await withPlacards({
      placards: [
        {
          dgClass: 3,
          unNumber: '1203',
          certainty: 'Likely',
          box: { top: 0.4, bottom: 0.5, left: 0.3, right: 0.4, confidence: 0.9 },
        },
      ],
    })
    const wrapper = mount(ContainerMarkings, { props: { record, photo: 'blob:photo' } })
    const row = rowOf(wrapper, 'PLACARD 1')
    expect(row.find('.qs-marking--hazard').text()).toContain('Class 3, UN 1203')
    expect(row.find('.qs-glyph--hazard').exists()).toBe(true)
    expect(row.text()).toContain('Likely')
    expect(wrapper.findAll('figure.rs-crop')).toHaveLength(1)
    expect(wrapper.find('figure.rs-crop img').attributes('src')).toBe('blob:photo')
  })

  it('shows two placards and the marks, each its own row, replacing the earlier DG and marine rows', async () => {
    const record = await withPlacards({
      placards: [
        { dgClass: 3, unNumber: '1203', certainty: 'Confident' },
        { dgClass: 9, unNumber: '3082', certainty: 'Confident' },
      ],
      marinePollutant: mark('yes'),
      limitedQuantity: mark('yes'),
    })
    const wrapper = mount(ContainerMarkings, { props: { record, photo: 'blob:photo' } })
    expect(labels(wrapper)).toEqual([
      'SUPER HEAVY',
      'HIGH CONTAINER',
      'OVERWIDTH',
      'FUMIGATION',
      'PLACARD 1',
      'PLACARD 2',
      'MARINE POLLUTANT',
      'LIMITED QUANTITY',
    ])
    expect(rowOf(wrapper, 'MARINE POLLUTANT').find('.qs-marking--hazard').text()).toContain(
      'Marine pollutant mark visible',
    )
    expect(rowOf(wrapper, 'LIMITED QUANTITY').find('.qs-marking--hazard').text()).toContain(
      'Limited quantity mark visible',
    )
    // No box: no crop.
    expect(wrapper.find('figure.rs-crop').exists()).toBe(false)
  })

  it('keeps an unread UN number unread and says so', async () => {
    const record = await withPlacards({
      placards: [{ dgClass: 3, unNumber: '12?3', certainty: "Can't tell" }],
    })
    const wrapper = mount(ContainerMarkings, { props: { record } })
    const row = rowOf(wrapper, 'PLACARD 1')
    expect(row.find('.qs-marking--hazard').text()).toContain('UN 12·3')
    expect(row.find('.qs-marking__caveat').text()).toContain('digit of the UN number was not read')
    expect(row.text()).toContain("Can't tell")
  })

  it('shows the placards even when the run read no other details', async () => {
    const record = await withPlacards({ answer: 'none', certainty: 'Not seen' })
    delete record.details
    const wrapper = mount(ContainerMarkings, { props: { record } })
    expect(wrapper.text()).toContain('No placards seen')
    expect(wrapper.text()).not.toContain('Not assessed')
  })
})
