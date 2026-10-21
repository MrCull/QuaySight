import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SchematicFigure from '../SchematicFigure.vue'
import DamageView from '../DamageView.vue'
import { recordedSideDamage } from '../../../__tests__/handWrittenDamage'

// The drawing is to the container's length (ticket #46): the long side's extent along the length axis is
// in proportion 20 : 40 : 45 and the drawing stays inside the same box.

const base = {
  id: 'rear-right',
  caption: 'Door end and right side',
  noPhotos: false,
  side: { text: 'Right side', status: 'photographed' as const },
  end: { text: 'Rear doors', status: 'photographed' as const },
  roof: true,
  markers: [],
  selectedId: null,
}

function points(wrapper: ReturnType<typeof mount>, cls: string): [number, number][] {
  const raw = wrapper.find(`polygon.${cls}`).attributes('points')!
  return raw.split(' ').map((p) => p.split(',').map(Number) as [number, number])
}

/** The long side's extent along the length axis: its top-left corner to its top-right corner. */
function longSide(lengthFt?: number) {
  const wrapper = mount(SchematicFigure, { props: { ...base, lengthFt } as never })
  const [a, b] = points(wrapper, 'qs-c-side')
  const all = [
    ...points(wrapper, 'qs-c-side'),
    ...points(wrapper, 'qs-c-end'),
    ...points(wrapper, 'qs-c-top'),
  ]
  return { run: b![0] - a![0], xs: all.map((p) => p[0]), wrapper }
}

describe('SchematicFigure length', () => {
  it('draws the long side in proportion to 20, 40 and 45 ft', () => {
    const l20 = longSide(20).run
    const l40 = longSide(40).run
    const l45 = longSide(45).run
    expect(l40 / l20).toBeCloseTo(2, 2)
    expect(l45 / l40).toBeCloseTo(45 / 40, 2)
  })

  it('draws 40 ft when no length is given', () => {
    expect(longSide(undefined).run).toBeCloseTo(longSide(40).run, 5)
  })

  it('keeps the end face the same size at every length, and inside the 900 wide box', () => {
    const widthOfEnd = (ft: number) => {
      const p = points(longSide(ft).wrapper, 'qs-c-end')
      return Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]))
    }
    expect(widthOfEnd(20)).toBeCloseTo(widthOfEnd(45), 5)
    for (const ft of [20, 40, 45]) {
      const { xs } = longSide(ft)
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...xs)).toBeLessThanOrEqual(900)
    }
  })

  it("draws the assessment's length in the damage view", () => {
    const wrapper = mount(DamageView, {
      props: { assessment: { ...recordedSideDamage, lengthFt: 20 } },
    })
    const wide = mount(DamageView, {
      props: { assessment: { ...recordedSideDamage, lengthFt: 45 } },
    })
    const run = (w: typeof wrapper) => {
      const pts = w
        .find('figure[data-view="rear-right"] polygon.qs-c-side')
        .attributes('points')!
        .split(' ')
        .map((p) => Number(p.split(',')[0]))
      return pts[1]! - pts[0]!
    }
    expect(run(wide) / run(wrapper)).toBeCloseTo(45 / 20, 2)
  })

  it('draws 5 sections on a 20 ft long side and 10 on a 40 or 45 ft one', () => {
    const count = (ft?: number) =>
      mount(SchematicFigure, { props: { ...base, lengthFt: ft } as never }).findAll('.qs-c-section')
        .length
    expect(count(20)).toBe(5)
    expect(count(40)).toBe(10)
    expect(count(45)).toBe(10)
    expect(count(undefined)).toBe(10)
  })

  it('draws the sections in the damage view when the side is defaulted', () => {
    const sections = (ft: 20 | 40) =>
      mount(DamageView, { props: { assessment: { ...recordedSideDamage, lengthFt: ft } } }).findAll(
        'figure[data-view="rear-right"] .qs-c-section',
      ).length
    expect(sections(20)).toBe(5)
    expect(sections(40)).toBe(10)
  })

  it('draws no sections on a long side that was not seen', () => {
    const wrapper = mount(SchematicFigure, {
      props: { ...base, side: { text: 'Left side · Not seen', status: 'not-seen' } } as never,
    })
    expect(wrapper.findAll('.qs-c-section')).toHaveLength(0)
  })
})
