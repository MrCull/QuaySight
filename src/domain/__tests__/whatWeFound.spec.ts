import { describe, it, expect } from 'vitest'
import { buildWhatWeFound, unavailableStages, type WhatWeFound } from '../whatWeFound'
import type { StageId, StageProgress, StageState } from '../runStages'
import { buildContainerIdReading } from '../containerId'
import { decodeSizeCode } from '../isoSizeCode'
import type { DamageAssessment, DamageFinding } from '../damage'
import type { CertaintyLabel, InspectionRecord } from '../inspection'
import { evaluateWeights } from '../weights'
import { liveDetailsRecord } from '../../__tests__/liveDetails'
import {
  liveWeightsRecord,
  coyuReading,
  read,
  NOT_VISIBLE,
  UNCLEAR,
} from '../../__tests__/liveWeights'
import { recordedInspection } from '../../__tests__/recordedInspection'

// The "What we found" summary (spec 8.1, ticket #36): a pure function of the inspection record, the
// units in force and which parts of the run have not arrived. These tests read the whole summary the
// way a presenter does: the headline, then the caveats, then the statements.

const FORBIDDEN =
  /\b(verified|verify|supported|safe|passed|passes|pass|candidates?|retry|retries|refine\w*|non-hazardous|undamaged|clear of damage)\b/i

function everything(found: WhatWeFound): string {
  return [
    found.headline,
    ...found.caveats,
    ...found.gaps,
    ...found.statements.map((s) => s.text),
  ].join('\n')
}
const statement = (found: WhatWeFound, topic: WhatWeFound['statements'][number]['topic']) =>
  found.statements.find((s) => s.topic === topic)?.text

const dent: DamageFinding = {
  id: 1,
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
}

function assessed(overrides: Partial<DamageAssessment> = {}): DamageAssessment {
  return {
    source: 'live',
    photos: [{ photo: 'side.jpg', face: 'long-side' }],
    findings: [dent],
    imageQuality: 'good',
    coverage: 'full',
    significantProbability: 0.2,
    ...overrides,
  }
}

async function fullLive(): Promise<InspectionRecord> {
  const base = await liveWeightsRecord()
  return {
    ...base,
    containerId: buildContainerIdReading({ printed: 'COYU2668130', certainty: 'Confident' }),
    damage: assessed(),
  }
}

describe('a full result', () => {
  it('names the container ID, its type, the weights, the markings and the damage in plain words', async () => {
    const found = buildWhatWeFound(await fullLive())

    expect(found.headline).toBe('COYU 266813 0: 20 ft standard height, general purpose')
    expect(found.caveats).toEqual([])
    expect(found.gaps).toEqual([])
    expect(found.statements.map((s) => s.topic)).toEqual([
      'id',
      'type',
      'weights',
      'markings',
      'damage',
    ])
    expect(statement(found, 'id')).toBe('The container ID reads COYU 266813 0 (Confident).')
    expect(statement(found, 'type')).toBe(
      'The size and type code is 22G1: 20 ft standard height, general purpose (Confident).',
    )
    expect(statement(found, 'weights')).toBe(
      'Maximum gross 30,480 kg, a rating, not the cargo weight (Confident). Tare 2,180 kg (Confident). Payload 28,300 kg, the most it may carry, calculated (Confident).',
    )
    expect(statement(found, 'markings')).toBe(
      'No operational markings seen. No DG placard visible, which says nothing about the cargo.',
    )
    expect(statement(found, 'damage')).toBe(
      '1 suspected finding on the long side: Dent in the side sheet, moderate (Confident). Other faces were not in the photo, so we have not seen them.',
    )
    expect(everything(found)).not.toMatch(FORBIDDEN)
  })

  it('shows the weights in the units the toggle shows', async () => {
    const found = buildWhatWeFound(await fullLive(), { units: 'imperial' })
    expect(statement(found, 'weights')).toBe(
      'Maximum gross 67,200 lb, a rating, not the cargo weight (Confident). Tare 4,810 lb (Confident). Payload 62,390 lb, the most it may carry, calculated (Confident).',
    )
  })
})

