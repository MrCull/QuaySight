import { describe, it, expect } from 'vitest'
import { parsePlanRecording } from '../../plan/recording'
import { replayInspection } from '../replayInspection'
import type { Expected } from '../score'

const files = import.meta.glob<unknown>('../../fixtures/live/plan/*.json', {
  eager: true,
  import: 'default',
})
const recordings = Object.values(files).map((f) => parsePlanRecording(f))

const entry = (photos: string[]): Expected => ({
  id: 'x',
  photos: photos.map((photo) => ({ photo, faces: ['rear-doors'] })),
  containerId: null,
  sizeCode: null,
  maxGrossKg: null,
  tareKg: null,
  payloadKg: null,
  seal: null,
  idCertainty: null,
  alternativesAllowed: false,
  differentContainersWarning: false,
  closeUpFrom: { id: null, seal: null },
  lengthFt: 20,
  damage: 'none',
})

describe('replayInspection', () => {
  it('replays a one-photo inspection as that photo alone, with no photo summary', () => {
    const record = replayInspection(entry(['samples/rear-door-coyu-22g1.jpg']), recordings, 'luna')
    expect(record.containerId?.value).toBe('COYU2668130')
    expect(record.photos).toBeUndefined()
  })

  it('replays a several-photo inspection through the combine, one summary per photo in order', () => {
    const record = replayInspection(
      entry(['samples/rear-door-coyu-22g1.jpg', 'samples/rear-door-chsu-22g1.jpg']),
      recordings,
      'luna',
    )
    expect(record.photos?.map((p) => p.name)).toEqual([
      'samples/rear-door-coyu-22g1.jpg',
      'samples/rear-door-chsu-22g1.jpg',
    ])
  })

  it('says which photo has no recording on that route', () => {
    expect(() => replayInspection(entry(['samples/none.jpg']), recordings, 'luna')).toThrow(
      /samples\/none\.jpg/,
    )
  })
})
