// "What we found" (spec 8.1, ticket #36): the plain-words summary at the top of every result. Pure: it is
// worked out from the inspection record, the units in force and which parts of the run have not
// arrived, and nothing else. It reads each part of the record the way that part's own card does, so a
// part a later ticket adds to the record (door damage, say) appears here without a change to this file
// as long as it lands in the record's damage, weights or details.
//
// Order on screen is the order here: the headline, then the caveats (everything uncertain, with its own
// certainty word), then what is missing from a partial run, then the statements. A statement says what
// was found; a caveat says what remains uncertain. A part whose whole content is a caveat (an uncertain
// ID, a code that cannot be read) is a caveat only, so nothing is said twice.
//
// The words are the fixed ones: Confident, Likely, Uncertain, Can't tell, Not seen. A marking that was
// not seen is not called absent, a missing DG placard says nothing about the cargo, and a maximum is
// a rating, never the weight of the cargo. The summary never says "we" about a reading; it describes
// the evidence, and the card around it carries the heading "What we found".
import { UNREAD, visibleAlternatives } from './certainty'
import {
  dgClassName,
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  type EquipmentCheck,
  type MarkingCheck,
} from './containerDetails'
import {
  faceStatus,
  sortFindings,
  type DamageAssessment,
  type DamageFace,
  type DamageFinding,
} from './damage'
import type { CertaintyLabel, ContainerIdReading, InspectionRecord } from './inspection'
import type { StageId, StageProgress } from './runStages'
import type { Units } from './unitPreference'
import { payloadConflictText, toImperial, type WeightRow, type WeightChecks } from './weights'

export type FoundTopic = 'id' | 'type' | 'weights' | 'markings' | 'damage'

export interface FoundStatement {
  topic: FoundTopic
  text: string
}

export interface WhatWeFound {
  headline: string
  /** What remains uncertain, one plain sentence each. Shown first. */
  caveats: string[]
  /** What a partial run did not deliver, one sentence per kind of gap. */
  gaps: string[]
  /** What was found, in the order ID, type, weights, markings, damage. */
  statements: FoundStatement[]
}

/** Where a part of the run stands when it has not delivered: still coming, failed, or cancelled. */
export type Unavailable = 'pending' | 'failed' | 'cancelled'

export interface WhatWeFoundOptions {
  /** The units the toggle shows. Metric by default. */
  units?: Units
  /** Stages with nothing to show yet or at all. Their parts are left out and named in `gaps`. */
  unavailable?: Partial<Record<StageId, Unavailable>>
}

const WEAK: ReadonlySet<CertaintyLabel> = new Set(['Uncertain', "Can't tell"])
const isWeak = (certainty: CertaintyLabel) => WEAK.has(certainty)

const fmt = (value: number) => value.toLocaleString('en-GB')

/** A full container number as it is printed ("APHU 658684 7"); an unread position shows as a middle dot. */
function groupedId(id: string): string {
  const marked = id.replace(/\s+/g, '').toUpperCase().split(UNREAD).join('·')
  return marked.length === 11
    ? `${marked.slice(0, 4)} ${marked.slice(4, 10)} ${marked.slice(10)}`
    : marked
}

// ---------------------------------------------------------------------------------------------------
// The container ID

function idParts(reading: ContainerIdReading | null): {
  statement?: string
  caveats: string[]
} {
  if (!reading) return { caveats: ['No container ID could be read from this photo.'] }
  const value = groupedId(reading.value)
  const caveats: string[] = []
  const unread = reading.value.includes(UNREAD)
  const known = [...reading.value].some((ch) => ch !== UNREAD)
  if (!known) return { caveats: ['No container ID could be read from this photo.'] }

  if (reading.observedCheckDigit !== null && reading.calculatedCheckDigit !== null) {
    if (!reading.checkDigitValid) {
      caveats.push(
        `The printed check digit (${reading.observedCheckDigit}) does not match the one calculated from the other ten characters (${reading.calculatedCheckDigit}).`,
      )
    }
  }

  if (unread || isWeak(reading.certainty) || reading.certainty === 'Not seen') {
    const also = visibleAlternatives(reading).map(groupedId)
    const sentences = [
      `The container ID is ${reading.certainty}.`,
      `Best reading: ${value}.`,
      unread ? 'Some positions were not read, marked ·.' : null,
      also.length > 0 ? `Also possible: ${also.join(', ')}.` : null,
    ].filter((s): s is string => s !== null)
    return { caveats: [sentences.join(' '), ...caveats] }
  }
  return { statement: `The container ID reads ${value} (${reading.certainty}).`, caveats }
}

// ---------------------------------------------------------------------------------------------------
// The container type

