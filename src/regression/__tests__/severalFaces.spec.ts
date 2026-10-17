// The JDLU corner photos record both the doors and a long side, and the damage view names the long side
// (spec #75, ticket #88). Replays the recordings; nothing is sent.
import { describe, it, expect } from 'vitest'
import { parsePlanRecording } from '../../plan/recording'
import { replayRecording } from '../../plan/replay'
import { facesShown } from '../../domain/photoFace'
import type { ProviderId } from '../../domain/inspection'
import expected from '../expected.json'
import { replayInspection } from '../replayInspection'
import type { Expected } from '../score'

const files = import.meta.glob<unknown>('../../fixtures/live/plan/*.json', {
  eager: true,
  import: 'default',
})
const recordings = Object.values(files).map((f) => parsePlanRecording(f))
const jdlu = (expected as Expected[]).find((e) => e.id === 'jdlu-four-photos')!
const ROUTES: ProviderId[] = ['luna', 'openrouter']

describe.each(ROUTES)('JDLU corner photos on %s', (route) => {
  it.each([1, 2])('records the doors and a long side for corner photo %i', (n) => {
    const photo = jdlu.photos[n]!
    const recording = recordings.find((r) => r.photo === photo.photo && r.provider === route)!
    const record = replayRecording(recording, { id: 'x', photo: null })
    expect([...facesShown(record.photoFace)].sort()).toEqual([...photo.faces].sort())
  })

  it('names a long side in the damage view', () => {
    const record = replayInspection(jdlu, recordings, route)
    const faces = record.damage?.photos.map((p) => p.face) ?? []
    expect(faces.some((f) => f === 'left' || f === 'right')).toBe(true)
    expect(record.damage?.sideInference?.basis).toBe('inferred')
  })
})
