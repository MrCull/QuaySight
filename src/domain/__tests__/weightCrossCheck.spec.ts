import { describe, it, expect } from 'vitest'
import {
  CU_FT_PER_M3,
  LB_PER_KG,
  capacityAgrees,
  evaluateWeights,
  payloadAgrees,
  rereadQuantities,
  unitsAgree,
} from '../weights'
import { NOT_VISIBLE, UNCLEAR, coyuReading as coyu, read } from '../../__tests__/liveWeights'

// The COYU 266813 0 door (22G1), the worked example for the weights ticket (#34):
// MAX GROSS 30,480 KG 67,200 LB, TARE 2,180 KG 4,810 LB, NET 28,300 KG 62,390 LB, CU. CAP. 33.2 M3 1,173 CU.FT.
describe('kg and lb agreement, within the rounding printed on door panels', () => {
  it('uses 1 kg = 2.20462 lb', () => {
    expect(LB_PER_KG).toBe(2.20462)
    expect(CU_FT_PER_M3).toBeCloseTo(35.3147, 4)
  })

  it.each([
    [30480, 67200],
    [2180, 4810],
    [28300, 62390],
  ])('reads %i kg and %i lb as the same weight', (kg, lb) => {
    expect(unitsAgree('weight', kg, lb)).toBe(true)
  })

  it('accepts a lb figure rounded the way door panels round it (about 0.5%)', () => {
    // 2,180 kg is 4,806 lb; the door prints 4,810.
    expect(unitsAgree('weight', 2180, 4810)).toBe(true)
    expect(unitsAgree('weight', 2180, 4790)).toBe(true) // 0.33% under
  })

  it.each([
    [2180, 4610], // one digit misread in the lb figure
    [30480, 67900],
    [28300, 62900],
    [2180, 4180], // two digits swapped
  ])('flags %i kg against %i lb as a disagreement', (kg, lb) => {
    expect(unitsAgree('weight', kg, lb)).toBe(false)
  })

  it('is symmetric about which unit carries the misread digit', () => {
    expect(unitsAgree('weight', 3180, 4810)).toBe(false)
  })

  it('compares the cubic capacity in m3 and cu ft the same way', () => {
    expect(capacityAgrees(33.2, 1173)).toBe(true)
    expect(capacityAgrees(33.2, 1713)).toBe(false)
    expect(capacityAgrees(38.2, 1173)).toBe(false)
  })

  it('never calls two readings of nothing a match', () => {
    expect(unitsAgree('weight', 0, 0)).toBe(false)
  })
})

describe('printed payload against maximum gross minus tare', () => {
  it('agrees when the printed figure is the arithmetic, in either unit', () => {
    expect(payloadAgrees(28300, 30480 - 2180)).toBe(true)
    expect(payloadAgrees(62390, 67200 - 4810)).toBe(true)
  })

  it('allows the few units that rounding each printed figure can cost', () => {
    expect(payloadAgrees(28310, 28300)).toBe(true)
  })

  it('flags a printed payload that is a digit or more away', () => {
    expect(payloadAgrees(28350, 28300)).toBe(false)
    expect(payloadAgrees(26300, 28300)).toBe(false)
  })
})

describe('what two units say about one weight', () => {
  it('records "kg and lb agree" and raises certainty one step when the readings match', () => {
    const w = evaluateWeights(coyu())
    expect(w.maxGross).toMatchObject({
      valueKg: 30480,
      valueLb: 67200,
      provenance: 'printed',
      certainty: 'Confident',
      units: 'agree',
      printed: { kg: 30480, lb: 67200 },
    })
    expect(w.tare).toMatchObject({ valueKg: 2180, valueLb: 4810, units: 'agree' })
    expect(w.printedPayload).toMatchObject({ valueKg: 28300, valueLb: 62390, units: 'agree' })
    expect(w.capacity).toMatchObject({
      valueM3: 33.2,
      valueCuFt: 1173,
      units: 'agree',
      certainty: 'Confident',
    })
  })

  it('raises from the stronger of the two readings, never past Confident', () => {
    const w = evaluateWeights(
      coyu({
        tare: { metric: read(2180, 'Uncertain'), imperial: read(4810, 'Confident') },
        maxGross: { metric: read(30480, 'Confident'), imperial: read(67200, 'Confident') },
        capacity: { metric: read(33.2, 'Uncertain'), imperial: read(1173, 'Uncertain') },
      }),
    )
    expect(w.tare?.certainty).toBe('Confident')
    expect(w.maxGross?.certainty).toBe('Confident')
    expect(w.capacity?.certainty).toBe('Likely')
  })

  it('shows a weight read in one unit as read, with no agreement claimed', () => {
    const w = evaluateWeights(coyu({ tare: { metric: read(2180), imperial: UNCLEAR } }))
    expect(w.tare).toMatchObject({
      valueKg: 2180,
      valueLb: 4806,
      certainty: 'Likely',
      printed: { kg: 2180, lb: null },
    })
    expect(w.tare?.units).toBeUndefined()
  })

  it('converts a weight read only in lb, and marks the kg as not printed', () => {
    const w = evaluateWeights(coyu({ tare: { metric: NOT_VISIBLE, imperial: read(4810) } }))
    expect(w.tare).toMatchObject({ valueKg: 2182, valueLb: 4810, printed: { kg: null, lb: 4810 } })
  })

  it('says why a weight has no value: not visible, or not clear', () => {
    const w = evaluateWeights(
      coyu({
        maxGross: { metric: NOT_VISIBLE, imperial: NOT_VISIBLE },
        tare: { metric: UNCLEAR, imperial: NOT_VISIBLE },
      }),
    )
    expect(w.maxGross).toBeNull()
    expect(w.tare).toBeNull()
    expect(w.unread).toMatchObject({ maxGross: 'not-visible', tare: 'unclear' })
    expect(w.payload).toBeNull()
  })

  it('calls a weight whose kg and lb disagree Uncertain, and keeps both readings', () => {
    const w = evaluateWeights(coyu({ tare: { metric: read(2180), imperial: read(4610) } }))
    expect(w.tare).toMatchObject({
      certainty: 'Uncertain',
      units: 'conflict',
      printed: { kg: 2180, lb: 4610 },
      valueKg: 2180,
      valueLb: 4610,
    })
  })

  it('asks for the weights that disagree to be read again, and only those', () => {
    expect(rereadQuantities(coyu())).toEqual([])
    expect(rereadQuantities(coyu({ tare: { metric: read(2180), imperial: read(4610) } }))).toEqual([
      'tare',
    ])
    expect(
      rereadQuantities(
        coyu({
          tare: { metric: read(2180), imperial: read(4610) },
          capacity: { metric: read(33.2), imperial: read(1713) },
        }),
      ),
    ).toEqual(['tare', 'capacity'])
  })
})