function typeParts(record: InspectionRecord): { statement?: string; caveats: string[] } {
  const caveats: string[] = []
  for (const check of EQUIPMENT_CHECKS as readonly EquipmentCheck[]) {
    const conflict = record.details?.equipment[check].conflict
    if (conflict) caveats.push(conflict)
  }

  const decoded = record.sizeCode
  const reading = record.details?.sizeCode
  if (decoded) {
    if (isWeak(decoded.certainty)) {
      const also = reading?.alternative ? ` Also possible: ${reading.alternative}.` : ''
      return {
        caveats: [
          `The size and type code is ${decoded.certainty}. Best reading: ${decoded.code}, ${decoded.summary}.${also}`,
          ...caveats,
        ],
      }
    }
    return {
      statement: `The size and type code is ${decoded.code}: ${decoded.summary} (${decoded.certainty}).`,
      caveats,
    }
  }

  if (!reading) {
    // Mirrors the Container details card: a recorded sample that read weights but no code saw none.
    return record.weights
      ? {
          statement: 'No size and type code is visible in this photo (Not seen).',
          caveats,
        }
      : { statement: 'The size and type code was not assessed in this inspection.', caveats }
  }
  switch (reading.state) {
    case 'read':
      return isWeak(reading.certainty)
        ? {
            caveats: [
              `The size and type code reads ${reading.code}, which this app does not decode, and is ${reading.certainty}.`,
              ...caveats,
            ],
          }
        : {
            statement: `The size and type code reads ${reading.code}, which this app does not decode (${reading.certainty}).`,
            caveats,
          }
    case 'not-visible':
      return { statement: 'No size and type code is visible in this photo (Not seen).', caveats }
    case 'other':
      return {
        caveats: [
          `The size and type code is printed, but it is not one of the common codes (${reading.certainty}).`,
          ...caveats,
        ],
      }
    case 'unreadable':
      return {
        caveats: [
          `The size and type code is printed but cannot be read (${reading.certainty}).`,
          ...caveats,
        ],
      }
    default:
      return {
        caveats: [
          `The size and type code is not clear from this photo (${reading.certainty}).`,
          ...caveats,
        ],
      }
  }
}

// ---------------------------------------------------------------------------------------------------
// The weights

function weightText(row: WeightRow, units: Units): string {
  return units === 'metric'
    ? `${fmt(row.valueKg)} kg`
    : `${fmt(row.valueLb ?? Math.round(toImperial('weight', row.valueKg)))} lb`
}

function weightParts(
  weights: WeightChecks | null,
  units: Units,
): { statement: string; caveats: string[] } {
  if (!weights)
    return { statement: 'The weights were not assessed in this inspection.', caveats: [] }

  const caveats: string[] = []
  const conflict = weights.payloadConflict
    ? payloadConflictText(weights.payloadConflict, units)
    : weights.conflict
  // A conflict between the figures explains why they are Uncertain: it is said once, not row by row.
  const explainedByPayload = Boolean(conflict)

  function row(
    label: string,
    value: WeightRow | null,
    unread: 'not-visible' | 'unclear' | undefined,
    options: { note?: string; calculated?: boolean },
  ): string {
    if (!value) {
      if (options.calculated) return `${label}: not calculated, it needs maximum gross and tare.`
      const word: CertaintyLabel = unread === 'unclear' ? "Can't tell" : 'Not seen'
      if (word === "Can't tell") caveats.push(`${label}: ${word}.`)
      return `${label}: ${word}.`
    }
    const unitsDisagree = value.units === 'conflict'
    if (unitsDisagree) {
      caveats.push(
        `${label}: kg and lb disagree, read as ${fmt(value.printed?.kg ?? value.valueKg)} kg and ${fmt(value.printed?.lb ?? value.valueLb ?? 0)} lb, which do not match after conversion.`,
      )
    } else if (isWeak(value.certainty) && !explainedByPayload) {
      caveats.push(`${label} is ${value.certainty}.`)
    }
    const how = options.calculated ? ', calculated' : ''
    return `${label} ${weightText(value, units)}${options.note ?? ''}${how} (${value.certainty}).`
  }

  const sentences = [
    row('Maximum gross', weights.maxGross, weights.unread?.maxGross, {
      note: ', a rating, not the cargo weight',
    }),
    row('Tare', weights.tare, weights.unread?.tare, {}),
    row('Payload', weights.payload, undefined, {
      note: ', the most it may carry',
      calculated: true,
    }),
  ]
  if (conflict) caveats.unshift(conflict)
  // The printed payload's own two units can disagree, too.
  const printed = weights.printedPayload
  if (printed?.units === 'conflict') {
    caveats.push(
      `Printed payload: kg and lb disagree, read as ${fmt(printed.printed?.kg ?? printed.valueKg)} kg and ${fmt(printed.printed?.lb ?? printed.valueLb ?? 0)} lb, which do not match after conversion.`,
    )
  }
  return { statement: sentences.join(' '), caveats }
}

