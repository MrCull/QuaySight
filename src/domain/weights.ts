// Weight rows and gross minus tare arithmetic (spec 4.3, 4.4). Maximum gross is a rating, never a measured load.
//
// Live runs (ticket #34) read each weight in both kg and lb, and the cubic capacity in m3 and cu ft. The
// rules that compare the two readings, and printed payload against max gross minus tare, are here and pure.
import type { CertaintyLabel, Provenance } from './inspection'

/** 1 kg = 2.20462 lb. */
export const LB_PER_KG = 2.20462
/** 1 m3 = 35.3147 cu ft. */
export const CU_FT_PER_M3 = 35.3147

/**
 * How far apart two readings of one quantity in two units may be after conversion: door panels round
 * their figures, so 2,180 kg beside 4,810 lb is the same weight (4,806 lb exactly). About 0.5%.
 */
export const UNIT_TOLERANCE = 0.005

/**
 * How far a printed payload may sit from max gross minus tare, as a fraction of it. Both sides are in
 * one unit, so only the rounding of the three printed figures can separate them: much tighter than the
 * unit tolerance, which would let a wrong tens digit through.
 */
export const PAYLOAD_TOLERANCE = 0.001

export type QuantityKind = 'weight' | 'capacity'

const FACTOR: Record<QuantityKind, number> = { weight: LB_PER_KG, capacity: CU_FT_PER_M3 }

/** The imperial figure for a metric one (kg to lb, m3 to cu ft), unrounded. */
export function toImperial(kind: QuantityKind, metric: number): number {
  return metric * FACTOR[kind]
}

/** The metric figure for an imperial one (lb to kg, cu ft to m3), unrounded. */
export function toMetric(kind: QuantityKind, imperial: number): number {
  return imperial / FACTOR[kind]
}

/** Whether a metric and an imperial reading of one quantity agree after conversion, within the printed rounding. */
export function unitsAgree(kind: QuantityKind, metric: number, imperial: number): boolean {
  if (!(metric > 0) || !(imperial > 0)) return false
  return Math.abs(toImperial(kind, metric) - imperial) / imperial <= UNIT_TOLERANCE
}

export const capacityAgrees = (m3: number, cuFt: number) => unitsAgree('capacity', m3, cuFt)

/** Whether a printed payload matches the payload calculated from max gross minus tare, both in one unit. */
export function payloadAgrees(printed: number, calculated: number): boolean {
  if (!(printed > 0) || !(calculated > 0)) return false
  return Math.abs(printed - calculated) / printed <= PAYLOAD_TOLERANCE
}

export interface WeightRow {
  /** The weight in kg. On a live run, converted from lb when only lb was read (then `printed.kg` is null). */
  valueKg: number
  provenance: Provenance
  certainty: CertaintyLabel
  /** The weight in lb, as above. Absent on recorded samples, which carry kg only. */
  valueLb?: number
  /** Live runs: what each unit's printed figure was read as. null: that unit was not read. */
  printed?: { kg: number | null; lb: number | null }
  /** Live runs, when both units were read: whether they agree after conversion. */
  units?: 'agree' | 'conflict'
}

/** The cubic capacity, read in both units. */
export interface CapacityRow {
  valueM3: number
  valueCuFt: number
  provenance: Provenance
  certainty: CertaintyLabel
  printed: { m3: number | null; cuFt: number | null }
  units?: 'agree' | 'conflict'
}

/** Why a figure has no value: it is in no photo, or it is there but not clear enough. */
export type Unread = 'not-visible' | 'unclear'

/** printed payload against max gross minus tare. differs: they are not the same. impossible: tare is not below max gross. */
export interface PayloadConflict {
  kind: 'differs' | 'impossible'
  printedKg: number | null
  printedLb: number | null
  calculatedKg: number | null
  calculatedLb: number | null
}

/** How the second look at weights that disagreed ended (live only). Kept for the export. */
export type WeightsRereadOutcome =
  | 'settled'
  | 'still-disagrees'
  | 'failed'
  | 'cancelled'
  | 'skipped-cap'

export interface WeightInputs {
  maxGrossKg: number | null
  tareKg: number | null
  /** NET / PAYLOAD as printed on the door, when visible. Used only to check the arithmetic. */
  printedNetKg: number | null
  /** Certainty of the printed readings from the photo. */
  certainty: CertaintyLabel
}

