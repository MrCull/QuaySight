import { describe, it, expect } from 'vitest'
import { buildKeyFacts, type KeyFactTile, type PartStates } from '../keyFacts'
import { buildContainerIdReading } from '../containerId'
import type { DamageAssessment, DamageFinding } from '../damage'
import type { InspectionRecord } from '../inspection'
import type { SealReading } from '../sealFamily'
import type { PlacardReading, PlacardsReading } from '../placards'
import { liveDetailsRecord, coyuDetails } from '../../__tests__/liveDetails'

// The key-facts tiles (spec 8.1, ticket 102): a pure function of the inspection record and which
// parts of the run have arrived. Read the way a presenter does: the tile, its words, its certainty.

const ARRIVED: PartStates = { id: 'arrived', details: 'arrived', damage: 'arrived' }
const READING: PartStates = { id: 'reading', details: 'reading', damage: 'reading' }

const finding = (id: number, over: Partial<DamageFinding> = {}): DamageFinding => ({
  id,
  face: 'long-side',
  zone: { u0: 0.2, u1: 0.4, v0: 0.5, v1: 1 },
  component: 'panel',
  visibility: 'clear',
  location: 'lower middle of the long side',
  title: 'Dent in the side sheet',
  description: '',
  bestInterpretation: '',
  uncertainty: '',
  types: [{ code: 'DT', name: 'Dent', probability: 0.92 }],
  severity: 'moderate',
  certainty: 'Confident',
  caveats: [],
  ...over,
})

const assessed = (findings: DamageFinding[]): DamageAssessment => ({
  source: 'live',
  photos: [{ photo: 'side.jpg', face: 'long-side' }],
  findings,
  imageQuality: 'good',
  coverage: 'full',
  significantProbability: 0.2,
})

const seal = (over: Partial<SealReading> = {}): SealReading => ({
  visible: true,
  characters: [
    { value: 'E', certainty: 'Confident' },
    { value: '7', certainty: 'Confident' },
  ],
  value: 'E7',
  certainty: 'Confident',
  ...over,
})

async function record(over: Partial<InspectionRecord> = {}): Promise<InspectionRecord> {
  const base = await liveDetailsRecord()
  return {
    ...base,
    containerId: buildContainerIdReading({ printed: 'COYU2668130', certainty: 'Confident' }),
    seal: seal(),
    damage: assessed([]),
    ...over,
  }
}

/** An ID with positions not read: the ID builder needs a full number, so unread marks go in afterwards. */
const partlyRead = (value: string, certainty: 'Uncertain') => ({
  ...buildContainerIdReading({ printed: 'COYU2668130', certainty }),
  value,
  checkDigitValid: false,
  calculatedCheckDigit: null,
})

const tile = (tiles: KeyFactTile[], id: KeyFactTile['id']) => tiles.find((t) => t.id === id)

describe('the tiles of a full result', () => {
  it('are the container ID, the seal and the damage, in that order, and no placards tile without a placard', async () => {
    const tiles = buildKeyFacts(await record(), ARRIVED)
    expect(tiles.map((t) => t.id)).toEqual(['id', 'seal', 'damage'])
  })
})

describe('the Container ID tile', () => {
  it('shows the ID with its certainty', async () => {
    const id = tile(buildKeyFacts(await record(), ARRIVED), 'id')!
    expect(id.label).toBe('Container ID')
    expect(id.state).toBe('arrived')
    expect(id.reading?.value).toBe('COYU2668130')
    expect(id.certainty).toBe('Confident')
  })

  it('lowers the certainty when the check digit does not match', async () => {
    const containerId = buildContainerIdReading({ printed: 'COYU2668131', certainty: 'Confident' })
    const id = tile(buildKeyFacts(await record({ containerId }), ARRIVED), 'id')!
    expect(id.certainty).toBe('Uncertain')
  })

  it('keeps the partial reading when a position was not read', async () => {
    const containerId = partlyRead('COYU26?8130', 'Uncertain')
    const id = tile(buildKeyFacts(await record({ containerId }), ARRIVED), 'id')!
    expect(id.reading).not.toBeNull()
  })

  it('says "ID not readable in this photo" when fewer than 6 characters were read, and shows no ID', async () => {
    const containerId = partlyRead('CO?????????', 'Uncertain')
    const id = tile(buildKeyFacts(await record({ containerId }), ARRIVED), 'id')!
    expect(id.headline).toBe('ID not readable in this photo')
    expect(id.reading).toBeNull()
  })

  it("is Can't tell when the run read no ID at all", async () => {
    const id = tile(buildKeyFacts(await record({ containerId: null }), ARRIVED), 'id')!
    expect(id.headline).toBe('ID not readable in this photo')
    expect(id.certainty).toBe("Can't tell")
  })
})

