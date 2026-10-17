// Settling weights that were read too weakly to read (ticket #87). Pure.
//
// A door prints each weight twice (kg and lb), and max gross minus tare is the payload. Where a model's
// digits are individually weak, those facts still narrow the figure a long way: a kg figure must sit within
// printing rounding of the lb one, and the three weights must add up. Each unit's digits come back with how
// likely each digit was; this finds the figures the digits, the two units and the arithmetic jointly
// settle, and fills a weight only when one value clearly leads. It is never a guess: a weight no value
// leads stays unread, and a weight filled this way never reads better than Likely.
import type { PlaceDist, Figure, WeightQuantity, WeightsReading } from './weights'

/** Smallest probability a digit is given, so one unlikely digit does not rule a value out. */
const FLOOR = 0.005
/** Digits tried at each place, most likely first. */
const BEAM = 4
/** Most candidate values kept per unit. */
const KEEP = 300
/** A weight is filled when its best value holds at least this share of what the evidence allows... */
export const FILL_SHARE = 0.75
/** ...and at least this many times the share of the next value. */
export const FILL_MARGIN = 2
/** The share from which a filled weight reads Likely rather than Uncertain. */
const LIKELY_SHARE = 0.9
/** Door plates print kilograms in tens (30,480; 2,180; 28,300): another last digit is this much less likely. */
const KG_TENS_PRIOR = 0.3
/** A weight in kg below this is not a tare or a max gross. */
const MIN_KG = 500

export interface Units {
  lbPerKg: number
  /** How far kg and lb may be apart after conversion, as a fraction of the lb figure. */
  tolerance: number
}

const WEIGHTS: readonly WeightQuantity[] = ['maxGross', 'tare', 'payload']

const readOf = (f: Figure | undefined): f is Figure & { value: number } =>
  f?.state === 'read' && f.value !== null

/** Two looks' answers at each place pooled: what each said, multiplied and scaled to one. */
export function poolDists(a: PlaceDist[], b: PlaceDist[]): PlaceDist[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, place) => {
    const x = a[place]
    const y = b[place]
    if (!x || !y) return (x ?? y)!
    const out: PlaceDist = {}
    let total = 0
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
      out[key] = (x[key] ?? FLOOR) * (y[key] ?? FLOOR)
      total += out[key]
    }
    for (const key in out) out[key] = out[key]! / total
    return out
  })
}

/** How likely a whole number is under a figure's place-by-place answers. */
function probabilityOf(dist: PlaceDist[], value: number): number {
  if (value >= 10 ** dist.length) return 0
  let p = 1
  for (let place = 0; place < dist.length; place++) {
    const d = dist[place]
    if (!d) continue
    const shown = value >= 10 ** place
    const likelihood = shown
      ? (d[String(Math.floor(value / 10 ** place) % 10)] ?? FLOOR)
      : Math.max(d.none ?? 0, d['0'] ?? 0, FLOOR)
    p *= Math.max(likelihood, FLOOR)
  }
  return p
}

/** The values a figure may be, with how likely each is; null when the figure says nothing (not visible, no answers). */
function candidatesOf(figure: Figure | undefined): Map<number, number> | null {
  if (!figure) return null
  if (readOf(figure)) return new Map([[figure.value, 1]])
  const dist = figure.dist
  if (figure.state !== 'unclear' || !dist || dist.every((d) => !d)) return null
  let values: number[] = [0]
  for (let place = dist.length - 1; place >= 0; place--) {
    const d = dist[place]
    const options = d
      ? Object.entries(d)
          .sort((p, q) => q[1] - p[1])
          .slice(0, BEAM)
          .map(([key]) => (key === 'none' ? 0 : Number(key)))
      : Array.from({ length: 10 }, (_, n) => n)
    values = values.flatMap((v) => [...new Set(options)].map((n) => v * 10 + n))
  }
  const scored = [...new Set(values)]
    .filter((v) => v > 0)
    .map((v): [number, number] => [v, probabilityOf(dist, v)])
    .sort((p, q) => q[1] - p[1])
    .slice(0, KEEP)
  return new Map(scored)
}

interface Evidence {
  /** How likely each kg value is, given the kg digits and the lb figure. */
  kg: Map<number, number>
}