export interface WeightChecks {
  maxGross: WeightRow | null
  tare: WeightRow | null
  payload: WeightRow | null
  /** Plain-English conflict between printed NET and the arithmetic, or null. */
  conflict: string | null
  // Live runs (ticket #34) fill the following; recorded samples leave them out.
  /** The payload as printed (NET or PAYLOAD on the door). `payload` above is always the calculated one. */
  printedPayload?: WeightRow | null
  capacity?: CapacityRow | null
  /** Why a figure has no value. */
  unread?: Partial<Record<'maxGross' | 'tare' | 'printedPayload' | 'capacity', Unread>>
  payloadConflict?: PayloadConflict | null
  /** Set when a second look at weights that disagreed was asked for. */
  reread?: WeightsRereadOutcome
}

const ORDER: CertaintyLabel[] = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen']

function weaker(a: CertaintyLabel, b: CertaintyLabel): CertaintyLabel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b
}

function kg(value: number): string {
  return `${value.toLocaleString('en-GB')} kg`
}

export function checkWeights(input: WeightInputs): WeightChecks {
  const maxGross: WeightRow | null =
    input.maxGrossKg === null
      ? null
      : { valueKg: input.maxGrossKg, provenance: 'printed', certainty: input.certainty }
  const tare: WeightRow | null =
    input.tareKg === null
      ? null
      : { valueKg: input.tareKg, provenance: 'printed', certainty: input.certainty }

  if (input.maxGrossKg === null || input.tareKg === null) {
    return { maxGross, tare, payload: null, conflict: null }
  }

  const calculatedKg = input.maxGrossKg - input.tareKg
  // A calculated payload is only as certain as the printed inputs it came from.
  const payload: WeightRow = {
    valueKg: calculatedKg,
    provenance: 'calculated',
    certainty: input.certainty,
  }

  if (input.printedNetKg !== null && input.printedNetKg !== calculatedKg) {
    return {
      maxGross,
      tare,
      payload: { ...payload, certainty: weaker(payload.certainty, 'Uncertain') },
      conflict: `Printed NET ${kg(input.printedNetKg)} does not match maximum gross minus tare, ${kg(calculatedKg)}.`,
    }
  }

  return { maxGross, tare, payload, conflict: null }
}

// ---------------------------------------------------------------------------------------------------
// Live readings in two units (ticket #34)

export type WeightQuantity = 'maxGross' | 'tare' | 'payload' | 'capacity'
export const WEIGHT_QUANTITIES: readonly WeightQuantity[] = [
  'maxGross',
  'tare',
  'payload',
  'capacity',
]

/** One printed figure as read: digit by digit, so its certainty is its weakest digit's. */
export interface Figure {
  state: 'read' | 'not-visible' | 'unclear'
  /** The figure, only when read. */
  value: number | null
  certainty: CertaintyLabel
}

/** A quantity as printed in both unit systems: kg and lb, or m3 and cu ft. */
export interface QuantityReading {
  metric: Figure
  imperial: Figure
}

/** What the survey (or the second look) read; a quantity not asked is absent. */
export type WeightsReading = Partial<Record<WeightQuantity, QuantityReading>>

const BUMP: Partial<Record<CertaintyLabel, CertaintyLabel>> = {
  Uncertain: 'Likely',
  Likely: 'Confident',
}

/** The stronger of two certainty words. */
function stronger(a: CertaintyLabel, b: CertaintyLabel): CertaintyLabel {
  return ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b
}

const capAtUncertain = (c: CertaintyLabel): CertaintyLabel => weaker(c, 'Uncertain')

interface QuantityEval {
  metric: number | null
  imperial: number | null
  units: 'agree' | 'conflict' | null
  certainty: CertaintyLabel
  unread: Unread | null
}

function readOf(figure: Figure | undefined): figure is Figure & { value: number } {
  return figure?.state === 'read' && figure.value !== null
}

function evalQuantity(kind: QuantityKind, q: QuantityReading | undefined): QuantityEval {
  const m = q?.metric
  const i = q?.imperial
  if (readOf(m) && readOf(i)) {
    if (unitsAgree(kind, m.value, i.value)) {
      const best = stronger(m.certainty, i.certainty)
      return {
        metric: m.value,
        imperial: i.value,
        units: 'agree',
        certainty: BUMP[best] ?? best,
        unread: null,
      }
    }
    return {
      metric: m.value,
      imperial: i.value,
      units: 'conflict',
      certainty: 'Uncertain',
      unread: null,
    }
  }
  if (readOf(m) || readOf(i)) {
    const one = readOf(m) ? m : (i as Figure)
    return {
      metric: readOf(m) ? m.value : null,
      imperial: readOf(i) ? i.value : null,
      units: null,
      certainty: one.certainty,
      unread: null,
    }
  }
  const seen = m?.state === 'not-visible' && i?.state === 'not-visible'
  return {
    metric: null,
    imperial: null,
    units: null,
    certainty: seen ? 'Not seen' : "Can't tell",
    unread: seen ? 'not-visible' : 'unclear',
  }
}

