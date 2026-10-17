import { describe, it, expect } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { demoSamples, findSample, runDemoSample } from '../demoSamples'
import { DIFFERENT_CONTAINERS_MESSAGE } from '../combinePhotos'
import { useInspectionStore } from '../../stores/inspection'

// Demo mode offers the presenter's two real several-photo inspections (spec #75, ticket #73): COYU 266813 0
// (a door photo and a seal close-up) and JDLU 200690 2 (four photos). Each plays back the recordings of its
// own photos, combined as a live run combines them. Nothing is sent.

describe('demo mode: the presenter’s several-photo inspections', () => {
  it('offers both next to the single-photo samples', () => {
    const ids = demoSamples().map((s) => s.id)
    expect(ids).toContain('coyu-seal')
    expect(ids).toContain('jdlu-four')
    expect(findSample('coyu-seal').photos.map((p) => p.name)).toEqual([
      'rear-door-coyu-22g1.jpg',
      'seal-closeup-coyu-0154620.jpg',
    ])
    expect(findSample('jdlu-four').photos).toHaveLength(4)
    for (const sample of demoSamples()) expect(sample.photos[0]).toEqual(sample.photo)
  })

  it('plays back COYU 266813 0 with its seal and no "different containers" warning', async () => {
    const record = await runDemoSample('coyu-seal')
    expect(record).toMatchObject({ source: 'recorded', status: 'complete' })
    expect(record.photos?.map((p) => p.name)).toEqual([
      'rear-door-coyu-22g1.jpg',
      'seal-closeup-coyu-0154620.jpg',
    ])
    expect(record.containerId?.value).toBe('COYU2668130')
    // The recording's seal reading is what plays back, right or wrong (the regression set scores it:
    // npm run score); the demo never substitutes the expected value.
    expect(record.seal?.visible).toBe(true)
    expect(record.seal?.value).toMatch(/^0154620|^[0-9?]{6,8}$/)
    expect(record.differentContainers).toBeFalsy()
    expect(JSON.stringify(record)).not.toContain(DIFFERENT_CONTAINERS_MESSAGE)
  })

  it('plays back JDLU 200690 2 from four photos with no "different containers" warning', async () => {
    const record = await runDemoSample('jdlu-four')
    expect(record).toMatchObject({ source: 'recorded', status: 'complete' })
    expect(record.photos).toHaveLength(4)
    expect(record.containerId?.value).toBe('JDLU2006902')
    expect(record.differentContainers).toBeFalsy()
    expect(new Set(record.rawResponses.map((r) => r.capturedFrom))).toEqual(
      new Set(['recorded-fixture']),
    )
  })

  it('puts every photo of the sample on screen when it is chosen', () => {
    setActivePinia(createPinia())
    const store = useInspectionStore()
    store.enterDemo()
    store.chooseSample('jdlu-four')
    expect(store.photos.map((p) => p.name)).toEqual(
      findSample('jdlu-four').photos.map((p) => p.name),
    )
    store.chooseSample('rear-aphu')
    expect(store.photos).toHaveLength(1)
  })
})
