import { test, expect } from '@playwright/test'
import { buildIndex, certaintyLabelsIn, shotFileName } from './indexBuilder'

test.describe('buildIndex', () => {
  const base = {
    screen: 'results',
    steps: ['Open /', 'Click Start inspection'],
    certaintyLabels: ['Confident'] as const,
    motion: 'frozen' as const,
  }

  test('derives each file name from state and viewport and sorts by file name', () => {
    const index = buildIndex([
      { ...base, state: 'luna-result', viewport: { width: 1440, height: 900 } },
      { ...base, state: 'first-load', viewport: { width: 390, height: 844 } },
    ])
    expect(index.count).toBe(2)
    expect(index.shots.map((s) => s.file)).toEqual([
      'first-load-390x844.png',
      'luna-result-1440x900.png',
    ])
    expect(index.shots[1]).toMatchObject({
      file: 'luna-result-1440x900.png',
      screen: 'results',
      state: 'luna-result',
      viewport: { width: 1440, height: 900 },
      steps: ['Open /', 'Click Start inspection'],
      certaintyLabels: ['Confident'],
      motion: 'frozen',
    })
  })

  test('an empty run gives an empty index, not an error', () => {
    expect(buildIndex([])).toEqual({ count: 0, shots: [] })
  })
})

test.describe('shotFileName', () => {
  test('is state then viewport, for example luna-result-1440x900.png', () => {
    expect(shotFileName('luna-result', { width: 1440, height: 900 })).toBe(
      'luna-result-1440x900.png',
    )
  })

  test('keeps the state name as given (already lower-case and hyphenated)', () => {
    expect(shotFileName('manifest-error', { width: 390, height: 844 })).toBe(
      'manifest-error-390x844.png',
    )
  })
})

test.describe('certaintyLabelsIn', () => {
  test('keeps only the five fixed words, in canonical order, without duplicates', () => {
    const texts = ['Likely', 'Confident', 'Likely', 'Not seen', 'Some other label']
    expect(certaintyLabelsIn(texts)).toEqual(['Confident', 'Likely', 'Not seen'])
  })

  test("matches Can't tell with a typographic apostrophe too", () => {
    expect(certaintyLabelsIn(['Can’t tell'])).toEqual(["Can't tell"])
  })

  test('ignores lower-case prose that merely contains a status word', () => {
    expect(certaintyLabelsIn(['what remains uncertain', 'confident guess'])).toEqual([])
  })
})