/** The reading to use: the second look's figure where it read one, otherwise the first's. */
export function mergeWeightReadings(
  first: WeightsReading,
  second: WeightsReading | null | undefined,
): WeightsReading {
  return merged(first, second)
}

function merged(first: WeightsReading, second: WeightsReading | null | undefined): WeightsReading {
  const out: WeightsReading = {}
  for (const quantity of WEIGHT_QUANTITIES) {
    const a = first[quantity]
    const b = second?.[quantity]
    if (!a && !b) continue
    out[quantity] = {
      metric: readOf(b?.metric) || !a ? (b?.metric ?? a!.metric) : a.metric,
      imperial: readOf(b?.imperial) || !a ? (b?.imperial ?? a!.imperial) : a.imperial,
    }
  }
  return out
}

const roundedKg = (e: QuantityEval) =>
  e.metric ?? (e.imperial === null ? null : Math.round(toMetric('weight', e.imperial)))
const roundedLb = (e: QuantityEval) =>
  e.imperial ?? (e.metric === null ? null : Math.round(toImperial('weight', e.metric)))

function weightRow(e: QuantityEval, certainty: CertaintyLabel): WeightRow | null {
  if (e.metric === null && e.imperial === null) return null
  return {
    valueKg: roundedKg(e)!,
    valueLb: roundedLb(e)!,
    provenance: 'printed',
    certainty,
    printed: { kg: e.metric, lb: e.imperial },
    ...(e.units ? { units: e.units } : {}),
  }
}

function capacityRow(e: QuantityEval): CapacityRow | null {
  if (e.metric === null && e.imperial === null) return null
  return {
    valueM3: e.metric ?? Math.round(toMetric('capacity', e.imperial!) * 10) / 10,
    valueCuFt: e.imperial ?? Math.round(toImperial('capacity', e.metric!)),
    provenance: 'printed',
    certainty: e.certainty,
    printed: { m3: e.metric, cuFt: e.imperial },
    ...(e.units ? { units: e.units } : {}),
  }
}

const fmt = (n: number) => n.toLocaleString('en-GB')
const both = (kgValue: number | null, lbValue: number | null) =>
  [kgValue === null ? null : `${fmt(kgValue)} kg`, lbValue === null ? null : `${fmt(lbValue)} lb`]
    .filter(Boolean)
    .join(' / ')

/**
 * The sentence for a payload conflict, in the units asked for: both by default (exports), or one unit
 * system for the screen. Falls back to both where the asked unit was not read.
 */
export function payloadConflictText(
  c: PayloadConflict,
  units: 'both' | 'metric' | 'imperial' = 'both',
): string {
  if (c.kind === 'impossible') {
    return 'Tare is not below maximum gross, so payload cannot be calculated from them.'
  }
  const metric = units !== 'imperial' && c.printedKg !== null && c.calculatedKg !== null
  const imperial = units !== 'metric' && c.printedLb !== null && c.calculatedLb !== null
  const useKg = units === 'both' ? c.printedKg !== null : metric
  const useLb = units === 'both' ? c.printedLb !== null : imperial
  const showKg = useKg || (!useLb && c.printedKg !== null)
  const showLb = useLb || (!useKg && !showKg && c.printedLb !== null)
  const printed = both(showKg ? c.printedKg : null, showLb ? c.printedLb : null)
  const calculated = both(showKg ? c.calculatedKg : null, showLb ? c.calculatedLb : null)
  return `Printed payload ${printed} does not match maximum gross minus tare, ${calculated}.`
}

