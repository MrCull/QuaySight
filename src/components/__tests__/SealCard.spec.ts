import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { recordedInspection } from '../../__tests__/recordedInspection'
import type { SealReading } from '../../domain/sealFamily'
import ResultsPanel from '../ResultsPanel.vue'

const BOX = { left: 0.4, right: 0.6, top: 0.45, bottom: 0.55, confidence: 0.9 }
const char = (
  value: string | null,
  certainty: 'Confident' | 'Likely' | "Can't tell" = 'Confident',
) => ({
  value,
  certainty,
})

const READ: SealReading = {
  visible: true,
  characters: [...'4217095'].map((c) => char(c)),
  value: '4217095',
  certainty: 'Confident',
  box: BOX,
}
const PARTLY: SealReading = {
  visible: true,
  characters: [char('4'), char('2'), char(null, "Can't tell"), char('7', 'Likely')],
  value: '42?7',
  certainty: 'Uncertain',
}
const NONE: SealReading = { visible: false, characters: [], value: '', certainty: 'Not seen' }

async function mounted(seal: SealReading | undefined, photoUrl: string | null = 'blob:door') {
  const store = useInspectionStore()
  const base = await recordedInspection('luna', { delayMs: 0 })
  store.record = { ...base, seal }
  store.status = 'complete'
  store.photo = photoUrl ? { name: 'door.jpg', url: photoUrl, orientation: 'landscape' } : null
  return mount(ResultsPanel)
}

describe('the Seal card', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows a seal that was read character by character, with its certainty and crop', async () => {
    const card = (await mounted(READ)).get('.rs-seal')
    expect(card.text()).toContain('Seal')
    expect(
      card
        .findAll('.qs-id__ch')
        .map((c) => c.text())
        .join(''),
    ).toBe('4217095')
    expect(card.get('.qs-cert').text()).toContain('Confident')
    expect(card.get('.rs-crop figcaption').text()).toBe('Where we read the seal · Photo 1')
    expect(card.get('.rs-crop img').attributes('src')).toBe('blob:door')
  })

  it('has no check digit, and no verdict about the seal', async () => {
    const card = (await mounted(READ)).get('.rs-seal')
    expect(card.find('.qs-id__check').exists()).toBe(false)
    expect(card.text().toLowerCase()).not.toMatch(/check digit|sealed|intact|safe|verified/)
  })

  it('marks the characters it could not read, each with its own certainty', async () => {
    const card = (await mounted(PARTLY)).get('.rs-seal')
    const chars = card.findAll('.qs-id__ch')
    expect(chars.map((c) => c.text()).join('')).toBe('42?7')
    expect(chars.map((c) => c.attributes('data-c'))).toEqual([
      undefined,
      undefined,
      'unknown',
      'likely',
    ])
    expect(card.get('.qs-cert').text()).toContain('Uncertain')
    expect(card.find('.rs-crop').exists()).toBe(false)
  })

  it('says Not seen when no seal is visible', async () => {
    const card = (await mounted(NONE)).get('.rs-seal')
    expect(card.get('.qs-cert').text()).toContain('Not seen')
    expect(card.find('.qs-id').exists()).toBe(false)
    expect(card.find('.rs-crop').exists()).toBe(false)
  })

  it('says the number could not be read when a seal is seen but no character was read', async () => {
    const card = (
      await mounted({ ...PARTLY, characters: [], value: '', certainty: "Can't tell" })
    ).get('.rs-seal')
    expect(card.get('.qs-cert').text()).toContain("Can't tell")
    expect(card.text()).toContain('number not readable')
  })

  it('is absent when the seal was not assessed', async () => {
    expect((await mounted(undefined)).find('.rs-seal').exists()).toBe(false)
  })

  it('arrives with the rest of the card stack', async () => {
    expect((await mounted(READ)).get('.rs-seal').classes()).toContain('qs-rise')
  })
})
