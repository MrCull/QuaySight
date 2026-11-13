import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DoorFace from '../DoorFace.vue'

const paint = { id: { text: 'PRKU 010052', check: '0', state: undefined } }

describe('DoorFace', () => {
  it('draws doors on a box, and the tank end with no doors on a tank, readings in the same place', () => {
    const doors = mount(DoorFace, { props: { paint, label: 'doors' } })
    expect(doors.findAll('.qs-door__leaf')).toHaveLength(2)
    expect(doors.find('.qs-door__tank').exists()).toBe(false)

    const tank = mount(DoorFace, { props: { paint, label: 'tank', tank: true } })
    expect(tank.find('.qs-door__tank').exists()).toBe(true)
    expect(tank.findAll('.qs-door__bar')).toHaveLength(0)
    // Same slots, moved into the middle of the round head.
    expect(tank.find('.qs-door__paint').attributes('x')).toBe('350')
    expect(tank.find('.qs-door__paint').element.closest('g')!.getAttribute('transform')).toBe(
      'translate(-145 60)',
    )
    expect(doors.find('.qs-door__paint').element.closest('g')!.getAttribute('transform')).toBeNull()
  })
})
