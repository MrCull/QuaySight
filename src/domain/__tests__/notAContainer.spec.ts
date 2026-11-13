import { describe, expect, it } from 'vitest'
import { bananaPhotos, mockingCase, notAContainerCount, notAContainerWords } from '../notAContainer'
import type { InspectionRecord } from '../inspection'
import type { PhotoSummary } from '../combinePhotos'

const face = (f: 'not-container' | 'rear-doors') =>
  ({
    photoFace: { face: f, probability: 0.9, certainty: 'Confident' },
  }) as unknown as InspectionRecord

const summary = (dropped: boolean) => ({ dropped }) as PhotoSummary
const several = (...dropped: boolean[]) =>
  ({ photos: dropped.map(summary) }) as unknown as InspectionRecord

describe('notAContainerCount', () => {
  it('is 1 for one photo that is not a container', () => {
    expect(notAContainerCount(face('not-container'), 1)).toBe(1)
  })

  it('is 0 for one photo of a container, or no result', () => {
    expect(notAContainerCount(face('rear-doors'), 1)).toBe(0)
    expect(notAContainerCount(null, 1)).toBe(0)
  })

  it('counts several photos only when every one is not a container', () => {
    expect(notAContainerCount(several(true, true, true), 3)).toBe(3)
    expect(notAContainerCount(several(true, false, true), 3)).toBe(0)
  })

  it('is 0 while some photos have no summary yet', () => {
    expect(notAContainerCount(several(true, true), 3)).toBe(0)
  })
})

describe('notAContainerWords', () => {
  it('words one photo', () => {
    const w = notAContainerWords(1)
    expect(w.stamps).toEqual(['REJECTED'])
    expect(w.achievement).toBe('Wannabe QA')
    expect(w.combo).toBeNull()
    expect(w.tally).toBeNull()
    expect(w.xp).toBe(1)
    expect(w.next.shown).toBe('wHaT aRe YoU gOiNg To Do NeXt, A bAnAnA sKiN?')
    expect(w.id.owner).toBe('TROL')
    expect(w.respawn).toBe('Respawn with a real container')
  })

  it('words three photos', () => {
    const w = notAContainerWords(3)
    expect(w.stamps).toEqual(['REJECTED', 'REJECTED', 'ALSO NO'])
    expect(w.achievement).toBe('Wannabe QA x3')
    expect(w.combo).toBe('COMBO x3')
    expect(w.tally).toBe('3 photos · 0 containers · 3 rejections')
    expect(w.tags).toEqual(['Owner: TROL', 'Registered: three times', '6-7'])
    expect(w.xp).toBe(3)
    expect(w.next.shown).toBe('fIvE pHoToS oF bAnAnA sKiNs?')
  })

  it('jokes about the limit at five photos', () => {
    expect(notAContainerWords(5).next.plain).toBe('Six photos of banana skins? The limit is five.')
  })
})

describe('mockingCase', () => {
  it('alternates letters and skips everything else', () => {
    expect(mockingCase('ab, cd!')).toBe('aB, cD!')
  })
})

describe('the banana Easter egg', () => {
  it('reads a banana per photo from the survey', () => {
    const one = {
      photoFace: { face: 'not-container', probability: 0.9, certainty: 'Confident', banana: true },
    } as unknown as InspectionRecord
    expect(bananaPhotos(one, 1)).toEqual([true])
    const two = {
      photos: [{ face: { banana: true } }, { face: { face: 'not-container' } }],
    } as unknown as InspectionRecord
    expect(bananaPhotos(two, 2)).toEqual([true, false])
  })

  it('turns the screen gold for one banana skin', () => {
    const w = notAContainerWords(1, [true])
    expect(w.banana).toBe(true)
    expect(w.stamps).toEqual(['A-PEEL DENIED'])
    expect(w.id.owner).toBe('PEEL')
    expect(w.taunt?.mocking).toBe('oKaY yOu AcTuAlLy DiD iT')
    expect(w.rarity).toBe('Legendary')
    expect(w.achievement).toBe('Banana skin')
    expect(w.xp).toBe(10)
    expect(w.xpPercent).toBe(100)
    expect(w.nextTitle).toBe('Next up: An actual container')
    expect(w.respawn).toBe('Slip back to a real container')
  })

  it('stamps only the banana photos A-PEEL DENIED among several', () => {
    const w = notAContainerWords(3, [false, true, false])
    expect(w.stamps).toEqual(['REJECTED', 'A-PEEL DENIED', 'ALSO NO'])
    expect(w.combo).toBe('COMBO x3')
  })

  it('stays the plain screen with no banana', () => {
    expect(notAContainerWords(2, [false, false]).banana).toBe(false)
  })
})
