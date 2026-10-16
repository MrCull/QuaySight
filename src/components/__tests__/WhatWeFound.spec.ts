import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { evaluateWeights } from '../../domain/weights'
import { liveWeightsRecord, coyuReading, read } from '../../__tests__/liveWeights'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { useUnits } from '../../composables/units'
import WhatWeFound from '../WhatWeFound.vue'

// The card renders the pure summary (domain/whatWeFound) as design-system/components/WhatWeFound:
// heading, headline, the caveats block first, what is missing, then one row per topic.

const FORBIDDEN =
  /\b(verified|verify|supported|safe|passed|passes|pass|candidates?|retry|retries|non-hazardous|undamaged)\b/i

describe('the What we found card', () => {
  beforeEach(() => {
    useUnits().set('metric')
    localStorage.clear()
  })

  it('shows the heading, a headline and one row per topic, with no caveat block when nothing is uncertain', async () => {
    const wrapper = mount(WhatWeFound, { props: { record: await liveWeightsRecord() } })
    expect(wrapper.get('.qs-found__k').text()).toBe('What we found')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(
      wrapper.get('.qs-found__k').attributes('id'),
    )
    expect(wrapper.get('.qs-found__headline').text()).toMatch(/^APHU 658684 7: /)
    expect(wrapper.findAll('.qs-found__topic').map((t) => t.text())).toEqual([
      'ID',
      'Type',
      'Weights',
      'Markings',
      'Damage',
    ])
    expect(wrapper.find('.qs-found__block').exists()).toBe(false)
  })

  it('puts the caveats above everything that was found', async () => {
    const weights = evaluateWeights(
      coyuReading({ maxGross: { metric: read(30480), imperial: read(67900) } }),
    )
    const wrapper = mount(WhatWeFound, {
      props: { record: { ...(await liveWeightsRecord()), weights } },
    })
    const html = wrapper.html()
    expect(wrapper.get('.qs-found__headline').text()).toBe('Some of what we found is uncertain')
    expect(wrapper.get('.qs-found__block .qs-found__label').text()).toBe('What remains uncertain')
    expect(wrapper.get('.qs-found__block').text()).toContain('kg and lb disagree')
    expect(html.indexOf('qs-found__block')).toBeLessThan(html.indexOf('qs-found__facts'))
  })

  it('says what is missing from a partial result in its own block, and leaves those parts out', async () => {
    const wrapper = mount(WhatWeFound, {
      props: {
        record: await liveWeightsRecord(),
        unavailable: { details: 'cancelled', damage: 'cancelled' },
      },
    })
    expect(wrapper.get('.qs-found__headline').text()).toBe('Here is what arrived')
    expect(wrapper.get('.qs-found__block .qs-found__label').text()).toBe('What is missing')
    expect(wrapper.get('.qs-found__block').text()).toContain(
      'Not finished: container details and damage.',
    )
    expect(wrapper.findAll('.qs-found__topic').map((t) => t.text())).toEqual(['ID'])
  })

  it('follows the units toggle', async () => {
    const record = await liveWeightsRecord()
    const metric = mount(WhatWeFound, { props: { record } })
    expect(metric.text()).toContain('30,480 kg')
    useUnits().set('imperial')
    const imperial = mount(WhatWeFound, { props: { record } })
    expect(imperial.text()).toContain('67,200 lb')
    expect(imperial.text()).not.toContain('30,480 kg')
  })

  it('stays out of the certainty, severity and hazard components, and uses no banned word', async () => {
    const record = await liveWeightsRecord()
    const wrapper = mount(WhatWeFound, { props: { record } })
    expect(wrapper.find('.qs-cert, .qs-sev, .qs-marking, .qs-glyph').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('reads a recorded sample, which has no details, weights breakdown or face', async () => {
    const wrapper = mount(WhatWeFound, { props: { record: await recordedInspection('luna') } })
    expect(wrapper.text()).toContain('were not assessed in this inspection')
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })

  it('is one qs-rise item, so it arrives with the rest of the readings', async () => {
    const wrapper = mount(WhatWeFound, { props: { record: await liveWeightsRecord() } })
    expect(wrapper.get('section').classes()).toEqual(
      expect.arrayContaining(['qs-found', 'qs-rise']),
    )
  })
})
