import { describe, expect, it } from 'vitest'
import { combinePhotoRuns, type PhotoRun } from '../combinePhotos'
import { chosenLength } from '../chosenLength'
import { lengthDisagreement } from '../shapeLength'
import type { CertaintyLabel, InspectionRecord } from '../inspection'
import type { PhotoFace } from '../photoFace'
import type { SealReading } from '../sealFamily'
import type { PlacardReading, PlacardsReading } from '../placards'

const BOX = { top: 0.4, bottom: 0.5, left: 0.3, right: 0.4, confidence: 0.9 }

function run(index: number, face: PhotoFace | null, extra: Partial<InspectionRecord>): PhotoRun {
  const record = {
    id: `r${index}`,
    rawResponses: [],
    containerId: null,
    damage: null,
    sizeCode: null,
    weights: null,
    photo: null,
    photoFace: face ? { face, probability: 0.9, certainty: 'Confident' } : null,
    ...extra,
  } as unknown as InspectionRecord
  return { index, name: `p${index}.jpg`, record }
}

const shape = (feet: 20 | 40 | 45, certainty: CertaintyLabel) => ({
  feet,
  probability: 0.9,
  certainty,
})

function seal(value: string, certainty: CertaintyLabel, withBox = true): SealReading {
  return {
    visible: true,
    characters: [...value].map((c) => ({ value: c === '?' ? null : c, certainty })),
    value,
    certainty,
    ...(withBox ? { box: BOX } : {}),
  }
}

const noMark = { answer: 'no', certainty: 'Not seen' } as const
function placards(list: PlacardReading[]): PlacardsReading {
  return {
    answer: list.length > 0 ? 'present' : 'none',
    certainty: list.length > 0 ? 'Likely' : 'Not seen',
    placards: list,
    marinePollutant: noMark,
    limitedQuantity: noMark,
  }
}

describe('length from shape across photos', () => {
  it('raises two side photos that agree one step', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'long-side', { shapeLength: shape(40, 'Likely') }),
        run(2, 'long-side', { shapeLength: shape(40, 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.shapeLength).toMatchObject({ feet: 40, certainty: 'Confident' })
    expect(record.photos![0]!.contributed.details).toContain('shapeLength')
    expect(record.photos![1]!.contributed.details).toContain('shapeLength')
  })

  it('makes a disagreement Uncertain and keeps the stronger reading', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'long-side', { shapeLength: shape(40, 'Confident') }),
        run(2, 'long-side', { shapeLength: shape(20, 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.shapeLength).toMatchObject({ feet: 40, certainty: 'Uncertain' })
    expect(record.photos![1]!.contributed.details).not.toContain('shapeLength')
  })

  it('takes length only from side photos', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { shapeLength: shape(20, 'Confident') }),
        run(2, 'long-side', { shapeLength: shape(40, 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.shapeLength).toMatchObject({ feet: 40, certainty: 'Likely' })
  })

  it('still lets a Confident ISO code win, and warns against the combined shape', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'long-side', {
          shapeLength: shape(40, 'Likely'),
          sizeCode: { certainty: 'Confident', length: { feet: 20 } } as never,
        }),
        run(2, 'long-side', { shapeLength: shape(40, 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(chosenLength(record)).toMatchObject({ feet: 20, alternative: 40 })
    expect(lengthDisagreement(record)).toContain('20 ft')
    expect(lengthDisagreement(record)).toContain('40 ft')
  })
})

describe('seal across photos', () => {
  it('reads the number across two photos, a character from whichever read it', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { seal: seal('AB?D', 'Likely') }),
        run(2, 'close-up', { seal: seal('?B3D', 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.seal!.value).toBe('AB3D')
    expect(record.seal!.characters.map((c) => c.certainty)).toEqual([
      'Likely',
      'Confident',
      'Likely',
      'Confident',
    ])
    expect(record.seal!.certainty).toBe('Likely')
    expect(record.photos![0]!.contributed.details).toContain('seal')
  })

  it('makes a disputed character Uncertain', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { seal: seal('AB1', 'Confident') }),
        run(2, 'close-up', { seal: seal('AB7', 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.seal!.value).toBe('AB1')
    expect(record.seal!.characters[2]!.certainty).toBe('Uncertain')
    expect(record.seal!.certainty).toBe('Uncertain')
  })

  it('takes its crop from the photo whose reading was used, and a not-visible photo does not hide it', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'long-side', {
          seal: { visible: false, characters: [], value: '', certainty: 'Not seen' },
        }),
        run(2, null, { seal: seal('XY12', 'Likely') }),
      ],
      { id: 'x' },
    )
    expect(record.seal).toMatchObject({ value: 'XY12', visible: true, photo: 2 })
    expect(record.seal!.box).toEqual(BOX)
    // The photo whose face could not be identified still contributed its seal.
    expect(record.photos![1]!.contributed.details).toContain('seal')
  })

  it('is not seen only when no photo shows one', () => {
    const none: SealReading = { visible: false, characters: [], value: '', certainty: 'Not seen' }
    const record = combinePhotoRuns(
      [run(1, 'rear-doors', { seal: none }), run(2, 'long-side', { seal: none })],
      { id: 'x' },
    )
    expect(record.seal).toMatchObject({ visible: false, certainty: 'Not seen' })
  })
})

describe('placards across photos', () => {
  const flammable = (certainty: CertaintyLabel, box = true): PlacardReading => ({
    dgClass: 3,
    unNumber: '1203',
    certainty,
    ...(box ? { box: BOX } : {}),
  })

  it('lists a placard seen on two faces once, with both faces, raised one step', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { placards: placards([flammable('Likely')]) }),
        run(2, 'long-side', { placards: placards([flammable('Likely')]) }),
      ],
      { id: 'x' },
    )
    expect(record.placards!.answer).toBe('present')
    expect(record.placards!.placards).toHaveLength(1)
    expect(record.placards!.placards[0]).toMatchObject({
      dgClass: 3,
      unNumber: '1203',
      certainty: 'Confident',
      faces: ['rear-doors', 'long-side'],
    })
  })

  it('keeps different placards and gives each its own photo for the crop', () => {
    const corrosive: PlacardReading = {
      dgClass: 8,
      unNumber: '1789',
      certainty: 'Likely',
      box: BOX,
    }
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { placards: placards([flammable('Likely')]) }),
        run(2, 'front-end', { placards: placards([corrosive]) }),
      ],
      { id: 'x' },
    )
    expect(record.placards!.placards.map((p) => [p.dgClass, p.photo, p.faces])).toEqual([
      [3, 1, ['rear-doors']],
      [8, 2, ['front-end']],
    ])
  })

  it('takes the crop from the photo that has a box, and a photo with an unknown face still contributes', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { placards: placards([flammable('Confident', false)]) }),
        run(2, null, { placards: placards([flammable('Likely')]) }),
      ],
      { id: 'x' },
    )
    const [only] = record.placards!.placards
    expect(record.placards!.placards).toHaveLength(1)
    expect(only!.photo).toBe(2)
    expect(only!.faces).toEqual(['rear-doors'])
    expect(record.photos![1]!.contributed.details).toContain('placards')
  })

  it('treats none seen in one photo as a placard seen in another', () => {
    const record = combinePhotoRuns(
      [
        run(1, 'rear-doors', { placards: placards([]) }),
        run(2, 'long-side', { placards: placards([flammable('Likely')]) }),
      ],
      { id: 'x' },
    )
    expect(record.placards!.answer).toBe('present')
    expect(record.placards!.placards).toHaveLength(1)
  })
})
