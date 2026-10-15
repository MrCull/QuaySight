import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { buildContainerIdReading } from '../../domain/containerId'
import ContainerId from '../ContainerId.vue'

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
