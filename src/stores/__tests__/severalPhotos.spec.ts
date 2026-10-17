import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// jsdom has no image decoder or canvas; photo preparation runs on the fake codec.
vi.mock('../../services/imageCodec')

import { MAX_PHOTOS, TOO_MANY_PHOTOS, useInspectionStore, type SelectedPhoto } from '../inspection'
import { useLedgerStore } from '../ledger'
import { onlyRequests } from '../../plan/registry'
import { survey } from '../../plan/requests/survey'
import { idRecheck } from '../../plan/requests/idRecheck'
import { sideDamage } from '../../plan/requests/sideDamage'
import { doorDamage } from '../../plan/requests/doorDamage'
import { spendCaps } from '../../domain/rates'
import { buildInspectionExport } from '../../domain/exports'

// Several photos of one container (#70) through the store, with fetch stubbed at the network edge. Each fake
// photo has its own size, so the stub can tell which photo a request carries.

const KEY = 'test-only-openai-key-0000'
const COYU = 'COYU2668130'
const APHU = 'APHU6586847'

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

/** An OpenAI Decisions reply: the ID (a "?" is answered too weakly to read), and the face. */
function surveyReply(id: string, face: string, p = 0.98) {
  const choice = (name: string, value: string, probability: number) => ({
    type: 'choice',
    name,
    choice: value,
    probabilities: [{ value, probability }],
  })
  const answers = id
    .split('')
    .map((ch, i) =>
      choice(
        `id_char_${String(i + 1).padStart(2, '0')}`,
        ch === '?' ? '0' : ch,
        ch === '?' ? 0.2 : p,
      ),
    )
  answers.push(choice('photo_face', face, 0.96))
  return { model: 'gpt-6-luna', answers, usage: { input_tokens: 6000, output_tokens: 0 } }
}

/** A damage set's reply: nothing found, everything visible. */
const damageReply = () => ({
  model: 'gpt-6-luna',
  answers: [],
  usage: { input_tokens: 9000, output_tokens: 0 },
})

const isSide = (body: string) => body.includes('Z1T_DT')
const isDoor = (body: string) => body.includes('D1T_DT')
const isRecheck = (body: string) => !body.includes('photo_face') && body.includes('id_char_')

/** The fake photo (its size) a request body carries. */
function photoOf(body: string): string {
  const url = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/.exec(body)?.[1] ?? ''
  return atob(url)
}

const photoNamed = (name: string, width: number): SelectedPhoto => ({
  name,
  url: `blob:${name}`,
  orientation: 'landscape',
  file: new Blob([`${width}x800`], { type: 'image/jpeg' }),
})

interface Photo {
  name: string
  width: number
  id: string
  face: string
  p?: number
}