// ---------------------------------------------------------------------------------------------------
// Markings and the DG placard

const MARKING_SEEN: Record<MarkingCheck, string> = {
  superHeavy: 'SUPER HEAVY marking',
  highContainer: 'High-container caution',
  overwidth: 'Overwidth marking',
  fumigation: 'Fumigation warning',
  marinePollutant: 'Marine pollutant mark',
}
const MARKING_NAME: Record<MarkingCheck, string> = {
  superHeavy: 'super heavy',
  highContainer: 'high container',
  overwidth: 'overwidth',
  fumigation: 'fumigation',
  marinePollutant: 'marine pollutant',
}

function markingParts(record: InspectionRecord): { statement?: string; caveats: string[] } {
  const details = record.details
  if (!details) {
    return {
      statement: 'Markings and DG placards were not assessed in this inspection.',
      caveats: [],
    }
  }
  const caveats: string[] = []
  const checks = MARKING_CHECKS.map((check) => ({ check, reading: details.markings[check] }))

  const seen = checks.filter((c) => c.reading.answer === 'yes')
  const unknown = checks.filter((c) => c.reading.answer === null)
  const notSeen = checks.some((c) => c.reading.answer === 'no')
  for (const { check, reading } of seen) {
    if (isWeak(reading.certainty)) caveats.push(`${MARKING_SEEN[check]} is ${reading.certainty}.`)
    if (reading.conflict) caveats.push(reading.conflict)
  }
  if (unknown.length > 0) {
    caveats.push(
      `Could not tell whether these markings are present (Can't tell): ${unknown
        .map((c) => MARKING_NAME[c.check])
        .join(', ')}.`,
    )
  }

  const parts: string[] = []
  if (seen.length > 0) {
    parts.push(
      `Seen: ${seen.map((c) => `${MARKING_SEEN[c.check]} (${c.reading.certainty})`).join(', ')}.`,
    )
  } else if (notSeen) {
    parts.push('No operational markings seen.')
  }

  const dg = details.dgPlacard
  if (dg.answer === 'placard') {
    const name = dg.dgClass === null ? null : dgClassName(dg.dgClass)
    parts.push(
      dg.dgClass === null
        ? `A DG placard is visible, but its class cannot be read (${dg.certainty}).`
        : `A DG placard, class ${dg.dgClass}${name ? ` (${name})` : ''}, is visible (${dg.certainty}).`,
      'The cargo status is unknown without a declaration.',
    )
    if (isWeak(dg.certainty)) caveats.push(`The DG placard is ${dg.certainty}.`)
  } else if (dg.answer === 'none') {
    parts.push('No DG placard visible, which says nothing about the cargo.')
  } else {
    caveats.push(`Could not tell whether a DG placard is visible (${dg.certainty}).`)
  }
  return { statement: parts.length > 0 ? parts.join(' ') : undefined, caveats }
}

// ---------------------------------------------------------------------------------------------------
// Damage

