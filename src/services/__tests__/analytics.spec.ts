// Google Analytics (docs/adr/0002-*): the tag loads only on the production domain with a build-time
// Measurement ID, and every event carries only its own non-sensitive fields.
import { describe, it, expect, beforeEach, vi } from 'vitest'

// A fresh module per test: whether the tag is on is module state, set once per page load.
let initAnalytics: typeof import('../analytics').initAnalytics
let track: typeof import('../analytics').track

const ID = 'G-TEST000000'

function tagScripts(): HTMLScriptElement[] {
  return [...document.querySelectorAll<HTMLScriptElement>('script[src*="googletagmanager"]')]
}

/** What reached GA's queue, as plain arrays (gtag pushes `arguments` objects). */
function queued(): unknown[][] {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>))
}

describe('analytics', () => {
  beforeEach(async () => {
    delete window.dataLayer
    delete window.gtag
    tagScripts().forEach((s) => s.remove())
    vi.resetModules()
    ;({ initAnalytics, track } = await import('../analytics'))
  })

  it.each(['quay-sight.com', 'www.quay-sight.com'])('loads the Google tag on %s', (host) => {
    expect(initAnalytics(ID, host)).toBe(true)

    const [script] = tagScripts()
    expect(tagScripts()).toHaveLength(1)
    expect(script!.async).toBe(true)
    expect(script!.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(queued()).toEqual([
      ['js', expect.any(Date)],
      ['config', ID],
    ])
  })

  it.each([
    ['no Measurement ID', '', 'quay-sight.com'],
    ['an undefined Measurement ID', undefined, 'quay-sight.com'],
    ['localhost (dev, Playwright)', ID, 'localhost'],
    ['the default Azure address', ID, 'polite-pond-07ced2110.westeurope.azurestaticapps.net'],
    ['a PR preview', ID, 'polite-pond-07ced2110-131.westeurope.azurestaticapps.net'],
    ['a look-alike domain', ID, 'quay-sight.com.example.net'],
  ])('stays off with %s', (_, id, host) => {
    expect(initAnalytics(id, host)).toBe(false)

    expect(tagScripts()).toHaveLength(0)
    expect(window.dataLayer).toBeUndefined()
  })

  it('loads once, however often it is called', () => {
    initAnalytics(ID, 'quay-sight.com')
    initAnalytics(ID, 'quay-sight.com')

    expect(tagScripts()).toHaveLength(1)
  })

  it('drops every event while the tag is off', () => {
    initAnalytics('', 'quay-sight.com')

    track({ name: 'demo_started' })

    expect(window.dataLayer).toBeUndefined()
  })

  it('sends each event with exactly its own fields', () => {
    initAnalytics(ID, 'quay-sight.com')

    track({ name: 'demo_started' })
    track({ name: 'provider_selected', provider: 'luna' })
    track({ name: 'inspection_started', mode: 'live', photo_count: 3, provider: 'openrouter' })
    track({ name: 'inspection_finished', mode: 'demo' })
    track({ name: 'spend_cap_hit', mode: 'live', reason: 'spend' })
    track({ name: 'not_a_container', photo_count: 2 })
    track({ name: 'banana_skin', photo_count: 2, banana_count: 1 })

    expect(queued().slice(2)).toEqual([
      ['event', 'demo_started', {}],
      ['event', 'provider_selected', { provider: 'luna' }],
      ['event', 'inspection_started', { mode: 'live', photo_count: 3, provider: 'openrouter' }],
      ['event', 'inspection_finished', { mode: 'demo' }],
      ['event', 'spend_cap_hit', { mode: 'live', reason: 'spend' }],
      ['event', 'not_a_container', { photo_count: 2 }],
      ['event', 'banana_skin', { photo_count: 2, banana_count: 1 }],
    ])
  })

  it('leaves out a field an event does not have', () => {
    initAnalytics(ID, 'quay-sight.com')

    track({ name: 'inspection_started', mode: 'demo', photo_count: 2 })

    expect(queued()[queued().length - 1]).toEqual([
      'event',
      'inspection_started',
      { mode: 'demo', photo_count: 2 },
    ])
  })

  it('never forwards a field outside the event, even one smuggled past the types', () => {
    initAnalytics(ID, 'quay-sight.com')

    const smuggled = { name: 'provider_selected', provider: 'openrouter', apiKey: 'sk-or-secret' }
    track(smuggled as Parameters<typeof track>[0])

    expect(queued()[queued().length - 1]).toEqual([
      'event',
      'provider_selected',
      { provider: 'openrouter' },
    ])
    expect(JSON.stringify(queued())).not.toContain('sk-or-secret')
  })
})