describe('payload, printed and calculated', () => {
  it('calculates payload as max gross minus tare, labelled calculated, in both units', () => {
    const w = evaluateWeights(coyu())
    expect(w.payload).toMatchObject({
      valueKg: 28300,
      valueLb: 62390,
      provenance: 'calculated',
      certainty: 'Confident',
    })
    expect(w.conflict).toBeNull()
    expect(w.payloadConflict).toBeNull()
  })

  it('flags a printed payload that conflicts with the arithmetic, and lowers all three to Uncertain', () => {
    const w = evaluateWeights(coyu({ payload: { metric: read(28350), imperial: read(62500) } }))
    expect(w.payloadConflict).toEqual({
      kind: 'differs',
      printedKg: 28350,
      printedLb: 62500,
      calculatedKg: 28300,
      calculatedLb: 62390,
    })
    expect(w.conflict).toMatch(/28,350 kg/)
    expect(w.conflict).toMatch(/28,300 kg/)
    expect(w.payload?.certainty).toBe('Uncertain')
    expect(w.printedPayload?.certainty).toBe('Uncertain')
    expect(w.maxGross?.certainty).toBe('Uncertain')
    expect(w.tare?.certainty).toBe('Uncertain')
  })

  it('asks for max gross, tare and payload to be read again when payload conflicts', () => {
    expect(
      rereadQuantities(coyu({ payload: { metric: read(28350), imperial: read(62500) } })),
    ).toEqual(['maxGross', 'tare', 'payload'])
  })

  it('checks the arithmetic in lb when only the lb figures were read', () => {
    const w = evaluateWeights(
      coyu({
        maxGross: { metric: UNCLEAR, imperial: read(67200) },
        tare: { metric: UNCLEAR, imperial: read(4810) },
        payload: { metric: UNCLEAR, imperial: read(62900) },
      }),
    )
    expect(w.payloadConflict).toMatchObject({
      kind: 'differs',
      printedLb: 62900,
      calculatedLb: 62390,
    })
  })

  it('calculates a payload without a printed one, and a printed one without a calculation', () => {
    const noNet = evaluateWeights(coyu({ payload: { metric: NOT_VISIBLE, imperial: NOT_VISIBLE } }))
    expect(noNet.payload).toMatchObject({ valueKg: 28300 })
    expect(noNet.printedPayload).toBeNull()
    expect(noNet.conflict).toBeNull()

    const noTare = evaluateWeights(coyu({ tare: { metric: UNCLEAR, imperial: UNCLEAR } }))
    expect(noTare.payload).toBeNull()
    expect(noTare.printedPayload).toMatchObject({ valueKg: 28300 })
    expect(noTare.conflict).toBeNull()
  })

  it('does not calculate a payload when tare is not below max gross, and says so', () => {
    const w = evaluateWeights(coyu({ tare: { metric: read(31000), imperial: read(68340) } }))
    expect(w.payload).toBeNull()
    expect(w.payloadConflict?.kind).toBe('impossible')
    expect(w.conflict).toMatch(/tare/i)
    expect(w.tare?.certainty).toBe('Uncertain')
    expect(w.maxGross?.certainty).toBe('Uncertain')
  })
})

describe('the second look at the weights that disagreed', () => {
  const disagreeing = coyu({ tare: { metric: read(2180), imperial: read(4610) } })

  it('takes the new reading and shows agreement when it settles the disagreement', () => {
    const w = evaluateWeights(disagreeing, {
      tare: { metric: read(2180), imperial: read(4810) },
    })
    expect(w.tare).toMatchObject({ units: 'agree', certainty: 'Confident', valueLb: 4810 })
    expect(w.payload?.certainty).toBe('Confident')
  })

  it('leaves the row Uncertain, with both readings, when the disagreement persists', () => {
    const w = evaluateWeights(disagreeing, {
      tare: { metric: read(2180), imperial: read(4710) },
    })
    expect(w.tare).toMatchObject({ units: 'conflict', certainty: 'Uncertain', valueLb: 4710 })
  })

  it('keeps the first reading of a unit the second look could not read', () => {
    const w = evaluateWeights(disagreeing, {
      tare: { metric: read(2180), imperial: UNCLEAR },
    })
    expect(w.tare).toMatchObject({ valueLb: 4610, units: 'conflict' })
  })

  it('leaves the rows it did not re-read as first read', () => {
    const w = evaluateWeights(disagreeing, { tare: { metric: read(2180), imperial: read(4810) } })
    expect(w.maxGross).toMatchObject({ valueKg: 30480, units: 'agree' })
  })
})