describe('the Seal tile', () => {
  it('shows the number and its certainty', async () => {
    const t = tile(buildKeyFacts(await record(), ARRIVED), 'seal')!
    expect(t.label).toBe('Seal')
    expect(t.headline).toBe('E7')
    expect(t.certainty).toBe('Confident')
  })

  it('marks an unread character with a middle dot', async () => {
    const reading = seal({ value: 'E?', certainty: 'Uncertain' })
    const t = tile(buildKeyFacts(await record({ seal: reading }), ARRIVED), 'seal')!
    expect(t.headline).toBe('E·')
    expect(t.certainty).toBe('Uncertain')
  })

  it('says Not seen when no seal is visible', async () => {
    const reading = seal({ visible: false, characters: [], value: '', certainty: 'Not seen' })
    const t = tile(buildKeyFacts(await record({ seal: reading }), ARRIVED), 'seal')!
    expect(t.headline).toBe('Not seen')
    expect(t.certainty).toBe('Not seen')
  })

  it('says the number is not readable when a seal is visible with no number', async () => {
    const reading = seal({ characters: [], value: '', certainty: "Can't tell" })
    const t = tile(buildKeyFacts(await record({ seal: reading }), ARRIVED), 'seal')!
    expect(t.headline).toBe('Number not readable')
    expect(t.certainty).toBe("Can't tell")
  })

  it('says not assessed, never Not seen, when the survey did not answer', async () => {
    const t = tile(buildKeyFacts(await record({ seal: undefined }), ARRIVED), 'seal')!
    expect(t.headline).toBe('Not assessed')
    expect(t.certainty).toBeNull()
  })
})

describe('the Damage tile', () => {
  it('counts the findings and names the worst severity', async () => {
    const damage = assessed([
      finding(1, { severity: 'minor' }),
      finding(2, { severity: 'major', certainty: 'Likely' }),
      finding(3, { severity: 'cosmetic' }),
    ])
    const t = tile(buildKeyFacts(await record({ damage }), ARRIVED), 'damage')!
    expect(t.label).toBe('Damage')
    expect(t.headline).toBe('3 findings')
    expect(t.severity).toBe('major')
  })

  it('says 1 finding in the singular', async () => {
    const t = tile(
      buildKeyFacts(await record({ damage: assessed([finding(1)]) }), ARRIVED),
      'damage',
    )!
    expect(t.headline).toBe('1 finding')
    expect(t.severity).toBe('moderate')
  })

  it("has no severity when none of the findings is rated (Can't tell)", async () => {
    const damage = assessed([finding(1, { severity: null })])
    const t = tile(buildKeyFacts(await record({ damage }), ARRIVED), 'damage')!
    expect(t.headline).toBe('1 finding')
    expect(t.severity).toBeNull()
    expect(t.notes).toEqual(["Severity can't tell"])
  })

  it('says none seen when there are no findings', async () => {
    const t = tile(buildKeyFacts(await record(), ARRIVED), 'damage')!
    expect(t.headline).toBe('None seen')
    expect(t.severity).toBeNull()
  })

  it('says not assessed when the damage view was not assessed', async () => {
    const damage = {
      ...assessed([]),
      notAssessed: { reason: 'The photo shows no container side.' },
    }
    const t = tile(buildKeyFacts(await record({ damage }), ARRIVED), 'damage')!
    expect(t.headline).toBe('Not assessed')
  })
})

