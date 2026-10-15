import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CertaintyChip from '../CertaintyChip.vue'
import { CERTAINTY_LABELS } from '../../domain/certainty'

const GLYPH: Record<string, string> = {
  Confident: 'confident',
  Likely: 'likely',
  Uncertain: 'uncertain',
  "Can't tell": 'unknown',
  'Not seen': 'unseen',
}

describe('CertaintyChip', () => {
  it.each(CERTAINTY_LABELS)('shows the fixed label "%s" with its own glyph', (label) => {
    const wrapper = mount(CertaintyChip, { props: { level: label } })
    expect(wrapper.text()).toBe(label)
    expect(wrapper.find('i.qs-glyph').classes()).toContain(`qs-glyph--${GLYPH[label]}`)
    expect(wrapper.attributes('aria-label')).toContain(`Certainty: ${label}`)
  })

  it('gives each label a different glyph, so colour is never the only signal', () => {
    const glyphs = CERTAINTY_LABELS.map((label) => GLYPH[label])
    expect(new Set(glyphs).size).toBe(CERTAINTY_LABELS.length)
  })
})
