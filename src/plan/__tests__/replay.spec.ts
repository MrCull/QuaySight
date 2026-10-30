import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation and the crop run on the fake codec.
vi.mock('../../services/imageCodec')

import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'
import { recordRun, parsePlanRecording } from '../recording'
import { replayRecording } from '../replay'
import { combinePhotoRuns } from '../../domain/combinePhotos'
import { buildInspectionExport } from '../../domain/exports'
import {
  weightChoices,
  COYU_WEIGHTS,
  openAiChoiceReply,
  openRouterChoiceReply,
} from '../../__tests__/weightReplies'
import { openRouterSurveyReply, openAiSurveyReply } from '../../__tests__/surveyReplies'
import type { SurveyChoice } from '../../__tests__/surveyReplies'
import { doorReply, notASideReply, openAiShape } from '../../__tests__/planReplies'

// Replaying a recording (spec #27, ticket #37). A recording is the raw responses of one live run of the
// whole plan, one per request. Replaying it must give the record the live run gave, through the same
// answer mappers: so the oracle here is a live run through the store with fetch stubbed at the network
// edge, recorded and replayed.

const KEY = 'test-only-openrouter-key-0000'
const OPENAI_KEY = 'test-only-openai-key-0000'
const PHOTO = { name: 'rear-door-coyu-22g1.jpg', orientation: 'square' as const }
const COYU = 'COYU2668130'