describe('an uncertain ID', () => {
  it('puts the caveat first, with the best reading and the alternative, in the fixed words', async () => {
    const base = await fullLive()
    const containerId = {
      ...buildContainerIdReading({ printed: 'COYU2668130', certainty: 'Uncertain' }),
      alternatives: ['COYU2668180'],
    }
    const found = buildWhatWeFound({ ...base, containerId })

    expect(found.headline).toBe('Some of what we found is uncertain')
    expect(found.caveats[0]).toBe(
      'The container ID is Uncertain. Best reading: COYU 266813 0. Also possible: COYU 266818 0.',
    )
    // The caveat says all of it, so the statements do not repeat it.
    expect(statement(found, 'id')).toBeUndefined()
    expect(everything(found)).not.toMatch(FORBIDDEN)
  })

  it('marks unread positions and says some positions were not read', async () => {
    const base = await fullLive()
    const containerId = {
      ...buildContainerIdReading({ printed: 'COYU2668130', certainty: 'Uncertain' }),
      value: 'COYU26?8130',
    }
    const found = buildWhatWeFound({ ...base, containerId })
    expect(found.caveats[0]).toContain('Best reading: COYU 26·813 0.')
    expect(found.caveats[0]).toContain('Some positions were not read')
  })

  it('says a failed check digit as a caveat, without calling the ID wrong', async () => {
    const base = await fullLive()
    const containerId = buildContainerIdReading({ printed: 'COYU2668135', certainty: 'Confident' })
    const found = buildWhatWeFound({ ...base, containerId })
    expect(found.caveats).toContain(
      'The printed check digit (5) does not match the one calculated from the other ten characters (0).',
    )
  })

  it('says plainly that no ID could be read', async () => {
    const found = buildWhatWeFound({ ...(await fullLive()), containerId: null })
    expect(statement(found, 'id')).toBeUndefined()
    expect(found.caveats).toContain('No container ID could be read from this photo.')
    expect(found.headline).toBe('Some of what we found is uncertain')
  })
})

describe('the container type', () => {
  it('names a code that is not one this app decodes, without decoding it', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.sizeCode = { ...details.sizeCode, code: '99X9', decoded: null }
    const found = buildWhatWeFound({ ...base, sizeCode: null, details })
    expect(statement(found, 'type')).toBe(
      'The size and type code reads 99X9, which this app does not decode (Confident).',
    )
  })

  it("says a code that could not be read is Can't tell, as a caveat", async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.sizeCode = {
      state: 'unreadable',
      code: null,
      certainty: "Can't tell",
      source: 'printed',
      alternative: null,
      decoded: null,
    }
    const found = buildWhatWeFound({ ...base, sizeCode: null, details })
    expect(found.caveats).toContain(
      "The size and type code is printed but cannot be read (Can't tell).",
    )
  })

  it('says a code that is in no photo is Not seen, which is not a caveat', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.sizeCode = {
      state: 'not-visible',
      code: null,
      certainty: 'Not seen',
      source: 'printed',
      alternative: null,
      decoded: null,
    }
    const found = buildWhatWeFound({ ...base, sizeCode: null, details })
    expect(statement(found, 'type')).toBe(
      'No size and type code is visible in this photo (Not seen).',
    )
    expect(found.caveats).toEqual([])
  })

  it('says an equipment check that disagrees with the code, as a caveat', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.equipment.reefer = {
      answer: 'yes',
      certainty: 'Uncertain',
      source: 'observed',
      conflict: 'The reefer check says yes, but the code 22G1 is a general-purpose container.',
    }
    const found = buildWhatWeFound({ ...base, details })
    expect(found.caveats).toContain(
      'The reefer check says yes, but the code 22G1 is a general-purpose container.',
    )
  })

  it('keeps the also-possible code beside a doubtful reading', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.sizeCode = {
      ...details.sizeCode,
      certainty: 'Uncertain',
      alternative: '22G0',
      decoded: decodeSizeCode('22G1', 'Uncertain'),
    }
    const found = buildWhatWeFound({
      ...base,
      sizeCode: decodeSizeCode('22G1', 'Uncertain'),
      details,
    })
    expect(found.caveats).toContain(
      'The size and type code is Uncertain. Best reading: 22G1, 20 ft standard height, general purpose. Also possible: 22G0.',
    )
  })
})