function evaluate(first: WeightsReading, second: WeightsReading | null | undefined) {
  const reading = merged(first, second)
  const gross = evalQuantity('weight', reading.maxGross)
  const tare = evalQuantity('weight', reading.tare)
  const net = evalQuantity('weight', reading.payload)
  const capacity = evalQuantity('capacity', reading.capacity)

  // The arithmetic is only judged once each weight's own two units are settled: a misread digit in one
  // unit would otherwise show up here as well, and the same row would be asked for twice.
  const settled = [gross, tare, net].every((e) => e.units !== 'conflict')
  const calculatedKg =
    gross.metric !== null && tare.metric !== null ? gross.metric - tare.metric : null
  const calculatedLb =
    gross.imperial !== null && tare.imperial !== null ? gross.imperial - tare.imperial : null
  const fromEither = (a: QuantityEval, b: QuantityEval) => {
    const g = roundedKg(a)
    const t = roundedKg(b)
    return g !== null && t !== null ? g - t : null
  }
  const kgCalc = calculatedKg ?? fromEither(gross, tare)
  const lbCalc =
    calculatedLb ??
    (() => {
      const g = roundedLb(gross)
      const t = roundedLb(tare)
      return g !== null && t !== null ? g - t : null
    })()
  const impossible = (kgCalc !== null && kgCalc <= 0) || (lbCalc !== null && lbCalc <= 0)

  let payloadConflict: PayloadConflict | null = null
  if (settled && impossible) {
    payloadConflict = {
      kind: 'impossible',
      printedKg: null,
      printedLb: null,
      calculatedKg: null,
      calculatedLb: null,
    }
  } else if (settled && (net.metric !== null || net.imperial !== null)) {
    const differs =
      (net.metric !== null && calculatedKg !== null && !payloadAgrees(net.metric, calculatedKg)) ||
      (net.imperial !== null && calculatedLb !== null && !payloadAgrees(net.imperial, calculatedLb))
    if (differs) {
      payloadConflict = {
        kind: 'differs',
        printedKg: net.metric,
        printedLb: net.imperial,
        calculatedKg: net.metric !== null ? calculatedKg : null,
        calculatedLb: net.imperial !== null ? calculatedLb : null,
      }
    }
  }
  return { gross, tare, net, capacity, kgCalc, lbCalc, impossible, payloadConflict }
}

/**
 * The weights from what the survey read, and (when weights that disagreed were looked at again) what the
 * second look read. Each weight read in both units that agree gains certainty and records the
 * agreement; one that disagrees reads Uncertain with both readings. Payload is also calculated as max
 * gross minus tare and compared with the printed one.
 */
export function evaluateWeights(
  first: WeightsReading,
  second?: WeightsReading | null,
  reread?: WeightsRereadOutcome,
): WeightChecks {
  const { gross, tare, net, capacity, kgCalc, lbCalc, impossible, payloadConflict } = evaluate(
    first,
    second,
  )
  const cap = payloadConflict ? capAtUncertain : (c: CertaintyLabel) => c
  const maxGross = weightRow(gross, cap(gross.certainty))
  const tareRow = weightRow(tare, cap(tare.certainty))
  const printedPayload = weightRow(net, cap(net.certainty))

  let payload: WeightRow | null = null
  if (!impossible && kgCalc !== null && lbCalc !== null) {
    payload = {
      valueKg: kgCalc,
      valueLb: lbCalc,
      provenance: 'calculated',
      certainty: cap(weaker(gross.certainty, tare.certainty)),
    }
  }

  const unread: NonNullable<WeightChecks['unread']> = {}
  if (gross.unread) unread.maxGross = gross.unread
  if (tare.unread) unread.tare = tare.unread
  if (net.unread) unread.printedPayload = net.unread
  if (capacity.unread) unread.capacity = capacity.unread

  return {
    maxGross,
    tare: tareRow,
    payload,
    conflict: payloadConflict ? payloadConflictText(payloadConflict) : null,
    printedPayload,
    capacity: capacityRow(capacity),
    unread,
    payloadConflict,
    ...(reread ? { reread } : {}),
  }
}

/** The quantities whose readings disagree, in panel order: the weights to look at again. */
export function rereadQuantities(first: WeightsReading): WeightQuantity[] {
  const { gross, tare, net, capacity, payloadConflict } = evaluate(first, null)
  const wanted = new Set<WeightQuantity>()
  if (gross.units === 'conflict') wanted.add('maxGross')
  if (tare.units === 'conflict') wanted.add('tare')
  if (net.units === 'conflict') wanted.add('payload')
  if (capacity.units === 'conflict') wanted.add('capacity')
  if (payloadConflict) for (const q of ['maxGross', 'tare', 'payload'] as const) wanted.add(q)
  return WEIGHT_QUANTITIES.filter((q) => wanted.has(q))
}

/**
 * The weights once weights that disagreed have been looked at again: the second look's figures where it
 * read them, the first's elsewhere. `reread` says whether the disagreement was settled.
 */
export function weightsAfterReread(first: WeightsReading, second: WeightsReading): WeightChecks {
  const persists = rereadQuantities(merged(first, second)).length > 0
  return evaluateWeights(first, second, persists ? 'still-disagrees' : 'settled')
}
