import { describe, expect, it } from 'vitest'
import { mockingCase, notAContainerCount, notAContainerWords } from '../notAContainer'
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
    expect(w.bananaMocking).toBe('wHaT aRe YoU gOiNg To Do NeXt, A bAnAnA sKiN?')
  })

  it('words three photos', () => {
    const w = notAContainerWords(3)
    expect(w.stamps).toEqual(['REJECTED', 'REJECTED', 'ALSO NO'])
    expect(w.achievement).toBe('Wannabe QA x3')
    expect(w.combo).toBe('COMBO x3')
    expect(w.tally).toBe('3 photos · 0 containers · 3 rejections')
    expect(w.registered).toBe('Registered: three times')
    expect(w.xp).toBe(3)
    expect(w.bananaMocking).toBe('fIvE pHoToS oF bAnAnA sKiNs?')
  })

  it('jokes about the limit at five photos', () => {
    expect(notAContainerWords(5).banana).toBe('Six photos of banana skins? The limit is five.')
  })
})

describe('mockingCase', () => {
  it('alternates letters and skips everything else', () => {
    expect(mockingCase('ab, cd!')).toBe('aB, cD!')
  })
})