describe('the weights', () => {
  it('puts conflicting kg and lb readings first, with both readings, and never calls a rating the load', async () => {
    const weights = evaluateWeights(
      coyuReading({ maxGross: { metric: read(30480), imperial: read(67900) } }),
    )
    const found = buildWhatWeFound({ ...(await fullLive()), weights })

    expect(found.caveats[0]).toBe(
      'Maximum gross: kg and lb disagree, read as 30,480 kg and 67,900 lb, which do not match after conversion.',
    )
    expect(statement(found, 'weights')).toContain(
      'Maximum gross 30,480 kg, a rating, not the cargo weight (Uncertain).',
    )
    expect(everything(found)).not.toMatch(/weighs|loaded weight|cargo weighs/i)
  })

  it('says a printed payload that does not match the arithmetic, in the units on screen', async () => {
    const weights = evaluateWeights(
      coyuReading({ payload: { metric: read(27300), imperial: read(60190) } }),
    )
    const metric = buildWhatWeFound({ ...(await fullLive()), weights })
    expect(metric.caveats).toContain(
      'Printed payload 27,300 kg does not match maximum gross minus tare, 28,300 kg.',
    )
    const imperial = buildWhatWeFound({ ...(await fullLive()), weights }, { units: 'imperial' })
    expect(imperial.caveats).toContain(
      'Printed payload 60,190 lb does not match maximum gross minus tare, 62,390 lb.',
    )
  })

  it("says a figure that is in the photo but not clear is Can't tell, and one that is in no photo is Not seen", async () => {
    const weights = evaluateWeights(coyuReading({ tare: { metric: UNCLEAR, imperial: UNCLEAR } }))
    const found = buildWhatWeFound({ ...(await fullLive()), weights })
    expect(statement(found, 'weights')).toContain("Tare: Can't tell.")
    expect(found.caveats).toContain("Tare: Can't tell.")

    const hidden = evaluateWeights(
      coyuReading({ tare: { metric: NOT_VISIBLE, imperial: NOT_VISIBLE } }),
    )
    const notSeen = buildWhatWeFound({ ...(await fullLive()), weights: hidden })
    expect(statement(notSeen, 'weights')).toContain('Tare: Not seen.')
    expect(notSeen.caveats).not.toContain('Tare: Not seen.')
  })

  it('is not assessed when the run did not read the weights', async () => {
    const found = buildWhatWeFound({ ...(await fullLive()), weights: null })
    expect(statement(found, 'weights')).toBe('The weights were not assessed in this inspection.')
  })

  it('reads a recorded sample, which carries kg only, in either unit', async () => {
    const record = await recordedInspection('luna')
    const metric = buildWhatWeFound(record)
    expect(statement(metric, 'weights')).toMatch(/^Maximum gross [\d,]+ kg, a rating/)
    const imperial = buildWhatWeFound(record, { units: 'imperial' })
    expect(statement(imperial, 'weights')).toMatch(/^Maximum gross [\d,]+ lb, a rating/)
  })
})

describe('markings and the DG placard', () => {
  it('names a DG placard by class and symbol, with the cargo caveat, and a seen marking by its own words', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.dgPlacard = { answer: 'placard', dgClass: 3, symbol: 'Flame', certainty: 'Likely' }
    details.markings.superHeavy = {
      answer: 'yes',
      certainty: 'Confident',
      source: 'observed',
      conflict: null,
    }
    const found = buildWhatWeFound({ ...base, details })
    expect(statement(found, 'markings')).toBe(
      'Seen: SUPER HEAVY marking (Confident). A DG placard, class 3 (flammable liquids), is visible (Likely). The cargo status is unknown without a declaration.',
    )
  })

  it('makes a marking that could not be told a caveat, and keeps the high-container caution separate from overwidth', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.markings.overwidth = {
      answer: null,
      certainty: "Can't tell",
      source: 'observed',
      conflict: null,
    }
    details.markings.highContainer = {
      answer: 'yes',
      certainty: 'Likely',
      source: 'observed',
      conflict: null,
    }
    const found = buildWhatWeFound({ ...base, details })
    expect(found.caveats).toContain(
      "Could not tell whether these markings are present (Can't tell): overwidth.",
    )
    expect(statement(found, 'markings')).toContain('Seen: High-container caution (Likely).')
    expect(statement(found, 'markings')).not.toMatch(/overwidth marking/i)
  })

  it('makes a DG placard that could not be told a caveat', async () => {
    const base = await fullLive()
    const details = structuredClone(base.details!)
    details.dgPlacard = { answer: null, dgClass: null, symbol: null, certainty: "Can't tell" }
    const found = buildWhatWeFound({ ...base, details })
    expect(found.caveats).toContain("Could not tell whether a DG placard is visible (Can't tell).")
  })

  it('is not assessed on a result whose run did not check them (recorded samples)', async () => {
    const found = buildWhatWeFound(await recordedInspection('luna'))
    expect(statement(found, 'markings')).toBe(
      'Markings and DG placards were not assessed in this inspection.',
    )
  })
})