const DETAILS: Record<string, SurveyChoice> = {
  size_type_code: [
    ['22G1', 0.95],
    ['22G0', 0.03],
  ],
  equipment_reefer: [['no', 0.96]],
  equipment_open_top: [['no', 0.97]],
  equipment_tank: [['no', 0.99]],
  equipment_flat_rack: [['no', 0.99]],
  marking_super_heavy: [['no', 0.95]],
  marking_high_container: [['no', 0.93]],
  marking_overwidth: [['no', 0.96]],
  marking_fumigation: [['no', 0.97]],
  marking_marine_pollutant: [['no', 0.98]],
  dg_placard: [['none', 0.94]],
  photo_face: [['rear_doors', 0.96]],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Kind = 'survey' | 'side' | 'door' | 'crop' | 'weights' | 'regions'
type Replies = Partial<Record<Kind, unknown>>

/** The numbered regions' answer: the ID in marks 3 and 4 (top row, right half). */
const REGION_CHOICES: Record<string, SurveyChoice> = {
  id_mark: [['3', 0.8]],
  id_mark_2: [['4', 0.7]],
}

function kindOf(body: string): Kind {
  if (body.includes('id_mark')) return 'regions'
  if (body.includes('D1T_DT')) return 'door'
  if (body.includes('Z1T_DT')) return 'side'
  if (body.includes('size_type_code')) return 'survey'
  if (body.includes('id_char_01')) return 'crop'
  return 'weights'
}

describe('replaying a recorded run of the whole plan', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function liveRun(provider: 'openrouter' | 'luna', replies: Replies = {}) {
    fetchMock.mockImplementation(async (_input, init) => {
      const kind = kindOf(String(init?.body))
      const given = replies[kind]
      if (given) return json(given)
      switch (kind) {
        case 'survey':
          return json(
            provider === 'luna'
              ? openAiSurveyReply(COYU, { details: { ...DETAILS, ...weightChoices(COYU_WEIGHTS) } })
              : openRouterSurveyReply(COYU, {
                  box: true,
                  details: { ...DETAILS, ...weightChoices(COYU_WEIGHTS) },
                }),
          )
        case 'regions':
          return json(
            provider === 'luna'
              ? openAiChoiceReply(REGION_CHOICES)
              : openRouterChoiceReply(REGION_CHOICES),
          )
        case 'side':
          return json(provider === 'luna' ? openAiShape(notASideReply()) : notASideReply())
        case 'door':
          return json(provider === 'luna' ? openAiShape(doorReply()) : doorReply())
        default:
          return json(provider === 'luna' ? openAiSurveyReply(COYU) : openRouterSurveyReply(COYU))
      }
    })
    const store = useInspectionStore()
    store.setProvider(provider)
    if (provider === 'openrouter') store.setModel('~typesafe/jev-latest')
    store.setApiKey(provider === 'luna' ? OPENAI_KEY : KEY)
    store.setPhoto({
      name: PHOTO.name,
      url: 'blob:coyu',
      orientation: PHOTO.orientation,
      file: new Blob(['1079x1080'], { type: 'image/jpeg' }),
    })
    await store.start()
    expect(store.record?.status).toBe('complete')
    const live = store.record!
    const recording = recordRun(live, useLedgerStore().entries(), {
      photo: `samples/${PHOTO.name}`,
      recordedAt: '2026-10-17T09:00:00.000Z',
    })
    return { live, recording }
  }

  it('gives the record the live run gave: ID, details, weights, face, damage and crop read', async () => {
    const { live, recording } = await liveRun('openrouter')

    const replayed = replayRecording(recording, { id: live.id, photo: PHOTO })

    // What the run found, as literals (independent of the replay path).
    expect(replayed.containerId?.value).toBe(COYU)
    expect(replayed.details?.sizeCode.code).toBe('22G1')
    expect(replayed.photoFace?.face).toBe('rear-doors')
    expect(replayed.weights?.maxGross).toMatchObject({ valueKg: 30480, valueLb: 67200 })
    expect(replayed.damage?.findings.map((f) => f.location)).toEqual([
      'Photo-right door leaf, bottom third',
    ])
    expect(replayed.idCropRead?.outcome).toBe('combined')
    // And the same as the live run, field for field.
    for (const key of [
      'containerId',
      'details',
      'sizeCode',
      'weights',
      'photoFace',
      'damage',
      'idCropRead',
      'regions',
      'resolvedVersion',
      'provider',
      'model',
    ] as const) {
      expect({ [key]: replayed[key] }).toEqual({ [key]: live[key] })
    }
  })

  it('keeps same-type damage in different door regions separate across replayed photos', async () => {
    const { recording } = await liveRun('openrouter')
    const other = parsePlanRecording(JSON.parse(JSON.stringify(recording)))
    const door = other.entries.find((e) => e.request === 'door-damage')!
    const response = door.response as ReturnType<typeof doorReply>
    response.answers.D1T_DT = response.answers.D2B_DT
    response.answers.D1T_severity = response.answers.D2B_severity
    delete response.answers.D2B_DT
    delete response.answers.D2B_severity
    const combined = combinePhotoRuns(
      [recording, other].map((r, i) => ({
        index: i + 1,
        name: `doors-${i + 1}.jpg`,
        record: replayRecording(r, {
          id: `photo-${i + 1}`,
          photo: { ...PHOTO, name: `doors-${i + 1}.jpg` },
        }),
      })),
      { id: 'combined' },
    )

    expect(combined.damage?.findings.map((f) => [f.location, f.photos])).toEqual([
      ['Photo-right door leaf, bottom third', [1]],
      ['Photo-left door leaf, top third', [2]],
    ])
  })

  it('retains separate source observations and their evidence under a combined finding', async () => {
    const { recording } = await liveRun('openrouter')
    const combined = combinePhotoRuns(
      [1, 2].map((index) => ({
        index,
        name: `doors-${index}.jpg`,
        record: replayRecording(recording, {
          id: `photo-${index}`,
          photo: { ...PHOTO, name: `doors-${index}.jpg` },
        }),
      })),
      { id: 'combined' },
    )
    const finding = combined.damage!.findings[0]!
    expect(finding.observations).toMatchObject([
      {
        findingId: 1,
        photo: { index: 1, name: 'doors-1.jpg' },
        evidence: {
          location: 'Photo-right door leaf, bottom third',
          severity: 'minor',
          types: [{ code: 'DT', probability: 0.9 }],
        },
      },
      {
        findingId: 1,
        photo: { index: 2, name: 'doors-2.jpg' },
        evidence: {
          location: 'Photo-right door leaf, bottom third',
          severity: 'minor',
          types: [{ code: 'DT', probability: 0.9 }],
        },
      },
    ])
    expect(new Set(finding.observations!.map((o) => o.id)).size).toBe(2)
    expect(buildInspectionExport(combined).damage.findings[0]?.observations).toEqual(
      finding.observations,
    )
    const reordered = combinePhotoRuns(
      [2, 1].map((index) => ({
        index,
        name: `doors-${index}.jpg`,
        record: replayRecording(recording, {
          id: `another-run-${index}`,
          photo: { ...PHOTO, name: `doors-${index}.jpg` },
        }),
      })),
      { id: 'another-combination' },
    )
    expect(reordered.damage!.findings[0]!.observations!.map((o) => o.id).sort()).toEqual(
      finding.observations!.map((o) => o.id).sort(),
    )
  })

  it('leaves unavailable legacy provenance unlocated in replay and export', async () => {
    const { recording } = await liveRun('openrouter')
    const replayed = replayRecording(recording, { id: 'legacy', photo: null })
    expect(replayed.damage!.findings[0]!.observations?.[0]?.photo).toBeNull()
    const legacy = JSON.parse(JSON.stringify(replayed)) as typeof replayed
    for (const finding of legacy.damage!.findings) delete finding.observations
    const exported = buildInspectionExport(legacy).damage.findings[0]!
    expect(exported.observations).toBeUndefined()
    expect(exported.photo).toBeNull()
    expect(exported.region.zone).toEqual(legacy.damage!.findings[0]!.zone)
    expect(JSON.parse(JSON.stringify(exported))).not.toHaveProperty('observations')
  })

  it('preserves photo evidence for an observation whose container face cannot be placed', async () => {
    const { recording } = await liveRun('openrouter')
    const known = replayRecording(recording, { id: 'known', photo: PHOTO })
    const unknown = replayRecording(recording, {
      id: 'unknown',
      photo: { ...PHOTO, name: 'obscured.jpg' },
    })
    // A legacy recording can contain damage answers even when its survey could not place the face.
    unknown.photoFace = { face: 'unknown', certainty: "Can't tell", probability: 0.2 }
    unknown.damage = {
      source: 'recorded',
      photos: [],
      findings: [],
      notAssessed: { reason: 'Unknown face' },
    }
    const combined = combinePhotoRuns(
      [
        { index: 1, name: PHOTO.name, record: known },
        { index: 2, name: 'obscured.jpg', record: unknown },
      ],
      { id: 'combined' },
    )
    expect(combined.damage!.unplaced?.[0]?.observations).toMatchObject([
      {
        findingId: 2,
        photo: { index: 2, name: 'obscured.jpg' },
        evidence: { location: 'Photo-right door leaf, bottom third' },
      },
    ])
  })

  it('is a recorded demonstration: no live source, saved bodies kept, complete', async () => {
    const { live, recording } = await liveRun('openrouter')

    const replayed = replayRecording(recording, { id: 'demo-coyu-1', photo: PHOTO })

    expect(replayed).toMatchObject({ id: 'demo-coyu-1', source: 'recorded', status: 'complete' })
    expect(replayed.photo).toEqual(PHOTO)
    expect(replayed.rawResponses.map((r) => r.body)).toEqual(live.rawResponses.map((r) => r.body))
    expect(replayed.rawResponses.map((r) => r.passId)).toEqual(
      live.rawResponses.map((r) => r.passId.replace(live.id, 'demo-coyu-1')),
    )
    expect(new Set(replayed.rawResponses.map((r) => r.capturedFrom))).toEqual(
      new Set(['recorded-fixture']),
    )
  })

  it('replays on OpenAI too: the same numbered regions, zoomed read and combination', async () => {
    const { live, recording } = await liveRun('luna')

    const replayed = replayRecording(recording, { id: live.id, photo: PHOTO })

    expect(replayed.regions).toMatchObject({ outcome: 'located' })
    expect(replayed.idCropRead).toMatchObject({ outcome: 'combined', marks: [3, 4] })
    expect(replayed.idCropRead).toEqual(live.idCropRead)
    expect(replayed.containerId).toEqual(live.containerId)
    expect(replayed.details).toEqual(live.details)
    expect(replayed.damage).toEqual(live.damage)
    expect(replayed.weights).toEqual(live.weights)
  })

  it('replays the weights second look when the recorded run needed one', async () => {
    // The pounds on max gross are misread by a digit: kg and lb disagree, so the weights are asked again.
    const misread = weightChoices({
      ...COYU_WEIGHTS,
      maxGross: { kg: '30,480', lb: '67,900' },
    })
    const { live, recording } = await liveRun('openrouter', {
      survey: openRouterSurveyReply(COYU, { box: true, details: { ...DETAILS, ...misread } }),
      weights: openRouterSurveyReply(COYU, { details: weightChoices(COYU_WEIGHTS) }),
    })
    expect(live.weights?.reread).toBe('settled')

    const replayed = replayRecording(recording, { id: 'demo-coyu-3', photo: PHOTO })

    expect(recording.entries.map((e) => e.request)).toContain('weights')
    expect(replayed.weights).toEqual(live.weights)
    expect(replayed.weights?.maxGross?.valueLb).toBe(67200)
  })

  it('carries each request’s latency and cost beside its response, from the ledger', async () => {
    const { recording } = await liveRun('openrouter')

    const read = recording.entries.find((e) => e.request === 'read')!
    expect(read.costUsd).toBe(0.0003)
    expect(read.latencyMs).toEqual(expect.any(Number))
    expect(recording.provider).toBe('openrouter')
    expect(recording.model).toBe('~typesafe/jev-latest')
    expect(recording.photo).toBe('samples/rear-door-coyu-22g1.jpg')
    expect(recording.recordedAt).toBe('2026-10-17T09:00:00.000Z')
  })

  it('refuses to record a run that did not complete', async () => {
    const { live } = await liveRun('openrouter')

    expect(() =>
      recordRun({ ...live, status: 'partial' }, useLedgerStore().entries(), {
        photo: 'samples/x.jpg',
        recordedAt: '2026-10-17T09:00:00.000Z',
      }),
    ).toThrow(/complete/)
  })

  it('survives a JSON round trip and refuses a recording that contains a key', async () => {
    const { recording } = await liveRun('openrouter')

    const parsed = parsePlanRecording(JSON.parse(JSON.stringify(recording)))
    expect(parsed).toEqual(recording)

    const leaky = JSON.parse(JSON.stringify(recording))
    // Built at run time so that this file holds no key-shaped text itself.
    leaky.entries[0].response.note = `Authorization: Bearer ${['sk', 'or', 'v1', 'abcdef0123456789abcdef'].join('-')}`
    expect(() => parsePlanRecording(leaky)).toThrow(/key/i)
  })
})
