import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { runRecordedInspection } from '../../domain/recordedRun'
import type { ContainerIdReading, InspectionRecord } from '../../domain/inspection'
import ResultsPanel from '../ResultsPanel.vue'

const FORBIDDEN =
  /\b(pass(es)?|refine(ment|d)?|candidates?|retr(y|ies|ied)|supported|verified|safe|confirmed|certified|user review)\b/i

async function withReading(containerId: Partial<ContainerIdReading>) {
  const store = useInspectionStore()
  const base = await runRecordedInspection('luna', { delayMs: 0 })
  const record: InspectionRecord = {
    ...base,
    containerId: { ...base.containerId!, ...containerId },
  }
  store.record = record
  store.status = 'complete'
  return mount(ResultsPanel)
}

describe('ResultsPanel result states', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows at most two "Also possible" alternatives', async () => {
    const wrapper = await withReading({
      certainty: 'Likely',
      alternatives: ['APHU658841', 'APHU658842', 'APHU658843'],
    })
    const also = wrapper.findAll('.rs-also')
    expect(also.map((a) => a.text())).toEqual([
      'Also possible: APHU658841',
      'Also possible: APHU658842',
    ])
  })

  it('sets each alternative ID in the data face, grouped as owner, serial and check digit', async () => {
    const wrapper = await withReading({
      certainty: 'Likely',
      alternatives: ['PPHH8888847'],
    })
    const id = wrapper.get('.rs-also .qs-type-data')
    expect(id.text()).toBe('PPHH 888884 7')
    expect(wrapper.get('.rs-also').text()).toBe('Also possible: PPHH 888884 7')
  })

  it('shows the best interpretation and what remains uncertain for an uncertain result', async () => {
    const wrapper = await withReading({
      certainty: 'Uncertain',
      uncertainty: 'the last digits are hard to read; it could be 3,780 kg.',
    })
    expect(wrapper.text()).toContain('Best interpretation:')
    expect(wrapper.text()).toContain('APHU658684')
    expect(wrapper.text()).toContain('What remains uncertain:')
    expect(wrapper.text()).toContain('the last digits are hard to read')
  })

  it('explains insufficient evidence and suggests a closer photo, with no input requested', async () => {
    const wrapper = await withReading({
      value: '???????????',
      certainty: "Can't tell",
      checkDigitValid: false,
      observedCheckDigit: null,
    })
    expect(wrapper.text()).toContain('A closer photo of the door markings may help.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('never uses pass, refinement, candidate or retry wording', async () => {
    const wrapper = await withReading({
      certainty: 'Uncertain',
      alternatives: ['APHU658841'],
      uncertainty: 'the last digit is hard to read.',
    })
    expect(wrapper.text()).not.toMatch(FORBIDDEN)
  })
})