describe('the damage verdict', () => {
  it('says no suspected damage on the face seen, and that other faces were not seen', async () => {
    const found = buildWhatWeFound({ ...(await fullLive()), damage: assessed({ findings: [] }) })
    expect(statement(found, 'damage')).toBe(
      'No suspected damage on the long side. Other faces were not in the photo, so we have not seen them.',
    )
    expect(everything(found)).not.toMatch(FORBIDDEN)
  })

  it('says not assessed for this view, with the reason', async () => {
    const found = buildWhatWeFound({
      ...(await fullLive()),
      damage: {
        source: 'live',
        photos: [],
        findings: [],
        notAssessed: { reason: 'The photo is a close-up.' },
      },
    })
    expect(statement(found, 'damage')).toBe(
      'Damage not assessed for this view. The photo is a close-up.',
    )
  })

  it('says damage was not assessed in this inspection when the run never looked', async () => {
    const found = buildWhatWeFound({ ...(await fullLive()), damage: null })
    expect(statement(found, 'damage')).toBe('Damage was not assessed in this inspection.')
  })

  it('lists the most certain findings first, at most three, and flags a possible significant one', async () => {
    const find = (
      id: number,
      title: string,
      severity: DamageFinding['severity'],
      certainty: DamageFinding['certainty'],
    ): DamageFinding => ({
      ...dent,
      id,
      title,
      severity,
      certainty,
    })
    const found = buildWhatWeFound({
      ...(await fullLive()),
      damage: assessed({
        findings: [
          find(1, 'Scrape on the lower rail', 'cosmetic', 'Likely'),
          find(2, 'Hole in the side sheet', 'major', 'Uncertain'),
          find(3, 'Dent in the side sheet', 'moderate', 'Confident'),
          find(4, 'Bent corner post', null, 'Likely'),
        ],
        significantProbability: 0.7,
      }),
    })
    expect(statement(found, 'damage')).toBe(
      '4 suspected findings on the long side: Dent in the side sheet, moderate (Confident); Scrape on the lower rail, cosmetic (Likely); Bent corner post, not rated (Likely); and 1 more. Potentially significant damage, closer inspection advised. Other faces were not in the photo, so we have not seen them.',
    )
    expect(found.caveats).toContain('Hole in the side sheet is Uncertain.')
  })

  it('names a door-end finding generically, from the damage record', async () => {
    const found = buildWhatWeFound({
      ...(await fullLive()),
      damage: assessed({
        photos: [{ photo: 'doors.jpg', face: 'rear' }],
        findings: [
          {
            ...dent,
            face: 'rear',
            component: 'locking-bar',
            title: 'Bent locking bar',
            severity: null,
          },
        ],
      }),
    })
    expect(statement(found, 'damage')).toContain(
      '1 suspected finding on the door end: Bent locking bar, not rated (Confident).',
    )
  })

  it('makes limited photo quality and part-seen faces caveats', async () => {
    const found = buildWhatWeFound({
      ...(await fullLive()),
      damage: assessed({
        imageQuality: 'poor',
        coverage: 'partial',
        zones: [
          {
            id: 'Z1',
            face: 'long-side',
            zone: { u0: 0, u1: 0.2, v0: 0, v1: 0.5 },
            label: 'a',
            visibility: 'not-visible',
          },
        ],
      }),
    })
    expect(found.caveats).toEqual([
      'The photo quality is poor, so damage could be missed.',
      'Only part of the long side is visible.',
      'Part of the long side could not be seen (Not seen).',
    ])
  })
})

describe('the printed payload in What we found (ticket #65)', () => {
  const C = 'Confident' as const
  type Pair = { metric: ReturnType<typeof read>; imperial: ReturnType<typeof read> }
  const confident = {
    maxGross: { metric: read(30480, C), imperial: read(67200, C) },
    tare: { metric: read(2180, C), imperial: read(4810, C) },
  }
  const found = async (payload: Pair, rest: object = confident) =>
    buildWhatWeFound({
      ...(await fullLive()),
      weights: evaluateWeights(coyuReading({ ...rest, payload })),
    })

  it('says only the Confident calculated payload when the printed one disagrees with itself', async () => {
    const f = await found({ metric: read(22330, C), imperial: read(63390, C) })
    expect(statement(f, 'weights')).toContain('Payload 28,300 kg')
    expect(everything(f)).not.toMatch(/22,330|63,390|Printed payload/)
  })

  it('keeps the printed payload caveat when neither is Confident', async () => {
    // Maximum gross disagrees with itself, so the calculated payload is Uncertain too.
    const f = await found(
      { metric: read(22330, C), imperial: read(63390, C) },
      { ...confident, maxGross: { metric: read(30480, C), imperial: read(67900, C) } },
    )
    expect(f.caveats.join(' ')).toContain('Printed payload')
  })
})

