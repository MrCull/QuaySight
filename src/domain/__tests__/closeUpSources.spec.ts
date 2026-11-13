import { describe, it, expect } from 'vitest'
import { idCloseUp, isoCloseUp, placardCloseUp, sealCloseUp } from '../closeUpSources'
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

describe('the seal close-up from a close-up photo of the seal', () => {
  const WHOLE = { top: 0, left: 0, bottom: 1, right: 1, confidence: 1 }
  const sealPhoto = { face: 'close-up', closeUpSubject: 'seal' }

  it('shows the whole photo when the seal was read there but not located', () => {
    const r = record({
      seal: { visible: true, photo: 2 },
      photos: [
        { index: 1, face: { face: 'rear-doors' } },
        { index: 2, face: sealPhoto },
      ],
    })
    expect(sealCloseUp(r)).toEqual({ photo: 2, box: WHOLE, margin: 0 })
  })

  it('does the same for a single photo that is a seal close-up', () => {
    const r = record({ seal: { visible: true }, photoFace: sealPhoto })
    expect(sealCloseUp(r)).toEqual({ photo: 1, box: WHOLE, margin: 0 })
  })

  it('still prefers a located area, and shows nothing from a photo that is not a seal close-up', () => {
    const located = record({
      seal: { visible: true },
      photoFace: sealPhoto,
      sealZoomRead: { box: AREA },
    })
    expect(sealCloseUp(located)?.box).toEqual({ ...AREA, confidence: 1 })
    const doors = record({
      seal: { visible: true, photo: 1 },
      photos: [
        { index: 1, face: { face: 'rear-doors' } },
        { index: 2, face: sealPhoto },
      ],
    })
    expect(sealCloseUp(doors)).toBeNull()
    const other = record({
      seal: { visible: true },
      photoFace: { face: 'close-up', closeUpSubject: 'id' },
    })
    expect(sealCloseUp(other)).toBeNull()
  })
})

describe('the ISO code close-up source', () => {
  const read = { state: 'read', code: '25G1' }

  it('cuts the area the regions step found, from photo 1', () => {
    const r = record({ details: { sizeCode: read }, regions: { found: { iso: { box: AREA } } } })
    expect(isoCloseUp(r)).toEqual({ photo: 1, box: { ...AREA, confidence: 1 }, margin: 0 })
  })

  it('takes the photo and area the combined reading carries with several photos', () => {
    const r = record({
      details: { sizeCode: { ...read, photo: 3, area: OTHER } },
      regions: { found: { iso: { box: AREA } } },
      photos: [{}, {}, {}],
    })
    expect(isoCloseUp(r)).toEqual({ photo: 3, box: { ...OTHER, confidence: 1 }, margin: 0 })
  })

  it('shows nothing when the code was not read or not located', () => {
    const unread = { details: { sizeCode: { state: 'unclear', code: null } } }
    expect(isoCloseUp(record({ ...unread, regions: { found: { iso: { box: AREA } } } }))).toBeNull()
    expect(isoCloseUp(record({ details: { sizeCode: read } }))).toBeNull()
    expect(
      isoCloseUp(
        record({
          details: { sizeCode: read },
          regions: { found: { iso: { box: AREA } } },
          photos: [{}, {}],
        }),
      ),
    ).toBeNull()
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
