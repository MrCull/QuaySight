import { describe, it, expect } from 'vitest'
import { idCloseUp, placardCloseUp, sealCloseUp } from '../closeUpSources'
import type { InspectionRecord } from '../inspection'
import { ENLARGED_MARGIN } from '../enlargedCrop'

const AREA = { top: 0.2, bottom: 0.45, left: 0.5, right: 0.75 }
const OTHER = { top: 0.6, bottom: 0.85, left: 0.1, right: 0.35 }
const SURVEY = { left: 0.4, right: 0.6, top: 0.45, bottom: 0.55, confidence: 0.9 }

const record = (extra: Record<string, unknown>, id: Record<string, unknown> = {}) =>
  ({ containerId: { value: 'COYU2668130', ...id }, ...extra }) as unknown as InspectionRecord

describe('the ID close-up source', () => {
  it('cuts the area the zoomed read used, from photo 1 when the reading names no photo', () => {
    const s = idCloseUp(record({ idCropRead: { box: AREA, marks: [3] } }))
    expect(s).toMatchObject({ photo: 1, margin: 0, box: { ...AREA, confidence: 1 } })
  })

  it('takes the photo from the reading', () => {
    expect(idCloseUp(record({ idCropRead: { box: AREA } }, { photo: 2 }))?.photo).toBe(2)
  })

  it('prefers an area the reading carries itself, even with several photos', () => {
    const r = record({ idCropRead: { box: AREA }, photos: [{}, {}] }, { photo: 2, area: OTHER })
    expect(idCloseUp(r)).toMatchObject({ photo: 2, box: { ...OTHER, confidence: 1 } })
  })

  it('falls back to the survey box with its own margin, and shows nothing without an area', () => {
    expect(idCloseUp(record({}, { box: SURVEY }))).toMatchObject({
      margin: ENLARGED_MARGIN,
      box: SURVEY,
    })
    expect(idCloseUp(record({}))).toBeNull()
  })

  it('shows nothing for several photos when the reading names no photo', () => {
    expect(idCloseUp(record({ idCropRead: { box: AREA }, photos: [{}, {}] }))).toBeNull()
  })
})

describe('the seal close-up source', () => {
  it('uses the zoomed seal area, and nothing when no seal is visible', () => {
    const seen = record({ seal: { visible: true }, sealZoomRead: { box: AREA } })
    expect(sealCloseUp(seen)).toMatchObject({ photo: 1, box: { ...AREA, confidence: 1 } })
    expect(
      sealCloseUp(record({ seal: { visible: false }, sealZoomRead: { box: AREA } })),
    ).toBeNull()
  })

  it('takes the photo number from the seal reading', () => {
    const r = record({ seal: { visible: true, photo: 2, box: SURVEY }, photos: [{}, {}] })
    expect(sealCloseUp(r)).toMatchObject({ photo: 2, margin: ENLARGED_MARGIN })
  })
})

describe('the hazard sticker close-up source', () => {
  const placards = { answer: 'present', placards: [{ dgClass: 3 }, { dgClass: 8 }] }

  it('uses the regions areas when they match the placards one for one', () => {
    const r = record({ placards, regions: { found: { hazards: [{ box: AREA }, { box: OTHER }] } } })
    expect(placardCloseUp(r, 1)).toMatchObject({ box: { ...OTHER, confidence: 1 } })
  })

  it('does not guess when the counts differ', () => {
    const r = record({ placards, regions: { found: { hazards: [{ box: AREA }] } } })
    expect(placardCloseUp(r, 0)).toBeNull()
  })
})