describe('a partial result', () => {
  it('summarises only what arrived and says what is missing', async () => {
    const base = await fullLive()
    const found = buildWhatWeFound(
      { ...base, damage: null, status: 'partial' },
      { unavailable: { damage: 'cancelled' } },
    )
    expect(found.statements.map((s) => s.topic)).toEqual(['id', 'type', 'weights', 'markings'])
    expect(found.gaps).toEqual(['Not finished: damage.'])
    expect(found.headline).toBe('Here is what arrived')
  })

  it('names a part that failed, and a part still arriving, in their own words', async () => {
    const base = await fullLive()
    const found = buildWhatWeFound(
      { ...base, details: undefined, sizeCode: null, weights: null, damage: null },
      { unavailable: { details: 'failed', damage: 'pending' } },
    )
    expect(found.statements.map((s) => s.topic)).toEqual(['id'])
    expect(found.gaps).toEqual(['Could not be read: container details.', 'Still arriving: damage.'])
  })

  it('says only the ID is missing when the ID part did not arrive', async () => {
    const base = await fullLive()
    const found = buildWhatWeFound(
      { ...base, containerId: null },
      { unavailable: { id: 'cancelled' } },
    )
    expect(found.statements.map((s) => s.topic)).not.toContain('id')
    expect(found.gaps).toEqual(['Not finished: the container ID.'])
    expect(found.caveats).not.toContain('No container ID could be read from this photo.')
  })
})

describe('demo samples and old records', () => {
  it('reads a recorded sample with no details, weights face or readings', async () => {
    const record = await recordedInspection('luna')
    const found = buildWhatWeFound(record)
    expect(found.statements.map((s) => s.topic)).toEqual([
      'id',
      'type',
      'weights',
      'markings',
      'damage',
    ])
    expect(found.headline).toMatch(/^APHU 658684 7: 45G1|^APHU 658684 7: 40 ft/)
    expect(everything(found)).not.toMatch(FORBIDDEN)
  })

  it('says what a record with nothing in it did not read, without throwing', async () => {
    const base = await liveDetailsRecord()
    const bare: InspectionRecord = {
      ...base,
      containerId: null,
      sizeCode: null,
      details: undefined,
      weights: null,
      damage: null,
    }
    const found = buildWhatWeFound(bare)
    expect(statement(found, 'type')).toBe(
      'The size and type code was not assessed in this inspection.',
    )
    expect(found.headline).toBe('Some of what we found is uncertain')
  })
})

describe('every certainty word is one of the five', () => {
  it("uses only Confident, Likely, Uncertain, Can't tell and Not seen in brackets", async () => {
    const found = buildWhatWeFound(await fullLive())
    const words: CertaintyLabel[] = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']
    const used = [...everything(found).matchAll(/\(([A-Za-z' ,]+)\)/g)].flatMap((m) =>
      m[1]!.split(', '),
    )
    for (const word of used) expect(['calculated', ...words]).toContain(word)
  })
})

describe('which stages have not delivered', () => {
  const stage = (id: StageId, state: StageState): StageProgress => ({
    id,
    title: id,
    state,
    elapsedMs: null,
  })

  it('names a stage still at work while the run is going, and one that failed or was cancelled once it is settled', () => {
    const stages = [stage('id', 'done'), stage('details', 'active'), stage('damage', 'failed')]
    expect(unavailableStages(stages, true)).toEqual({ details: 'pending', damage: 'failed' })
    expect(
      unavailableStages(
        [stage('id', 'cancelled'), stage('details', 'done'), stage('damage', 'done')],
        false,
      ),
    ).toEqual({
      id: 'cancelled',
    })
  })

  it('leaves a stage that is not part of the run out of the gaps: it was never asked', () => {
    const stages = [stage('id', 'done'), stage('details', 'done'), stage('damage', 'not-in-run')]
    expect(unavailableStages(stages, false)).toEqual({})
    expect(unavailableStages(stages, true)).toEqual({})
  })
})
