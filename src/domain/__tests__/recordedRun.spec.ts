import { describe, it, expect } from 'vitest'
import { providers, defaultModelFor } from '../providers'
import { runRecordedInspection } from '../recordedRun'

describe('provider catalogue', () => {
  it('lists OpenRouter and OpenAI, each with exactly one recommended default model', () => {
    expect(providers.map((p) => p.name)).toEqual(['OpenRouter', 'GPT-6 Luna'])
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
    const record = await runRecordedInspection('openrouter', { delayMs: 0 })
    expect(record.provider).toBe('openrouter')
    expect(record.model).toBe('typesafe/jev-1.14')
    expect(record.containerId?.certainty).toBe('Likely')
  })

  it('uses only the five fixed certainty words', async () => {
    const allowed = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']
    for (const provider of ['luna', 'openrouter'] as const) {
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
    const jev = await runRecordedInspection('openrouter', { delayMs: 0 })
    expect(jev.damage).toBeNull()
  })
})

describe('recorded run deterministic checks', () => {
  it('decodes the size code from the photo as a 40 ft High Cube, labelled decoded', async () => {
    const record = await runRecordedInspection('luna', { delayMs: 0 })
    expect(record.sizeCode?.code).toBe('45G1')
    expect(record.sizeCode?.summary).toBe('40 ft High Cube, general purpose')
    expect(record.sizeCode?.certainty).toBe('Confident')
  })

  it('keeps printed maximum gross and tare, and calculates payload as a separate labelled row', async () => {
    const record = await runRecordedInspection('luna', { delayMs: 0 })
    expect(record.weights?.maxGross).toEqual({
      valueKg: 32500,
      provenance: 'printed',
      certainty: 'Confident',
    })
    expect(record.weights?.tare).toEqual({
      valueKg: 3870,
      provenance: 'printed',
      certainty: 'Confident',
    })
    expect(record.weights?.payload).toEqual({
      valueKg: 28630,
      provenance: 'calculated',
      certainty: 'Confident',
    })
    expect(record.weights?.conflict).toBeNull()
  })

  it('shows no decoded size or weights for Jev, because no Jev response has been captured', async () => {
    const record = await runRecordedInspection('openrouter', { delayMs: 0 })
    expect(record.sizeCode).toBeNull()
    expect(record.weights?.maxGross).toBeNull()
    expect(record.weights?.payload).toBeNull()
  })
})