describe('several photos of one container', () => {
  let restore: () => void

  beforeEach(() => {
    setActivePinia(createPinia())
    restore = onlyRequests(survey, idRecheck, sideDamage, doorDamage)
  })

  afterEach(() => {
    restore()
    vi.unstubAllGlobals()
  })

  function run(photos: Photo[]) {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = String(init?.body)
      if (isDoor(body) || isSide(body)) return json(damageReply())
      const photo = photos.find((p) => photoOf(body).includes(`${p.width}x`))!
      return json(surveyReply(photo.id, photo.face, photo.p))
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = useInspectionStore()
    store.setProvider('luna')
    store.setApiKey(KEY)
    const refused = store.setPhotos(photos.map((p) => photoNamed(p.name, p.width)))
    const requests = () =>
      fetchMock.mock.calls.map(([, init]) => {
        const body = String(init?.body)
        return {
          photo: photos.find((p) => photoOf(body).includes(`${p.width}x`))?.name,
          kind: isDoor(body)
            ? 'door'
            : isSide(body)
              ? 'side'
              : isRecheck(body)
                ? 'recheck'
                : 'survey',
        }
      })
    return { store, fetchMock, refused, requests }
  }

  const DOORS: Photo = { name: 'doors.jpg', width: 1000, id: COYU, face: 'rear_doors' }
  const SIDE: Photo = { name: 'side.jpg', width: 1100, id: COYU, face: 'long_side' }

  it('takes up to four photos at once and refuses more with a plain message', () => {
    const { store, refused } = run(
      Array.from({ length: MAX_PHOTOS }, (_, i) => ({
        ...DOORS,
        name: `p${i}.jpg`,
        width: 1000 + i,
      })),
    )
    expect(refused).toBeNull()
    expect(store.photos.map((p) => p.name)).toEqual(['p0.jpg', 'p1.jpg', 'p2.jpg', 'p3.jpg'])

    const tooMany = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) =>
      photoNamed(`q${i}.jpg`, 900 + i),
    )
    expect(store.setPhotos(tooMany)).toBe(TOO_MANY_PHOTOS)
    expect(TOO_MANY_PHOTOS).toBe('Choose up to 4 photos of one container.')
    // Nothing changed: the earlier photos are still the ones on screen.
    expect(store.photos.map((p) => p.name)).toEqual(['p0.jpg', 'p1.jpg', 'p2.jpg', 'p3.jpg'])
  })

  it('gives each photo a survey and only the damage set of its own face', async () => {
    const { store, requests } = run([DOORS, SIDE])

    await store.start()

    expect(
      requests().sort((a, b) => `${a.photo}${a.kind}`.localeCompare(`${b.photo}${b.kind}`)),
    ).toEqual([
      { photo: 'doors.jpg', kind: 'door' },
      { photo: 'doors.jpg', kind: 'survey' },
      { photo: 'side.jpg', kind: 'side' },
      { photo: 'side.jpg', kind: 'survey' },
    ])
    expect(store.photos).toHaveLength(2)
    expect(store.record?.photos?.map((p) => [p.name, p.face?.face])).toEqual([
      ['doors.jpg', 'rear-doors'],
      ['side.jpg', 'long-side'],
    ])
  })

  it('makes one record with the ID combined across the photos and one cost total', async () => {
    const { store } = run([
      { ...DOORS, id: 'COYU26????0' },
      { ...SIDE, id: '??YU266813?', width: 1100 },
    ])

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.containerId?.value).toBe(COYU)
    expect(store.record?.containerId?.checkDigitValid).toBe(true)
    expect(store.record?.differentContainers).toBe(false)
    // One container, one total; each request is its own line, named for its photo.
    const ledger = useLedgerStore()
    // Two surveys, two re-checks of the unread positions, one damage set each.
    expect(ledger.inspectionTotals(store.runId!).requests).toBe(6)
    expect(ledger.entries().map((e) => e.purpose)).toEqual(
      expect.arrayContaining(['Reading markings (photo 1)', 'Reading markings (photo 2)']),
    )
  })

  it('raises a reading both photos give one step', async () => {
    const { store } = run([
      { ...DOORS, p: 0.7 },
      { ...SIDE, id: COYU, p: 0.7 },
    ])

    await store.start()

    expect(store.record?.containerId?.certainty).toBe('Confident')
  })

  it('warns, and does not combine, when two different IDs both pass the check digit', async () => {
    const { store } = run([DOORS, { ...SIDE, id: APHU }])

    await store.start()

    expect(store.status).toBe('complete')
    expect(store.record?.differentContainers).toBe(true)
    expect(store.record?.containerId).toBeNull()
    expect(store.record?.damage).toBeNull()
  })

  it('drops a photo that is not a container and sends nothing more for it', async () => {
    const { store, requests } = run([
      DOORS,
      { name: 'lorry.jpg', width: 1200, id: '???????????', face: 'not_a_container' },
    ])

    await store.start()

    expect(requests().filter((r) => r.photo === 'lorry.jpg')).toEqual([
      { photo: 'lorry.jpg', kind: 'survey' },
    ])
    expect(store.status).toBe('complete')
    expect(store.record?.photos?.map((p) => [p.name, p.dropped])).toEqual([
      ['doors.jpg', false],
      ['lorry.jpg', true],
    ])
    expect(store.record?.containerId?.value).toBe(COYU)
  })

  it('says why when no photo shows a container', async () => {
    const { store } = run([
      { name: 'a.jpg', width: 1000, id: '???????????', face: 'not_a_container' },
      { name: 'b.jpg', width: 1100, id: '???????????', face: 'not_a_container' },
    ])

    await store.start()

    expect(store.status).toBe('failed')
    expect(store.errorMessage).toBe(
      "Photo 1 doesn't show a container. Photo 2 doesn't show a container",
    )
  })

  it('lets a photo whose face cannot be identified still give its ID, with no damage request', async () => {
    const { store, requests } = run([
      { ...DOORS, id: 'COYU26????0' },
      { name: 'blurred.jpg', width: 1300, id: '??YU266813?', face: 'unknown' },
    ])

    await store.start()

    const kinds = requests()
      .filter((r) => r.photo === 'blurred.jpg')
      .map((r) => r.kind)
    expect(kinds).not.toContain('door')
    expect(kinds).not.toContain('side')
    expect(store.record?.containerId?.value).toBe(COYU)
    expect(store.record?.photos?.[1]?.contributed.containerId).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('lists each photo, its face and which readings came from it in the JSON export', async () => {
    const { store } = run([
      { ...DOORS, id: 'COYU26????0' },
      { ...SIDE, id: '??YU266813?' },
    ])

    await store.start()

    const photos = buildInspectionExport(store.record!).photos
    expect(photos).toMatchObject([
      {
        photo: 'doors.jpg',
        face: 'rear-doors',
        readings: { containerId: { positions: [1, 2, 3, 4, 5, 6, 11] } },
      },
      {
        photo: 'side.jpg',
        face: 'long-side',
        readings: { containerId: { positions: [3, 4, 5, 6, 7, 8, 9, 10] } },
      },
    ])
  })

  it('shows progress for the whole container, not per photo', async () => {
    const { store } = run([DOORS, SIDE])
    const done = store.start()
    expect(store.stages.map((s) => s.id)).toEqual(['id', 'details', 'damage'])
    expect(store.planned.map((r) => r.id)).toEqual(expect.arrayContaining(['p1-read', 'p2-read']))
    await done
    expect(store.stages.every((s) => s.state === 'done')).toBe(true)
  })

  it('stops at 30 requests and $0.50 for the container', () => {
    expect(spendCaps).toEqual({ maxRequestsPerInspection: 30, maxSpendUsdPerInspection: 0.5 })
  })

  it('re-checks the ID only for a photo in which some of it was read', async () => {
    const { store, requests } = run([
      { ...DOORS, id: 'COYU26????0' },
      { name: 'roof.jpg', width: 1400, id: '???????????', face: 'long_side' },
    ])

    await store.start()

    expect(requests().filter((r) => r.kind === 'recheck')).toEqual([
      { photo: 'doors.jpg', kind: 'recheck' },
    ])
  })

  it('leaves one photo exactly as before: no photo summary, every request in parallel', async () => {
    const { store, requests } = run([DOORS])

    await store.start()

    expect(store.record?.photos).toBeUndefined()
    expect(
      requests()
        .map((r) => r.kind)
        .sort(),
    ).toEqual(['door', 'side', 'survey'])
  })
})
