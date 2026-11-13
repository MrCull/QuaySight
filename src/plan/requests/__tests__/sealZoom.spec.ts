import { describe, expect, it } from 'vitest'
import type { InspectionRecord } from '../../../domain/inspection'
import type { SealReading } from '../../../domain/sealFamily'
import { sealZoom } from '../sealZoom'
import { regions } from '../regions'

// The zoomed seal read's apply step: a box the model gave on the close view lands on the photo.
const AREA = { top: 0.25, bottom: 0.5, left: 0.25, right: 0.5 }
const plan = {
  answer: (request: unknown) => (request === regions ? { seal: { marks: [6], box: AREA } } : null),
} as never

const seal = (extra: Partial<SealReading> = {}): SealReading => ({
  visible: true,
  characters: [...'0154620'].map((value) => ({ value, certainty: 'Confident' as const })),
  value: '0154620',
  certainty: 'Confident',
  ...extra,
})

// A 400 x 300 crop cut at (200, 100) from a 1000 x 1000 photo.
const region = { x: 200, y: 100, width: 400, height: 300, outWidth: 800, outHeight: 600 }

function apply(answer: SealReading, crop: object = region) {
  const record = { seal: seal() } as unknown as InspectionRecord
  return sealZoom.apply(
    record,
    { status: 'answered', answer: { seal: answer, region: crop }, resolvedModel: 'm' } as never,
    plan,
  )
}

describe('the zoomed seal read', () => {
  it('maps the number box on the close view to the photo, and keeps it off the reading box', () => {
    const box = { top: 0.5, bottom: 0.75, left: 0.25, right: 0.75, confidence: 0.8 }
    const out = apply(seal({ box }), { ...region, sourceWidth: 1000, sourceHeight: 1000 })
    const onPhoto = { top: 0.25, bottom: 0.325, left: 0.3, right: 0.5, confidence: 0.8 }
    expect(out.seal?.numberBox).toEqual(onPhoto)
    expect(out.sealZoomRead?.numberBox).toEqual(onPhoto)
    expect(out.seal?.box).toBeUndefined()
    expect(out.sealZoomRead?.crop).toMatchObject({ sourceWidth: 1000, sourceHeight: 1000 })
  })

  it('gives no number box when the crop does not say the photo size, or there is no box', () => {
    const box = { top: 0.5, bottom: 0.75, left: 0.25, right: 0.75, confidence: 0.8 }
    expect(apply(seal({ box })).seal?.numberBox).toBeUndefined()
    const out = apply(seal(), { ...region, sourceWidth: 1000, sourceHeight: 1000 })
    expect(out.seal?.numberBox).toBeUndefined()
    expect(out.sealZoomRead?.numberBox).toBeUndefined()
  })
})
