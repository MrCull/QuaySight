import { describe, it, expect } from 'vitest'
import { providers, defaultModelFor } from '../providers'
import { runRecordedInspection } from '../recordedRun'

describe('provider catalogue', () => {
  it('lists Luna and Jev, each with exactly one recommended default model', () => {
    expect(providers.map((p) => p.name)).toEqual(['GPT-6 Luna', 'Jev'])
    for (const provider of providers) {
      const recommended = provider.models.filter((m) => m.recommended)
      expect(recommended).toHaveLength(1)
      expect(defaultModelFor(provider.id)).toBe(recommended[0]?.id)
    }
  })
})

describe('recorded inspection run', () => {
  it('produces a shared record attributed to the chosen provider and model, marked recorded', async () => {
    const record = await runRecordedInspection('luna', { delayMs: 0 })
    expect(record.source).toBe('recorded')
    expect(record.provider).toBe('luna')
    expect(record.model).toBe('gpt-6-luna')
    expect(record.status).toBe('complete')
    expect(record.containerId?.value).toBe('APHU6586847')
    expect(record.containerId?.checkDigitValid).toBe(true)
    expect(record.containerId?.certainty).toBe('Confident')
  })

  it('uses the Jev fixture for Jev, not the Luna one', async () => {
    const record = await runRecordedInspection('jev', { delayMs: 0 })
    expect(record.provider).toBe('jev')
    expect(record.model).toBe('jev-1.14.0')
    expect(record.containerId?.certainty).toBe('Likely')
  })

  it('uses only the five fixed certainty words', async () => {
    const allowed = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']
    for (const provider of ['luna', 'jev'] as const) {
      const record = await runRecordedInspection(provider, { delayMs: 0 })
      expect(allowed).toContain(record.containerId?.certainty)
    }
  })
})

describe('recorded damage assessment', () => {
  it('replays the side-damage fixture for Luna and no damage for Jev, which captured none', async () => {
    const luna = await runRecordedInspection('luna', { delayMs: 0 })
    expect(luna.damage?.findings).toHaveLength(1)
    expect(luna.damage?.photos).toEqual([{ photo: 'side-dented-grey.jpg', face: 'long-side' }])
    const jev = await runRecordedInspection('jev', { delayMs: 0 })
    expect(jev.damage).toBeNull()
  })
})