function evidenceOf(q: { metric: Figure; imperial: Figure }, units: Units): Evidence | null {
  const m = candidatesOf(q.metric)
  const l = candidatesOf(q.imperial)
  if (!m && !l) return null
  const kg = new Map<number, number>()
  const agree = (k: number, pounds: number) =>
    Math.abs(k * units.lbPerKg - pounds) / pounds <= units.tolerance
  if (m && l) {
    for (const [k, pk] of m) {
      const prior = readOf(q.metric) || k % 10 === 0 ? 1 : KG_TENS_PRIOR
      let sum = 0
      for (const [pounds, pl] of l) if (agree(k, pounds)) sum += pl
      if (sum > 0) kg.set(k, pk * prior * sum)
    }
    return kg.size > 0 ? { kg } : null
  }
  if (m) return { kg: new Map([...m].map(([k, p]) => [k, p * (k % 10 === 0 ? 1 : KG_TENS_PRIOR)])) }
  // Only pounds said anything: kilograms are those pounds, to the nearest ten.
  for (const [pounds, pl] of l!) {
    const k = Math.round(pounds / units.lbPerKg / 10) * 10
    if (k <= 0) continue
    kg.set(k, (kg.get(k) ?? 0) + pl)
  }
  return { kg }
}

function leader(posterior: Map<number, number>): { value: number; share: number } | null {
  const ranked = [...posterior.entries()].sort((a, b) => b[1] - a[1])
  const total = ranked.reduce((sum, [, p]) => sum + p, 0)
  const [best, next] = ranked
  if (!best || !(total > 0)) return null
  const share = best[1] / total
  if (share < FILL_SHARE) return null
  if (next && best[1] < FILL_MARGIN * next[1]) return null
  return { value: best[0], share }
}

/**
 * The reading with each of max gross, tare and payload that neither unit gave filled in where the digits,
 * the two units and gross minus tare equals payload leave one value clearly ahead. Every other figure is
 * as it was. A filled figure says so (`filled`) and reads Likely at best.
 */
export function inferWeights(reading: WeightsReading, units: Units): WeightsReading {
  const open = WEIGHTS.filter((q) => {
    const r = reading[q]
    return r && !readOf(r.metric) && !readOf(r.imperial) && (r.metric.dist || r.imperial.dist)
  })
  if (open.length === 0) return reading

  const evidence: Partial<Record<WeightQuantity, Evidence>> = {}
  for (const q of WEIGHTS) {
    const r = reading[q]
    const e = r ? evidenceOf(r, units) : null
    if (e) evidence[q] = e
  }

  const posterior: Partial<Record<WeightQuantity, Map<number, number>>> = {}
  for (const q of WEIGHTS) if (evidence[q]) posterior[q] = evidence[q]!.kg
  const { maxGross: g, tare: t, payload: p } = evidence
  if (g && t) {
    const pg = new Map<number, number>()
    const pt = new Map<number, number>()
    const pp = new Map<number, number>()
    const floor = p ? 0.001 * Math.max(...p.kg.values()) : 1
    for (const [gk, gw] of g.kg) {
      for (const [tk, tw] of t.kg) {
        const net = gk - tk
        if (net <= 0) continue
        const w = gw * tw * (p ? (p.kg.get(net) ?? floor) : 1)
        pg.set(gk, (pg.get(gk) ?? 0) + w)
        pt.set(tk, (pt.get(tk) ?? 0) + w)
        pp.set(net, (pp.get(net) ?? 0) + w)
      }
    }
    posterior.maxGross = pg
    posterior.tare = pt
    if (p) posterior.payload = pp
  }

  const out: WeightsReading = { ...reading }
  for (const q of open) {
    const found = posterior[q] ? leader(posterior[q]!) : null
    const r = reading[q]!
    if (!found || found.value < MIN_KG) continue
    const certainty = found.share >= LIKELY_SHARE ? 'Likely' : 'Uncertain'
    // Pounds are printed in tens too (67,200; 4,810; 62,390), so they follow from the kilograms: the lb
    // digits helped choose the kilograms, and a lb figure of their own would only contradict the arithmetic.
    const pounds =
      r.imperial.state === 'unclear'
        ? Math.round((found.value * units.lbPerKg) / 10) * 10
        : undefined
    out[q] = {
      metric:
        r.metric.state === 'not-visible'
          ? r.metric
          : { state: 'read', value: found.value, certainty, filled: true },
      imperial:
        pounds === undefined
          ? r.imperial
          : { state: 'read', value: pounds, certainty, filled: true },
    }
  }
  return out
}
