import { describe, it, expect } from 'vitest'
import { recordedInspection } from '../../__tests__/recordedInspection'
import { buildInspectionExport, buildSummaryText } from '../exports'
import type { InspectionRecord } from '../inspection'
import { withDamageReading, withPhotoFace } from '../damageSets'
import { readDoorDamage } from '../doorDamage'
import type { SharedAnswer } from '../questionSet'

const pred = (probability: number): SharedAnswer => ({ type: 'predicate', probability })
const pick = (value: string): SharedAnswer => ({
  type: 'choice',
  value,
  probabilities: { [value]: 0.9 },
  confidence: null,
})

async function liveDoorRecord(): Promise<InspectionRecord> {
  const base = await recordedInspection('openrouter', { delayMs: 0, id: 'run-jev-1' })
  const record: InspectionRecord = {
    ...base,
    id: 'live-openrouter-2',
    source: 'live',
    photo: { name: 'doors.jpg', orientation: 'landscape' },
    damage: null,
  }
  const reading = readDoorDamage({
    image_quality: pick('good'),
    door_end_coverage: pick('most'),
    D2B_visibility: pick('clear'),
    D2B_DT: pred(0.9),
    D2B_severity: {
      type: 'score',
      level: 2,
      label: 'minor',
      score: 2,
      probabilities: [0.05, 0.1, 0.7, 0.1, 0.05],
      confidence: null,
    },
    D1T_visibility: pick('not_visible'),
    left_leaf_hinge_damage: pred(0.7),
  })
  return withPhotoFace(
    withDamageReading(record, { ...reading, passId: 'live-openrouter-2-door-damage' }),
    { face: 'rear-doors', probability: 0.95, certainty: 'Confident' },
  )
}

describe('live door-end damage in the exports', () => {
  it('links door findings to the door request, on the rear face, with the region’s place', async () => {
    const json = buildInspectionExport(await liveDoorRecord())
    const [dent, hinge] = json.damage.findings
    expect(dent).toMatchObject({
      face: 'rear',
      component: 'panel',
      severity: 'minor',
      types: ['DT'],
      photo: 'doors.jpg',
      sourcePass: { passId: 'live-openrouter-2-door-damage', kind: 'provider-call' },
      region: { location: 'Photo-right door leaf, bottom third' },
    })
    expect(hinge).toMatchObject({ component: 'hinge', severity: "can't tell", visibility: null })
    expect(json.damage).toMatchObject({
      photoFace: { face: 'rear-doors' },
      coverage: 'most',
      notAssessedReason: null,
    })
    expect(json.damage.faces.find((f) => f.face === 'rear')?.status).toBe('photographed')
    expect(json.damage.zones).toHaveLength(6)
    expect(json.damage.zones.find((z) => z.id === 'D1T')).toMatchObject({
      face: 'rear',
      visibility: 'not-visible',
    })
  })

  it('names the door findings in the plain-text summary', async () => {
    const text = buildSummaryText(await liveDoorRecord())
    expect(text).toMatch(/Dent in the door panel/)
    expect(text).toMatch(/Rear: photographed/)
  })
})
