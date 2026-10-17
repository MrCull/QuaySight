import { describe, it, expect } from 'vitest'
import { evaluateWeights, secondLookQuantities, LB_PER_KG, UNIT_TOLERANCE } from '../weights'
import type { Figure, PlaceDist, WeightsReading } from '../weights'
import { inferWeights } from '../weightInference'
import { coyuReading as coyu, read } from '../../__tests__/liveWeights'

// Ticket #87: kg and lb settle each other's weak digits, and gross minus tare settles payload. 32,500 kg
// is about 71,650 lb (JDLU 200690 2); COYU is 30,480 / 2,180 / 28,300 kg.
const UNITS = { lbPerKg: LB_PER_KG, tolerance: UNIT_TOLERANCE }

/**
 * An unclear figure as a model answers it when each digit is only weakly read: `shown` is the digit string
 * it leaned to (a wrong one allowed), at probability `p` for that digit, the rest spread over the others.
 */
function weak(shown: string, p = 0.3): Figure {
  const places = 5
  const padded = shown.padStart(places, ' ')
  const dist: PlaceDist[] = Array.from({ length: places }, (_, place) => {
    const ch = padded[places - 1 - place]!
    const key = ch === ' ' ? 'none' : ch
    const keys = [...'0123456789', 'none'].filter((k) => !(k === 'none' && place === 0))
    const rest = (1 - p) / (keys.length - 1)
    return Object.fromEntries(keys.map((k) => [k, k === key ? p : rest]))
  })
  return { state: 'unclear', value: null, certainty: "Can't tell", dist }
}

const unitsOf = (kg: string, lb: string) => ({ metric: weak(kg), imperial: weak(lb) })

describe('settling weights that were only weakly read', () => {
  it('reads COYU from weak digits in both units, because the units and the arithmetic agree', () => {
    const out = inferWeights(
      coyu({
        maxGross: unitsOf('30480', '67200'),
        tare: unitsOf('2180', '4810'),
        payload: unitsOf('28300', '62390'),
      }),
      UNITS,
    )
    expect(out.maxGross?.metric).toMatchObject({ state: 'read', value: 30480, filled: true })
    expect(out.tare?.metric).toMatchObject({ state: 'read', value: 2180, filled: true })
    expect(out.payload?.imperial).toMatchObject({ state: 'read', value: 62390 })
  })

  it('settles a digit read wrongly in one unit when the other unit reads it right', () => {
    // kg says 3x480 with the thousands digit wrong; lb 67,200 is only consistent with 30,480.
    const out = inferWeights(
      coyu({
        maxGross: { metric: weak('33480', 0.3), imperial: weak('67200', 0.6) },
        tare: unitsOf('2180', '4810'),
        payload: { metric: weak('28300', 0.3), imperial: weak('62390', 0.3) },
      }),
      UNITS,
    )
    expect(out.maxGross?.metric).toMatchObject({ value: 30480 })
  })

  it('never reads better than Likely for being settled this way', () => {
    const w = evaluateWeights(
      coyu({
        maxGross: unitsOf('30480', '67200'),
        tare: unitsOf('2180', '4810'),
        payload: unitsOf('28300', '62390'),
      }),
    )
    expect(w.maxGross).toMatchObject({ valueKg: 30480, valueLb: 67200, units: 'agree' })
    expect(w.maxGross?.certainty).not.toBe('Confident')
  })

  it('leaves a weight unread when no value leads', () => {
    // Nothing but a guess for tare: flat digits, and nothing else to settle it.
    const flat = (): Figure => ({
      state: 'unclear',
      value: null,
      certainty: "Can't tell",
      dist: Array.from({ length: 5 }, (_, i) =>
        Object.fromEntries([...'0123456789', ...(i ? ['none'] : [])].map((k) => [k, 0.09])),
      ),
    })
    const out = inferWeights(
      coyu({
        maxGross: { metric: read(30480), imperial: read(67200) },
        tare: { metric: flat(), imperial: flat() },
      }),
      UNITS,
    )
    expect(out.tare?.metric.state).toBe('unclear')
  })

  it('does not change a weight a unit already read', () => {
    const reading: WeightsReading = coyu({ tare: { metric: read(2180), imperial: weak('4810') } })
    expect(inferWeights(reading, UNITS).tare).toEqual(reading.tare)
  })
})

describe('the weights that get a second look', () => {
  it('asks again only for a weight the digits, units and arithmetic leave unread', () => {
    const none: Figure = { state: 'unclear', value: null, certainty: "Can't tell" }
    const first = coyu({
      maxGross: { metric: weak('30480', 0.6), imperial: weak('67200', 0.6) },
      tare: { metric: none, imperial: none },
      payload: { metric: read(28300), imperial: read(62390) },
    })
    expect(secondLookQuantities(first)).toEqual(['tare'])
  })
})
