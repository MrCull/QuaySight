import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { CostLedger } from '../../domain/ledger'
import { spendCaps, rateSchedules } from '../../domain/rates'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('../../services/imageCodec')
import { useInspectionStore } from '../../stores/inspection'
import { useLedgerStore } from '../../stores/ledger'
import { onlyRequests } from '../registry'
import { survey } from '../requests/survey'
import { doorDamage } from '../requests/doorDamage'
import { damageLocalisation } from '../requests/damageLocalisation'
import { dentedSideReply, doorReply, keyedReply, openAiShape } from '../../__tests__/planReplies'
import { openRouterSurveyReply, openAiSurveyReply } from '../../__tests__/surveyReplies'
import { recordRun } from '../recording'
import { replayRecording } from '../replay'
import { buildInspectionExport } from '../../domain/exports'
import { liveRoute } from '../../services/__tests__/liveCalls'
import { sideDamage } from '../requests/sideDamage'
import { doorEndCrop } from '../requests/doorEndCrop'
import type { PlanView } from '../requestPlan'

let restore: () => void
beforeEach(() => {
  setActivePinia(createPinia())
  restore = onlyRequests(survey, doorDamage, damageLocalisation)
})
afterEach(() => {
  restore()
  vi.unstubAllGlobals()
})
const box = { top: 0.55, bottom: 0.8, left: 0.6, right: 0.9 }
async function run(
  answer: unknown,
  enabled = true,
  model = 'typesafe/jev-1.14',
  beforeReply?: (body: string) => Promise<void>,
  several = false,
  damageReply = doorReply(),
) {
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    const body = String(init?.body)
    await beforeReply?.(body)
    if (body.includes('target_box') && answer instanceof Response) return answer
    const reply = body.includes('target_box')
      ? answer
      : body.includes('D1T_DT')
        ? damageReply
        : openRouterSurveyReply('COYU2668130', { details: { photo_face: [['rear_doors', 0.96]] } })
    return new Response(
      JSON.stringify(
        model === 'gpt-6-luna'
          ? body.includes('D1T_DT')
            ? openAiShape(doorReply())
            : openAiSurveyReply('COYU2668130', { details: { photo_face: [['rear_doors', 0.96]] } })
          : reply,
      ),
      { headers: { 'Content-Type': 'application/json' } },
    )
  })
  vi.stubGlobal('fetch', fetcher)
  const store = useInspectionStore()
  store.setProvider(model === 'gpt-6-luna' ? 'luna' : 'openrouter')
  store.setModel(model)
  store.setApiKey('test-only-key')
  store.experimentalDamageLocalisation = enabled
  store.setPhoto({
    name: 'door.jpg',
    url: 'blob:door',
    orientation: 'square',
    file: new Blob(['1080x1080'], { type: 'image/jpeg' }),
  })
  if (several) store.setPhotos([store.photo!, { ...store.photo!, url: 'blob:other-door' }])
  await store.start()
  return { store, fetcher }
}
function reply(presence = 0.95, confidence = 0.67, geometry: unknown = box, versioned = false) {
  return keyedReply({
    [versioned ? 'target_present_v2' : 'target_present']: { type: 'noul', noul: presence },
    [versioned ? 'target_box_v2' : 'target_box']: { type: 'box', box: geometry, confidence },
  })
}
it('locates a long-side finding even when a corner photo has a separate cropped door assessment', () => {
  const route = liveRoute('openrouter', 'typesafe/jev-1.14')
  const side = sideDamage.replay!(dentedSideReply(), { route } as PlanView, {})
  const door = doorDamage.replay!(doorReply(), { route } as PlanView, {})
  const answers = new Map<string, unknown>([
    [
      survey.id,
      {
        findings: {
          face: {
            face: 'long-side',
            shown: ['long-side', 'rear-doors'],
            probability: 0.95,
            certainty: 'Confident',
          },
        },
      },
    ],
    [sideDamage.id, side],
    [doorDamage.id, door],
    [doorEndCrop.id, { reading: door }],
  ])
  const plan: PlanView = { route, answer: (request) => answers.get(request.id) as never }
  expect(damageLocalisation.needed!(plan)).toBe(true)
  const located = damageLocalisation.replay!(reply(), plan, {})
  expect(located).toHaveLength(1)
  expect(located[0]!.observation).toContain('long-side')
  expect(located[0]!.location?.box).toEqual(box)
})
it('adds an approximate focal highlight to an existing observation and preserves it in replay and export', async () => {
  const { store } = await run(reply())
  const observation = store.record!.damage!.findings[0]!.observations![0]!
  expect(observation.localisation).toMatchObject({
    box,
    presence: 0.95,
    confidence: 0.67,
    coordinateSpace: 'upright-original',
    resolvedModel: 'typesafe/jev-1.14-20261014',
  })
  const recording = recordRun(store.record!, useLedgerStore().entries(), {
    photo: 'samples/door.jpg',
    recordedAt: '2026-10-30T00:00:00Z',
  })
  const replay = replayRecording(recording, { id: store.record!.id, photo: store.record!.photo })
  expect(replay.damage).toEqual(store.record!.damage)
  expect(JSON.stringify(buildInspectionExport(replay))).toContain('upright-original')
})
it.each([
  ['absent target', reply(0.2)],
  ['low confidence', reply(0.95, 0.49)],
  ['out of bounds', reply(0.95, 0.67, { ...box, left: -0.1 })],
  ['degenerate', reply(0.95, 0.67, { ...box, right: 0.6 })],
  ['missing', keyedReply({})],
  ['string coordinates', reply(0.95, 0.67, { ...box, top: '0.55' })],
  ['invalid confidence', reply(0.95, 2)],
  ['invalid presence', reply(2)],
])('retains the finding without a highlight when %s', async (_name, answer) => {
  const { store } = await run(answer)
  expect(store.record!.damage!.findings).toHaveLength(1)
  expect(store.record!.damage!.findings[0]!.observations![0]!.localisation).toBeUndefined()
  expect(store.record!.rawResponses).toHaveLength(3)
  expect(store.record!.status).toBe('complete')
})
it.each([
  [false, 'typesafe/jev-1.14'],
  [true, 'typesafe/jev-1.13'],
  [true, 'gpt-6-luna'],
] as const)('sends no optional Box request when enabled=%s model=%s', async (enabled, model) => {
  const { store, fetcher } = await run(reply(), enabled, model)
  expect(fetcher.mock.calls.some(([, init]) => String(init?.body).includes('target_box'))).toBe(
    false,
  )
  expect(store.record!.damage!.findings).toHaveLength(1)
})
it.each(['typesafe/jev-1.13', 'gpt-6-luna'])(
  'never sends any Box question to %s',
  async (model) => {
    const { fetcher } = await run(reply(), true, model)
    const questions = fetcher.mock.calls.flatMap(([, init]) => {
      const body = JSON.parse(String(init?.body))
      return Array.isArray(body.questions) ? body.questions : Object.values(body.questions ?? {})
    })
    expect(questions.some((q: { type?: string }) => q.type === 'box')).toBe(false)
  },
)
it('keeps valid findings complete when the optional provider call fails without paid retry', async () => {
  const { store, fetcher } = await run(new Response('{}', { status: 500 }))
  expect(store.record!.damage!.findings).toHaveLength(1)
  expect(store.record!.status).toBe('complete')
  expect(
    fetcher.mock.calls.filter(([, init]) => String(init?.body).includes('target_box')),
  ).toHaveLength(1)
  expect(
    useLedgerStore()
      .entries()
      .find((e) => e.id.endsWith('damage-localisation'))?.status,
  ).toBe('failed')
})
it('locates two distinct assessed regions in one request and associates each answer with its finding', async () => {
  const damage = doorReply()
  damage.answers.D1T_DT = { type: 'noul', noul: 0.91 }
  damage.answers.D1T_severity = damage.answers.D2B_severity!
  const response = keyedReply({
    target_present_0: { type: 'noul', noul: 0.95 },
    target_box_0: { type: 'box', box, confidence: 0.67 },
    target_present_1: { type: 'noul', noul: 0.96 },
    target_box_1: {
      type: 'box',
      box: { top: 0.1, bottom: 0.3, left: 0.1, right: 0.4 },
      confidence: 0.7,
    },
  })
  const { store, fetcher } = await run(
    response,
    true,
    'typesafe/jev-1.14',
    undefined,
    false,
    damage,
  )
  const calls = fetcher.mock.calls.filter(([, init]) => String(init?.body).includes('target_box'))
  expect(calls).toHaveLength(1)
  const observations = store.record!.damage!.findings.flatMap((f) => f.observations ?? [])
  expect(observations).toHaveLength(2)
  expect(observations.map((o) => o.localisation?.box)).toEqual([
    box,
    { top: 0.1, bottom: 0.3, left: 0.1, right: 0.4 },
  ])
})
it('keeps a valid batch location when another target is absent', async () => {
  const damage = doorReply()
  damage.answers.D1T_DT = { type: 'noul', noul: 0.91 }
  damage.answers.D1T_severity = damage.answers.D2B_severity!
  const response = keyedReply({
    target_present_0: { type: 'noul', noul: 0.95 },
    target_box_0: { type: 'box', box, confidence: 0.67 },
    target_present_1: { type: 'noul', noul: 0.2 },
    target_box_1: { type: 'box', box, confidence: 0.99 },
  })
  const { store } = await run(response, true, 'typesafe/jev-1.14', undefined, false, damage)
  const observations = store.record!.damage!.findings.flatMap((f) => f.observations ?? [])
  expect(observations).toHaveLength(2)
  expect(observations[0]!.localisation?.box).toEqual(box)
  expect(observations[1]!.localisation).toBeUndefined()
})
it('localises a strongly supported finding even when it has secondary damage types', async () => {
  const damage = doorReply()
  damage.answers.D2B_BT = { type: 'noul', noul: 0.72 }
  const baseline = (await run(reply(), false, 'typesafe/jev-1.14', undefined, false, damage)).store
    .record!.damage!.findings[0]!
  const { store, fetcher } = await run(
    reply(0.95, 0.67, box, true),
    true,
    'typesafe/jev-1.14',
    undefined,
    false,
    damage,
  )
  const finding = store.record!.damage!.findings[0]!
  expect(finding.types.map((type) => type.name)).toEqual(expect.arrayContaining(['Dent', 'Bent']))
  expect(finding).toMatchObject({
    types: baseline.types,
    severity: baseline.severity,
    certainty: baseline.certainty,
  })
  expect(finding.observations![0]!.localisation?.box).toEqual(box)
  const calls = fetcher.mock.calls.filter(([, init]) => String(init?.body).includes('target_box'))
  expect(calls).toHaveLength(1)
  expect(String(calls[0]![1]?.body)).toContain('Dent on the panel')
  const recording = recordRun(store.record!, useLedgerStore().entries(), {
    photo: 'samples/door.jpg',
    recordedAt: '2026-10-30T00:00:00Z',
  })
  expect(
    replayRecording(recording, { id: store.record!.id, photo: store.record!.photo }).damage,
  ).toEqual(store.record!.damage)
})
it('leaves multi-type findings unlocated when the target is absent or ambiguous', async () => {
  const damage = doorReply()
  damage.answers.D2B_BT = { type: 'noul', noul: 0.72 }
  const { store, fetcher } = await run(
    reply(0.2, 0.67, box, true),
    true,
    'typesafe/jev-1.14',
    undefined,
    false,
    damage,
  )
  const finding = store.record!.damage!.findings[0]!
  expect(finding.types.map((type) => type.name)).toEqual(expect.arrayContaining(['Dent', 'Bent']))
  expect(finding.observations![0]!.localisation).toBeUndefined()
  expect(
    fetcher.mock.calls.filter(([, init]) => String(init?.body).includes('target_box')),
  ).toHaveLength(1)
})
it('uses the strongest supported type when a weaker rupture is first in the finding', async () => {
  const damage = doorReply()
  damage.answers.D2B_CK = { type: 'noul', noul: 0.6 }
  const { store, fetcher } = await run(
    reply(0.95, 0.67, box, true),
    true,
    'typesafe/jev-1.14',
    undefined,
    false,
    damage,
  )
  expect(store.record!.damage!.findings[0]!.observations![0]!.localisation?.box).toEqual(box)
  const call = fetcher.mock.calls.find(([, init]) => String(init?.body).includes('target_box'))
  expect(String(call?.[1]?.body)).toContain('Dent on the panel')
})
it('replays an older single-target answer without attaching it to a newly eligible finding', () => {
  const route = liveRoute('openrouter', 'typesafe/jev-1.14')
  const raw = doorReply()
  raw.answers.D1T_DT = { type: 'noul', noul: 0.91 }
  raw.answers.D1T_BT = { type: 'noul', noul: 0.72 }
  raw.answers.D1T_severity = raw.answers.D2B_severity!
  const door = doorDamage.replay!(raw, { route } as PlanView, {})
  const values = new Map<string, unknown>([
    [
      survey.id,
      {
        findings: {
          face: {
            face: 'rear-doors',
            shown: ['rear-doors'],
            probability: 0.95,
            certainty: 'Confident',
          },
        },
      },
    ],
    [doorDamage.id, door],
  ])
  const plan: PlanView = { route, answer: (request) => values.get(request.id) as never }
  const located = damageLocalisation.replay!(reply(), plan, {})
  expect(located).toHaveLength(1)
  expect(located[0]!.target).toContain('right')
  expect(located[0]!.location?.box).toEqual(box)
})
it('replays older batched answers in their original order when a new finding is eligible', () => {
  const route = liveRoute('openrouter', 'typesafe/jev-1.14')
  const raw = doorReply()
  raw.answers.D1T_DT = { type: 'noul', noul: 0.91 }
  raw.answers.D1T_BT = { type: 'noul', noul: 0.72 }
  raw.answers.D1T_severity = raw.answers.D2B_severity!
  raw.answers.D1M_DT = { type: 'noul', noul: 0.92 }
  raw.answers.D1M_severity = raw.answers.D2B_severity!
  const door = doorDamage.replay!(raw, { route } as PlanView, {})
  const values = new Map<string, unknown>([
    [
      survey.id,
      {
        findings: {
          face: {
            face: 'rear-doors',
            shown: ['rear-doors'],
            probability: 0.95,
            certainty: 'Confident',
          },
        },
      },
    ],
    [doorDamage.id, door],
  ])
  const plan: PlanView = { route, answer: (request) => values.get(request.id) as never }
  const otherBox = { top: 0.1, bottom: 0.3, left: 0.1, right: 0.4 }
  const legacy = keyedReply({
    target_present_0: { type: 'noul', noul: 0.95 },
    target_box_0: { type: 'box', box, confidence: 0.67 },
    target_present_1: { type: 'noul', noul: 0.96 },
    target_box_1: { type: 'box', box: otherBox, confidence: 0.7 },
  })
  const located = damageLocalisation.replay!(legacy, plan, {})
  expect(located).toHaveLength(2)
  expect(located.map((target) => target.location?.box)).toEqual([box, otherBox])
  expect(located[0]!.target).toContain('left')
  expect(located[1]!.target).toContain('right')
})
it('keeps versioned batch answers on their own multi-type and single-type observations', async () => {
  const damage = doorReply()
  damage.answers.D1T_DT = { type: 'noul', noul: 0.91 }
  damage.answers.D1T_BT = { type: 'noul', noul: 0.72 }
  damage.answers.D1T_severity = damage.answers.D2B_severity!
  const otherBox = { top: 0.1, bottom: 0.3, left: 0.1, right: 0.4 }
  const response = keyedReply({
    target_present_v2_0: { type: 'noul', noul: 0.95 },
    target_box_v2_0: { type: 'box', box, confidence: 0.67 },
    target_present_v2_1: { type: 'noul', noul: 0.96 },
    target_box_v2_1: { type: 'box', box: otherBox, confidence: 0.7 },
  })
  const { store, fetcher } = await run(
    response,
    true,
    'typesafe/jev-1.14',
    undefined,
    false,
    damage,
  )
  const observations = store.record!.damage!.findings.flatMap((f) => f.observations ?? [])
  expect(observations.map((observation) => observation.localisation?.box)).toEqual([box, otherBox])
  expect(
    fetcher.mock.calls.filter(([, init]) => String(init?.body).includes('target_box')),
  ).toHaveLength(1)
  const recording = recordRun(store.record!, useLedgerStore().entries(), {
    photo: 'samples/door.jpg',
    recordedAt: '2026-10-30T00:00:00Z',
  })
  expect(
    replayRecording(recording, { id: store.record!.id, photo: store.record!.photo }).damage,
  ).toEqual(store.record!.damage)
})
it('does not request a highlight when no damage type meets the strong-evidence threshold', async () => {
  const damage = doorReply()
  damage.answers.D2B_DT = { type: 'noul', noul: 0.79 }
  damage.answers.D2B_BT = { type: 'noul', noul: 0.72 }
  const { store, fetcher } = await run(reply(), true, 'typesafe/jev-1.14', undefined, false, damage)
  expect(store.record!.damage!.findings).toHaveLength(1)
  expect(fetcher.mock.calls.some(([, init]) => String(init?.body).includes('target_box'))).toBe(
    false,
  )
})
it('discards a stale optional answer after New inspection and retains the session charge', async () => {
  const { store } = await run(reply(), true, 'typesafe/jev-1.14', async (body) => {
    if (body.includes('target_box')) useInspectionStore().newInspection()
  })
  expect(store.record).toBeNull()
  expect(store.status).toBe('idle')
  expect(useLedgerStore().entries()).toHaveLength(3)
})
it('lets the request cap suppress optional localisation while keeping the assessment', async () => {
  useLedgerStore().ledger = new CostLedger(
    { ...spendCaps, maxRequestsPerInspection: 2 },
    rateSchedules,
  )
  const { store, fetcher } = await run(reply())
  expect(store.record!.damage!.findings).toHaveLength(1)
  expect(store.record!.status).toBe('complete')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(store.record!.damage!.findings[0]!.observations![0]!.localisation).toBeUndefined()
})

it('waits for other photos to finish reading, then keeps separate indexed observations for duplicate filenames', async () => {
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let surveys = 0
  let damage = 0
  let localisations = 0
  const running = run(
    reply(),
    true,
    'typesafe/jev-1.14',
    async (body) => {
      if (body.includes('photo_face') && ++surveys === 2) await held
      if (body.includes('D1T_DT')) damage++
      if (body.includes('target_box')) localisations++
    },
    true,
  )
  await vi.waitFor(() => expect(damage).toBe(1))
  expect(localisations).toBe(0)
  release()
  const { store } = await running
  expect(localisations).toBe(2)
  const observations = store.record!.damage!.findings[0]!.observations!
  expect(observations.map((o) => o.photo)).toEqual([
    { name: 'door.jpg', index: 1 },
    { name: 'door.jpg', index: 2 },
  ])
  expect(observations.every((o) => o.localisation?.box.left === 0.6)).toBe(true)
})
