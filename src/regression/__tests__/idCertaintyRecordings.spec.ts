// Ticket #79: the container ID's certainty and alternatives on the recorded regression set. Free: nothing is sent.
import { describe, it, expect } from 'vitest'
import { parsePlanRecording } from '../../plan/recording'
import { passesCheckDigit } from '../../domain/idConfidence'
import type { ProviderId } from '../../domain/inspection'
import expected from '../expected.json'
import { replayInspection } from '../replayInspection'
import type { Expected } from '../score'

const files = import.meta.glob<unknown>('../../fixtures/live/plan/*.json', {
  eager: true,
  import: 'default',
})
const recordings = Object.values(files).map((f) => parsePlanRecording(f))
const truths = expected as Expected[]
const ROUTES: ProviderId[] = ['luna', 'openrouter']

const idOf = (entry: string, route: ProviderId) => {
  const truth = truths.find((t) => t.id === entry)!
  return replayInspection(truth, recordings, route).containerId
}

describe('the container ID on the regression recordings', () => {
  it('never shows an alternative that fails the check digit, on any entry or model', () => {
    for (const route of ROUTES) {
      for (const truth of truths) {
        const reading = replayInspection(truth, recordings, route).containerId
        for (const alt of reading?.alternatives ?? []) {
          expect({ route, entry: truth.id, alt, passes: passesCheckDigit(alt) }).toMatchObject({
            passes: true,
          })
        }
        expect((reading?.alternatives ?? []).length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('reads COYU 266813 0 and JDLU 200690 2 exactly on Luna', () => {
    expect(idOf('coyu-doors', 'luna')?.value).toBe('COYU2668130')
    expect(idOf('jdlu-four-photos', 'luna')?.value).toBe('JDLU2006902')
  })

  it('hides the COYU 206813 0 alternative, which fails the check digit', () => {
    for (const route of ROUTES) {
      expect(idOf('coyu-doors', route)?.alternatives ?? []).not.toContain('COYU2068130')
    }
  })

  it('is Confident with no alternatives for JDLU on Jev, which read every character Confident on several photos', () => {
    const reading = idOf('jdlu-four-photos', 'openrouter')
    expect(reading).toMatchObject({ value: 'JDLU2006902', certainty: 'Confident' })
    expect(reading?.alternatives).toBeUndefined()
  })
})
