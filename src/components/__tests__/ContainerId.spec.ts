import { buildContainerIdReading } from '../../domain/containerId'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContainerId from '../ContainerId.vue'
import type { ContainerIdReading } from '../../domain/inspection'

function reading(overrides: Partial<ContainerIdReading>): ContainerIdReading {
  return {
    value: 'APHU6586847',
    observedCheckDigit: 7,
    calculatedCheckDigit: 7,
    checkDigitValid: true,
    certainty: 'Confident',
    provenance: 'printed',
    ...overrides,
  }
}

describe('ContainerId', () => {
  it('marks a missing position with a dot and "not read", without filling it in', () => {
    const wrapper = mount(ContainerId, {
      props: {
        reading: reading({
          value: 'APHU65868?',
          certainty: 'Likely',
          checkDigitValid: false,
          observedCheckDigit: null,
        }),
      },
    })
    const chars = wrapper.findAll('.qs-id__ch').map((c) => c.text())
    expect(chars.slice(-1)).toEqual(['·'])
    expect(wrapper.findAll('.qs-id__ch')[9]?.attributes('data-c')).toBe('unknown')
    expect(wrapper.find('.qs-id').attributes('aria-label')).toContain('not read')
  })

  it('does not claim a check digit result when the ID is incomplete', () => {
    const wrapper = mount(ContainerId, {
      props: {
        reading: reading({
          value: 'APHU65868?',
          certainty: 'Likely',
          checkDigitValid: false,
          observedCheckDigit: null,
        }),
      },
    })
    expect(wrapper.text()).toContain('ID incomplete')
    expect(wrapper.text()).not.toContain('does not match')
  })

  it('shows an uncertain position with the uncertain underline', () => {
    const wrapper = mount(ContainerId, {
      props: {
        reading: reading({
          certainty: 'Uncertain',
          positionCertainty: [
            'Confident',
            'Confident',
            'Confident',
            'Confident',
            'Confident',
            'Confident',
            'Uncertain',
            'Confident',
            'Confident',
            'Confident',
            'Confident',
          ],
        }),
      },
    })
    const chars = wrapper.findAll('.qs-id__ch')
    expect(chars[6]?.attributes('data-c')).toBe('uncertain')
    expect(chars[5]?.attributes('data-c')).toBeUndefined()
    expect(wrapper.find('.qs-id').attributes('aria-label')).toContain('uncertain')
  })
})

describe('ContainerId check digit display', () => {
  it('shows the printed ID with a flagged invalid check digit and the calculated digit beside it', () => {
    const reading = buildContainerIdReading({ printed: 'APHU6586848', certainty: 'Likely' })
    const wrapper = mount(ContainerId, { props: { reading } })
    expect(wrapper.find('.qs-id').text()).toContain('APHU658684')
    expect(wrapper.text()).toContain('Check digit does not match')
    expect(wrapper.text()).toContain('Calculated 7')
  })

  it('does not show a second check digit when the observed one matches', () => {
    const reading = buildContainerIdReading({ printed: 'APHU6586847', certainty: 'Confident' })
    const wrapper = mount(ContainerId, { props: { reading } })
    expect(wrapper.text()).toContain('Check digit valid')
    expect(wrapper.text()).not.toContain('Calculated')
  })
})