describe('the Placards tile', () => {
  async function withPlacard(certainty: 'Confident' | 'Uncertain', dgClass: number | null) {
    const details = {
      ...coyuDetails(),
      dgPlacard: { answer: 'placard' as const, dgClass, symbol: 'Flame', certainty },
    }
    return record({ details })
  }

  it('appears, with the class and its certainty, when a placard is seen', async () => {
    const tiles = buildKeyFacts(await withPlacard('Confident', 3), ARRIVED)
    expect(tiles.map((t) => t.id)).toEqual(['id', 'seal', 'damage', 'placards'])
    const t = tile(tiles, 'placards')!
    expect(t.label).toBe('Placards')
    expect(t.headline).toBe('Class 3, flammable liquids')
    expect(t.certainty).toBe('Confident')
  })

  it('says a placard is seen when its class was not read', async () => {
    const t = tile(buildKeyFacts(await withPlacard('Uncertain', null), ARRIVED), 'placards')!
    expect(t.headline).toBe('Placard seen')
    expect(t.certainty).toBe('Uncertain')
  })

  it('is absent when no placard is seen, or the details were not read', async () => {
    expect(tile(buildKeyFacts(await record(), ARRIVED), 'placards')).toBeUndefined()
    const none = await record({ details: undefined })
    expect(tile(buildKeyFacts(none, ARRIVED), 'placards')).toBeUndefined()
  })

  it('is absent while the details are still being read', async () => {
    const states: PartStates = { ...ARRIVED, details: 'reading' }
    expect(
      tile(buildKeyFacts(await withPlacard('Confident', 3), states), 'placards'),
    ).toBeUndefined()
  })
})

describe('the Placards tile from the placards question family', () => {
  const marks = {
    marinePollutant: { answer: 'no', certainty: 'Not seen' },
    limitedQuantity: { answer: 'no', certainty: 'Not seen' },
  } as const
  const placard = (dgClass: number | null): PlacardReading => ({
    dgClass,
    unNumber: '1203',
    certainty: 'Likely',
  })
  const reading = (
    answer: PlacardsReading['answer'],
    placards: PlacardReading[],
  ): PlacardsReading => ({
    answer,
    certainty: 'Likely',
    placards,
    ...marks,
  })

  it('names the class of a single placard, with the reading certainty', async () => {
    const placards = reading('present', [placard(3)])
    const t = tile(buildKeyFacts(await record({ placards }), ARRIVED), 'placards')!
    expect(t.headline).toBe('Class 3, flammable liquids')
    expect(t.certainty).toBe('Likely')
  })

  it('counts several placards and lists their classes', async () => {
    const placards = reading('present', [placard(3), placard(8), placard(null)])
    const t = tile(buildKeyFacts(await record({ placards }), ARRIVED), 'placards')!
    expect(t.headline).toBe('3 placards')
    expect(t.notes).toEqual(['Class 3, Class 8'])
  })

  it('says a placard is seen when it was visible but not read', async () => {
    const placards = reading('present', [])
    const t = tile(buildKeyFacts(await record({ placards }), ARRIVED), 'placards')!
    expect(t.headline).toBe('Placard seen')
  })

  it('is absent when none were seen or the photo did not settle it', async () => {
    for (const placards of [reading('none', []), reading('unclear', [])]) {
      expect(tile(buildKeyFacts(await record({ placards }), ARRIVED), 'placards')).toBeUndefined()
    }
  })
})

describe('arrived or reading', () => {
  it('shows Reading… for every tile before anything has arrived, with no record', () => {
    const tiles = buildKeyFacts(null, READING)
    expect(tiles.map((t) => [t.id, t.state, t.headline])).toEqual([
      ['id', 'reading', 'Reading…'],
      ['seal', 'reading', 'Reading…'],
      ['damage', 'reading', 'Reading…'],
    ])
    expect(tiles.every((t) => t.certainty === null && t.reading === null)).toBe(true)
  })

  it('fills in the ID and the seal when the ID part lands, while damage is still reading', async () => {
    const tiles = buildKeyFacts(await record(), { ...READING, id: 'arrived' })
    expect(tile(tiles, 'id')!.state).toBe('arrived')
    expect(tile(tiles, 'seal')!.state).toBe('arrived')
    expect(tile(tiles, 'damage')).toMatchObject({ state: 'reading', headline: 'Reading…' })
  })

  it('does not show a value for a part that has not arrived, even when the record has one', async () => {
    const t = tile(buildKeyFacts(await record(), { ...ARRIVED, damage: 'reading' }), 'damage')!
    expect(t.headline).toBe('Reading…')
    expect(t.severity).toBeNull()
  })

  it('says No result, not Not seen, for a part that failed or was cancelled', async () => {
    const tiles = buildKeyFacts(await record(), { ...ARRIVED, damage: 'unavailable' })
    expect(tile(tiles, 'damage')).toMatchObject({
      state: 'unavailable',
      headline: 'No result',
      certainty: null,
    })
  })
})
