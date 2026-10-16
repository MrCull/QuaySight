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
  it('treats Jev latest and Jev 1.14 through OpenRouter as box-capable, and nothing else', () => {
    expect(supportsBox('openrouter', '~typesafe/jev-latest')).toBe(true)
    expect(supportsBox('openrouter', 'typesafe/jev-1.14')).toBe(true)
    expect(supportsBox('openrouter', 'typesafe/jev-1.13')).toBe(false)
    expect(supportsBox('luna', 'gpt-6-luna')).toBe(false)
    expect(supportsBox('openrouter', 'openai/gpt-6-luna-decisions')).toBe(false)
  })

  it('never infers box support from a model id the catalogue does not list', () => {
    expect(supportsBox('openrouter', 'typesafe/jev-1.14-20261014')).toBe(false)
    expect(supportsBox('openrouter', 'jev-1.14.0')).toBe(false)
    expect(supportsBox('luna', 'typesafe/jev-1.14')).toBe(false)
  })
})

describe('provider catalogue: moving targets', () => {
  it('marks Jev latest as a moving target and the pinned models as fixed', () => {
    expect(isMovingTarget('openrouter', '~typesafe/jev-latest')).toBe(true)
    expect(isMovingTarget('openrouter', 'typesafe/jev-1.14')).toBe(false)
    expect(isMovingTarget('openrouter', 'typesafe/jev-1.13')).toBe(false)
    expect(isMovingTarget('luna', 'gpt-6-luna')).toBe(false)
  })

  it('does not call an unlisted model a moving target', () => {
    expect(isMovingTarget('openrouter', '~typesafe/jev-preview')).toBe(false)
  })
})

describe('provider catalogue: model declarations', () => {
  const models = providers.flatMap((p) => p.models.map((m) => ({ provider: p.id, ...m })))

  it('offers OpenAI direct, and Jev and GPT-6 Luna Decisions through OpenRouter, and no direct TypeSafe route', () => {
    expect(models.map((m) => [m.provider, m.id, m.maker, m.route, m.wireFormat])).toEqual([
      ['openrouter', '~typesafe/jev-latest', 'TypeSafe', 'openrouter', 'openrouter-decisions'],
      ['openrouter', 'typesafe/jev-1.14', 'TypeSafe', 'openrouter', 'openrouter-decisions'],
      ['openrouter', 'typesafe/jev-1.13', 'TypeSafe', 'openrouter', 'openrouter-decisions'],
      ['openrouter', 'openai/gpt-6-luna-decisions', 'OpenAI', 'openrouter', 'openrouter-decisions'],
      ['luna', 'gpt-6-luna', 'OpenAI', 'direct', 'openai-decisions'],
    ])
    expect(models.some((m) => m.wireFormat === 'typesafe-system-one')).toBe(false)
  })

  it('offers OpenRouter first, then OpenAI', () => {
    expect(providers.map((p) => [p.id, p.name, p.vendor])).toEqual([
      ['openrouter', 'OpenRouter', 'OpenRouter'],
      ['luna', 'OpenAI', 'OpenAI'],
    ])
  })

  it('labels every model in the selector by maker and route, Jev latest as the moving target', () => {
    expect(models.map((m) => labelsFor(m.provider, m.id).option)).toEqual([
      'Jev latest (TypeSafe) via OpenRouter · recommended, moving target',
      'Jev 1.14 (TypeSafe) via OpenRouter · pinned',
      'Jev 1.13 (TypeSafe) via OpenRouter · pinned',
      'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      'GPT-6 Luna (OpenAI) direct · pinned',
    ])
  })

  it('keeps the recommended default per provider: gpt-6-luna for OpenAI, Jev latest for OpenRouter', () => {
    expect(defaultModelFor('luna')).toBe('gpt-6-luna')
    expect(defaultModelFor('openrouter')).toBe('~typesafe/jev-latest')
    for (const provider of providers) {
      expect(provider.models.filter((m) => m.recommended)).toHaveLength(1)
    }
  })

  it('gives every Jev model 256–1,568 px per side and 78,400–2,458,624 px in total', () => {
    for (const id of ['~typesafe/jev-latest', 'typesafe/jev-1.14', 'typesafe/jev-1.13']) {
      expect(findModel('openrouter', id)?.photoLimits).toEqual({
        maxSide: 1568,
        minSide: 256,
        maxPixels: 2_458_624,
        minPixels: 78_400,
      })
    }
  })

  it('gives Luna, direct or through OpenRouter, up to 2,048 px on the long side and no other limit', () => {
    for (const [provider, id] of [
      ['luna', 'gpt-6-luna'],
      ['openrouter', 'openai/gpt-6-luna-decisions'],
    ] as const) {
      expect(findModel(provider, id)?.photoLimits).toEqual({
        maxSide: 2048,
        minSide: 0,
        maxPixels: null,
        minPixels: 0,
      })
    }
  })

  it('labels a direct run by its maker and model', () => {
    expect(labelsFor('luna', 'gpt-6-luna')).toEqual({
      option: 'GPT-6 Luna (OpenAI) direct · pinned',
      route: 'OpenAI',
      provider: 'GPT-6 Luna',
      ledger: 'OpenAI · GPT-6 Luna',
      prose: 'OpenAI GPT-6 Luna',
      model: 'GPT-6 Luna',
    })
  })

  it('labels an OpenRouter run by model, maker and route on every screen', () => {
    expect(labelsFor('openrouter', 'typesafe/jev-1.14')).toEqual({
      option: 'Jev 1.14 (TypeSafe) via OpenRouter · pinned',
      route: 'TypeSafe via OpenRouter',
      provider: 'Jev 1.14 (TypeSafe) via OpenRouter',
      ledger: 'Jev 1.14 (TypeSafe) via OpenRouter',
      prose: 'Jev 1.14 (TypeSafe) via OpenRouter',
      model: 'Jev 1.14',
    })
    expect(labelsFor('openrouter', '~typesafe/jev-latest').provider).toBe(
      'Jev latest (TypeSafe) via OpenRouter',
    )
    expect(labelsFor('openrouter', 'openai/gpt-6-luna-decisions')).toEqual({
      option: 'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      route: 'OpenAI via OpenRouter',
      provider: 'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      ledger: 'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      prose: 'GPT-6 Luna Decisions (OpenAI) via OpenRouter',
      model: 'GPT-6 Luna Decisions',
    })
  })

  it('still names the provider for a model the catalogue no longer lists', () => {
    expect(labelsFor('openrouter', 'typesafe/jev-0.9')).toEqual({
      option: 'typesafe/jev-0.9 via OpenRouter',
      route: 'OpenRouter',
      provider: 'typesafe/jev-0.9 via OpenRouter',
      ledger: 'typesafe/jev-0.9 via OpenRouter',
      prose: 'typesafe/jev-0.9 via OpenRouter',
      model: 'typesafe/jev-0.9',
    })
  })

  it('finds only models the provider offers', () => {
    expect(findModel('luna', '~typesafe/jev-latest')).toBeUndefined()
    expect(findModel('openrouter', 'typesafe/jev-1.13')?.displayName).toBe('Jev 1.13')
  })

  it('labels each key field for the one endpoint that receives it', () => {
    const openrouter = providers.find((p) => p.id === 'openrouter')!
    expect(openrouter.keyField.label).toBe('OpenRouter API key')
    expect(openrouter.keyField.hint).toMatch(/go only to OpenRouter's Decisions endpoint/)
    const luna = providers.find((p) => p.id === 'luna')!
    expect(luna.keyField.label).toBe('OpenAI API key')
  })
})
