import { describe, it, expect } from 'vitest'
import { combinePhotoRuns, type PhotoRun } from '../combinePhotos'
import { faceStatus, type DamageAssessment, type DamageFinding } from '../damage'
import type { DamageSetReading } from '../damageSets'
import type { InspectionRecord } from '../inspection'
import { buildInspectionExport } from '../exports'

// Several photos of one container (#71): one damage list and one drawing, replayed through combinePhotoRuns.

const finding = (over: Partial<DamageFinding>): DamageFinding => ({
  id: 1,
  face: 'right',
  zone: { u0: 0.31, u1: 0.39, v0: 0.5, v1: 0.9 },
  component: 'panel',
  visibility: 'clear',
  location: 'Section 4 of 10 from the door end, lower half of the side sheet',
  title: 'Dent',
  description: '',
  bestInterpretation: '',
  uncertainty: '',
  types: [{ code: 'DT', name: 'Dent', probability: 0.8 }],
  severity: 'minor',
  certainty: 'Likely',
  caveats: [],
  ...over,
})

function record(over: Partial<InspectionRecord>): InspectionRecord {
  return {
    id: 'r',
    schemaVersion: 1,
    provider: 'luna',
    model: 'm',
    resolvedVersion: 'v',
    rawResponses: [],
    source: 'live',
    status: 'complete',
    photo: null,
    containerId: null,
    damage: null,
    sizeCode: null,
    weights: null,
    ...over,
  } as InspectionRecord
}

const face = (f: string) => ({ face: f, probability: 0.95, certainty: 'Confident' }) as never

function sidePhoto(index: number, findings: DamageFinding[], name = `side${index}.jpg`): PhotoRun {
  const damage: DamageAssessment = {
    source: 'live',
    photos: [{ photo: name, face: 'right' }],
    findings,
    sideInference: { side: 'right', basis: 'inferred' },
    lengthFt: 40,
  }
  return { index, name, record: record({ photoFace: face('long-side'), damage }) }
}

function doorPhoto(index: number, findings: DamageFinding[] = []): PhotoRun {
  const name = `doors${index}.jpg`
  const damage: DamageAssessment = {
    source: 'live',
    photos: [{ photo: name, face: 'rear' }],
    findings,
  }
  return { index, name, record: record({ photoFace: face('rear-doors'), damage }) }
}

const combine = (runs: PhotoRun[]) => combinePhotoRuns(runs, { id: 'x' })

describe('damage across several photos', () => {
  it('lists a dent photographed twice once, with the higher severity, one step more certain, and both photos', () => {
    const record = combine([
      sidePhoto(1, [finding({ severity: 'minor', certainty: 'Likely' })]),
      sidePhoto(2, [finding({ severity: 'moderate', certainty: 'Uncertain' })]),
    ])
    const findings = record.damage!.findings
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 1,
      severity: 'moderate',
      certainty: 'Confident',
      photos: [1, 2],
    })
    expect(record.photos!.map((p) => p.contributed.damage)).toEqual([[1], [1]])
  })

  it('keeps different damage types in the same section apart, numbered in card order', () => {
    const record = combine([
      sidePhoto(1, [finding({ severity: 'minor' })]),
      sidePhoto(2, [
        finding({
          severity: 'major',
          certainty: 'Confident',
          title: 'Hole',
          types: [{ code: 'HO', name: 'Hole', probability: 0.9 }],
        }),
      ]),
    ])
    expect(record.damage!.findings.map((f) => [f.id, f.title, f.photos])).toEqual([
      [1, 'Hole', [2]],
      [2, 'Dent', [1]],
    ])
  })

  it('keeps the same type in a different section apart', () => {
    const elsewhere = { u0: 0.71, u1: 0.79, v0: 0.5, v1: 0.9 }
    const record = combine([
      sidePhoto(1, [finding({})]),
      sidePhoto(2, [finding({ zone: elsewhere })]),
    ])
    expect(record.damage!.findings).toHaveLength(2)
  })

  it('lists findings of a photo whose face could not be identified apart, and does not draw them', () => {
    const reading = {
      face: 'long-side',
      inspectable: true,
      findings: [finding({ id: 1, face: 'long-side', title: 'Scrape' })],
    } as unknown as DamageSetReading
    const unknown: PhotoRun = {
      index: 2,
      name: 'unknown.jpg',
      record: record({
        photoFace: face('unknown'),
        damage: { source: 'live', photos: [], findings: [], notAssessed: { reason: 'x' } },
        damageReadings: [reading],
      }),
    }
    const combined = combine([sidePhoto(1, [finding({})]), unknown])
    const damage = combined.damage!
    expect(damage.findings.map((f) => f.title)).toEqual(['Dent'])
    expect(damage.unplaced!.map((f) => [f.id, f.title, f.photos])).toEqual([[2, 'Scrape', [2]]])
    expect(damage.photos.map((p) => p.index)).toEqual([1])
    expect(combined.photos![1]!.contributed.damage).toEqual([2])
  })

  it('fills in every face that has a photo and leaves the rest Not seen', () => {
    const front: PhotoRun = {
      index: 3,
      name: 'front.jpg',
      record: record({
        photoFace: face('front-end'),
        damage: { source: 'live', photos: [], findings: [], notAssessed: { reason: 'x' } },
      }),
    }
    const damage = combine([sidePhoto(1, []), doorPhoto(2), front]).damage!
    const status = (f: 'rear' | 'front' | 'left' | 'right' | 'roof') => faceStatus(damage, f)
    expect([status('rear'), status('right'), status('front')]).toEqual([
      'photographed',
      'photographed',
      'photographed',
    ])
    expect([status('left'), status('roof')]).toEqual(['not-seen', 'not-seen'])
  })

  it('exports, for each damage, the photos it came from', () => {
    const combined = combine([sidePhoto(1, [finding({})]), sidePhoto(2, [finding({})])])
    const exported = buildInspectionExport(combined)
    expect(exported.damage.findings[0]!.photos).toEqual(['side1.jpg', 'side2.jpg'])
  })
})
