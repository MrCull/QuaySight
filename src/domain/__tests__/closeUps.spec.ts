import { describe, expect, it } from 'vitest'
import { combinePhotoRuns, type PhotoRun } from '../combinePhotos'
import { buildContainerIdReading } from '../containerId'
import type { CertaintyLabel, InspectionRecord } from '../inspection'
import {
  FACE_QUESTION,
  faceChipLabel,
  faceOf,
  type CloseUpSubject,
  type PhotoFace,
} from '../photoFace'

function run(
  index: number,
  face: PhotoFace,
  extra: Partial<InspectionRecord> = {},
  closeUpSubject?: CloseUpSubject,
): PhotoRun {
  const record = {
    id: `r${index}`,
    rawResponses: [],
    containerId: null,
    damage: null,
    sizeCode: null,
    weights: null,
    photo: null,
    photoFace: { face, closeUpSubject, probability: 0.9, certainty: 'Confident' },
    ...extra,
  } as unknown as InspectionRecord
  return { index, name: `p${index}.jpg`, record }
}

const id = (printed: string, certainty: CertaintyLabel) =>
  buildContainerIdReading({ printed, certainty })

const sealOf = (value: string) => ({
  visible: true,
  characters: [...value].map((c) => ({ value: c, certainty: 'Likely' as const })),
  value,
  certainty: 'Likely' as const,
})

describe('the close-up face', () => {
  it('offers a close-up for each subject and reads its subject back', () => {
    const values = FACE_QUESTION.choices.map((c) => c.value)
    for (const v of [
      'close_up_seal',
      'close_up_id',
      'close_up_weights',
      'close_up_placard',
      'close_up_damage',
    ])
      expect(values).toContain(v)
    const answer = {
      type: 'choice' as const,
      value: 'close_up_seal',
      probabilities: { close_up_seal: 0.95 },
      confidence: 0.95,
    }
    const face = faceOf({ photo_face: answer } as never)
    expect(face?.face).toBe('close-up')
    expect(face?.closeUpSubject).toBe('seal')
  })

  it('words the chip "Close-up · Seal"', () => {
    expect(faceChipLabel('close-up', null, 'seal')).toBe('Close-up · Seal')
    expect(faceChipLabel('close-up', null, 'placard')).toBe('Close-up · Placard')
    expect(faceChipLabel('close-up')).toBe('Close-up')
  })
})

describe('a close-up among several photos', () => {
  const door = run(1, 'rear-doors', { containerId: id('COYU2668130', 'Confident') })

  it('gives no ID, however it read, and never raises "different containers"', () => {
    const closeUp = run(2, 'close-up', { containerId: id('JDLU2006902', 'Confident') }, 'seal')
    const record = combinePhotoRuns([door, closeUp], { id: 'x' })
    expect(record.differentContainers).toBe(false)
    expect(record.containerId?.value).toBe('COYU2668130')
    expect(record.photos?.[1]?.contributed.containerId).toEqual([])
  })

  it('gives its subject only: the seal of a seal close-up, not its placards', () => {
    const closeUp = run(
      2,
      'close-up',
      {
        seal: sealOf('0154620'),
        placards: { answer: 'present', certainty: 'Likely', placards: [] } as never,
      },
      'seal',
    )
    const record = combinePhotoRuns([door, closeUp], { id: 'x' })
    expect(record.seal?.value).toBe('0154620')
    expect(record.placards).toBeUndefined()
    expect(record.photos?.[1]?.face?.face).toBe('close-up')
  })

  it('keeps a damage close-up from adding a seal', () => {
    const closeUp = run(2, 'close-up', { seal: sealOf('1234567') }, 'damage')
    expect(combinePhotoRuns([door, closeUp], { id: 'x' }).seal).toBeUndefined()
  })
})

describe('the "different containers" warning', () => {
  const ids = (a: CertaintyLabel, b: CertaintyLabel) =>
    combinePhotoRuns(
      [
        run(1, 'rear-doors', { containerId: id('COYU2668130', a) }),
        run(2, 'rear-doors', { containerId: id('JDLU2006902', b) }),
      ],
      { id: 'x' },
    )

  it('fires for two complete, valid, differing IDs that are each at least Likely', () => {
    expect(ids('Likely', 'Confident').differentContainers).toBe(true)
  })

  it('does not fire when one of them is weaker than Likely', () => {
    expect(ids('Uncertain', 'Confident').differentContainers).toBe(false)
  })
})