const FACE_NAME: Record<DamageFace, string> = {
  rear: 'door end',
  front: 'front end',
  left: 'left side',
  right: 'right side',
  roof: 'roof',
  'long-side': 'long side',
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The faces an assessment looked at, in plain words: from its photos, else from its findings. */
function facesOf(assessment: DamageAssessment): string {
  const faces = [
    ...new Set([
      ...assessment.photos.map((p) => p.face),
      ...(assessment.photos.length === 0 ? assessment.findings.map((f) => f.face) : []),
    ]),
  ]
  return faces.length === 0 ? 'photo' : joinWords(faces.map((f) => FACE_NAME[f]))
}

const LISTED = 3

function findingText(f: DamageFinding): string {
  return `${f.title}, ${f.severity ?? 'not rated'} (${f.certainty})`
}

const FIXED_FACES = ['rear', 'front', 'left', 'right', 'roof'] as const

function damageParts(damage: InspectionRecord['damage']): {
  statement: string
  caveats: string[]
} {
  if (!damage) return { statement: 'Damage was not assessed in this inspection.', caveats: [] }
  if (damage.notAssessed) {
    return {
      statement: `Damage not assessed for this view. ${damage.notAssessed.reason}`,
      caveats: [],
    }
  }
  const face = facesOf(damage)
  const caveats: string[] = []
  if (damage.imageQuality === 'limited' || damage.imageQuality === 'poor') {
    caveats.push(`The photo quality is ${damage.imageQuality}, so damage could be missed.`)
  }
  if (damage.coverage === 'partial') caveats.push(`Only part of the ${face} is visible.`)
  else if (damage.coverage === 'most') caveats.push(`Not all of the ${face} is visible.`)
  if (damage.zones?.some((z) => z.visibility === 'not-visible')) {
    caveats.push(`Part of the ${face} could not be seen (Not seen).`)
  }
  for (const f of sortFindings(damage.findings)) {
    if (f.certainty === 'Uncertain') caveats.push(`${f.title} is Uncertain.`)
  }

  const sorted = sortFindings(damage.findings)
  const n = sorted.length
  const sentences: string[] = []
  if (n === 0) {
    sentences.push(`No suspected damage on the ${face}.`)
  } else {
    const listed = sorted.slice(0, LISTED).map(findingText)
    const more = n > LISTED ? [`and ${n - LISTED} more`] : []
    sentences.push(
      `${n} suspected finding${n === 1 ? '' : 's'} on the ${face}: ${[...listed, ...more].join('; ')}.`,
    )
  }
  if ((damage.significantProbability ?? 0) >= 0.5) {
    sentences.push('Potentially significant damage, closer inspection advised.')
  }
  if (FIXED_FACES.some((f) => faceStatus(damage, f) !== 'photographed')) {
    sentences.push('Other faces were not in the photo, so we have not seen them.')
  }
  return { statement: sentences.join(' '), caveats }
}

// ---------------------------------------------------------------------------------------------------
// What a partial run is missing

const PART_NAME: Record<StageId, string> = {
  id: 'the container ID',
  details: 'container details',
  damage: 'damage',
}
const GAP_LEAD: Record<StageId, Record<Unavailable, string>> = {
  id: { failed: 'Could not be read', cancelled: 'Not finished', pending: 'Still arriving' },
  details: { failed: 'Could not be read', cancelled: 'Not finished', pending: 'Still arriving' },
  damage: { failed: 'Could not be checked', cancelled: 'Not finished', pending: 'Still arriving' },
}
const GAP_ORDER: Unavailable[] = ['failed', 'cancelled', 'pending']
const STAGES: StageId[] = ['id', 'details', 'damage']

function gapsOf(unavailable: Partial<Record<StageId, Unavailable>>): string[] {
  const lines = new Map<string, string[]>()
  for (const state of GAP_ORDER) {
    for (const stage of STAGES) {
      if (unavailable[stage] !== state) continue
      const lead = GAP_LEAD[stage][state]
      lines.set(lead, [...(lines.get(lead) ?? []), PART_NAME[stage]])
    }
  }
  return [...lines].map(([lead, parts]) => `${lead}: ${joinWords(parts)}.`)
}

// ---------------------------------------------------------------------------------------------------

function headlineOf(
  record: InspectionRecord,
  caveats: string[],
  gaps: string[],
  unavailable: Partial<Record<StageId, Unavailable>>,
): string {
  if (caveats.length > 0) return 'Some of what we found is uncertain'
  if (gaps.length > 0) {
    return Object.values(unavailable).every((s) => s === 'pending')
      ? 'Here is what has arrived so far'
      : 'Here is what arrived'
  }
  const id = unavailable.id || !record.containerId ? null : groupedId(record.containerId.value)
  const type = unavailable.details || !record.sizeCode ? null : record.sizeCode.summary
  if (id && type) return `${id}: ${type}`
  if (id) return id
  if (type) return `A ${type}`
  return 'Here is what we found'
}

/**
 * The summary of one inspection record. `unavailable` names the stages that have not delivered (still
 * running, failed or cancelled): their parts are left out and said in `gaps`, never reported as not seen.
 */
export function buildWhatWeFound(
  record: InspectionRecord,
  options: WhatWeFoundOptions = {},
): WhatWeFound {
  const units = options.units ?? 'metric'
  const unavailable = options.unavailable ?? {}
  const statements: FoundStatement[] = []
  const caveats: string[] = []

  function add(topic: FoundTopic, parts: { statement?: string; caveats: string[] }) {
    if (parts.statement) statements.push({ topic, text: parts.statement })
    caveats.push(...parts.caveats)
  }

  if (!unavailable.id) add('id', idParts(record.containerId))
  if (!unavailable.details) {
    add('type', typeParts(record))
    add('weights', weightParts(record.weights, units))
    add('markings', markingParts(record))
  }
  if (!unavailable.damage) add('damage', damageParts(record.damage))

  const gaps = gapsOf(unavailable)
  return {
    headline: headlineOf(record, caveats, gaps, unavailable),
    caveats,
    gaps,
    statements,
  }
}

/**
 * The stages that have not delivered, from the run's progress: still at work while the run is going
 * (pending), or failed or cancelled once it has settled. A stage that is not part of the run was never
 * asked, so it is not a gap: its parts say "not assessed in this inspection".
 */
export function unavailableStages(
  stages: readonly StageProgress[],
  running: boolean,
): Partial<Record<StageId, Unavailable>> {
  const out: Partial<Record<StageId, Unavailable>> = {}
  for (const { id, state } of stages) {
    if (state === 'active' && running) out[id] = 'pending'
    else if (state === 'failed' || state === 'cancelled') out[id] = state
  }
  return out
}
