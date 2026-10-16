import { describe, it, expect } from 'vitest'
import {
  defaultModelFor,
  findModel,
  isMovingTarget,
  labelsFor,
  providers,
  supportsBox,
} from '../providers'

describe('provider catalogue: box support', () => {
  it('treats only jev-1.14.0 as box-capable among the offered models', () => {
    expect(supportsBox('jev', 'jev-1.14.0')).toBe(true)
    expect(supportsBox('jev', 'jev-1.13.0')).toBe(false)
    expect(supportsBox('jev', 'jev-latest')).toBe(false)
    expect(supportsBox('luna', 'gpt-6-luna')).toBe(false)
  })

  it('never infers box support from a model id the catalogue does not list', () => {
    expect(supportsBox('jev', 'jev-preview')).toBe(false)
    expect(supportsBox('jev', 'jev-1.14.7')).toBe(false)
    expect(supportsBox('luna', 'jev-1.14.0')).toBe(false)
  })
})

describe('provider catalogue: moving targets', () => {
  it('marks jev-latest as a moving target and the pinned models as fixed', () => {
    expect(isMovingTarget('jev', 'jev-latest')).toBe(true)
    expect(isMovingTarget('jev', 'jev-1.14.0')).toBe(false)
    expect(isMovingTarget('jev', 'jev-1.13.0')).toBe(false)
    expect(isMovingTarget('luna', 'gpt-6-luna')).toBe(false)
  })

  it('does not call an unlisted model a moving target', () => {
    expect(isMovingTarget('jev', 'jev-preview')).toBe(false)
  })
})

describe('provider catalogue: model declarations', () => {
  const models = providers.flatMap((p) => p.models.map((m) => ({ provider: p.id, ...m })))

  it('offers the same models as before, each with a maker, route and wire format', () => {
    expect(models.map((m) => [m.provider, m.id, m.maker, m.route, m.wireFormat])).toEqual([
      ['luna', 'gpt-6-luna', 'OpenAI', 'direct', 'openai-decisions'],
      ['jev', 'jev-latest', 'TypeSafe', 'direct', 'typesafe-system-one'],
      ['jev', 'jev-1.14.0', 'TypeSafe', 'direct', 'typesafe-system-one'],
      ['jev', 'jev-1.13.0', 'TypeSafe', 'direct', 'typesafe-system-one'],
    ])
  })

  it('keeps the recommended default per provider: gpt-6-luna for Luna, jev-latest for Jev', () => {
    expect(defaultModelFor('luna')).toBe('gpt-6-luna')
    expect(defaultModelFor('jev')).toBe('jev-latest')
    for (const provider of providers) {
      expect(provider.models.filter((m) => m.recommended)).toHaveLength(1)
    }
  })

  it('gives every Jev model 256–1,568 px per side and 78,400–2,458,624 px in total', () => {
    for (const id of ['jev-latest', 'jev-1.14.0', 'jev-1.13.0']) {
      expect(findModel('jev', id)?.photoLimits).toEqual({
        maxSide: 1568,
        minSide: 256,
        maxPixels: 2_458_624,
        minPixels: 78_400,
      })
    }
  })

  it('gives Luna up to 2,048 px on the long side and no other limit', () => {
    expect(findModel('luna', 'gpt-6-luna')?.photoLimits).toEqual({
      maxSide: 2048,
      minSide: 0,
      maxPixels: null,
      minPixels: 0,
    })
  })

  it('labels a run for each screen from the catalogue', () => {
    expect(labelsFor('luna', 'gpt-6-luna')).toEqual({
      provider: 'GPT-6 Luna',
      ledger: 'OpenAI · GPT-6 Luna',
      prose: 'OpenAI GPT-6 Luna',
    })
    expect(labelsFor('jev', 'jev-1.14.0')).toEqual({
      provider: 'Jev',
      ledger: 'TypeSafe · Jev',
      prose: 'TypeSafe Jev',
    })
  })

  it('still names the provider for a model the catalogue no longer lists', () => {
    expect(labelsFor('jev', 'jev-preview')).toEqual({
      provider: 'Jev',
      ledger: 'TypeSafe · Jev',
      prose: 'TypeSafe Jev',
    })
  })

  it('finds only models the provider offers', () => {
    expect(findModel('luna', 'jev-latest')).toBeUndefined()
    expect(findModel('jev', 'jev-1.13.0')?.label).toBe('jev-1.13.0 (pinned)')
  })
})
