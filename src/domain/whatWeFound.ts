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
//
// The sentences are in foundWording.ts and what was found per topic in foundParts.ts (ticket #54); this
// file assembles the summary: the headline, the gaps and the order.
import type { InspectionRecord } from './inspection'
import type { StageId, StageProgress } from './runStages'
import type { Units } from './unitPreference'
import {
  idParts,
  typeParts,
  weightParts,
  markingParts,
  damageParts,
  type FoundParts,
} from './foundParts'
import * as words from './foundWording'
import type { Unavailable } from './foundWording'

export type { Unavailable }

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

export interface WhatWeFoundOptions {
  /** The units the toggle shows. Metric by default. */
  units?: Units
  /** Stages with nothing to show yet or at all. Their parts are left out and named in `gaps`. */
  unavailable?: Partial<Record<StageId, Unavailable>>
}

const GAP_ORDER: Unavailable[] = ['failed', 'cancelled', 'pending']
const STAGES: StageId[] = ['id', 'details', 'damage']

function gapsOf(unavailable: Partial<Record<StageId, Unavailable>>): string[] {
  const lines = new Map<string, string[]>()
  for (const state of GAP_ORDER) {
    for (const stage of STAGES) {
      if (unavailable[stage] !== state) continue
      const lead = words.GAP_LEAD[stage][state]
      lines.set(lead, [...(lines.get(lead) ?? []), words.PART_NAME[stage]])
    }
  }
  return [...lines].map(([lead, parts]) => words.gapText(lead, parts))
}

function headlineOf(
  record: InspectionRecord,
  caveats: string[],
  gaps: string[],
  unavailable: Partial<Record<StageId, Unavailable>>,
): string {
  if (caveats.length > 0) return words.HEADLINE_UNCERTAIN
  if (gaps.length > 0) {
    return Object.values(unavailable).every((s) => s === 'pending')
      ? words.HEADLINE_ARRIVING
      : words.HEADLINE_PARTIAL
  }
  const id =
    unavailable.id || !record.containerId ? null : words.groupedId(record.containerId.value)
  const type = unavailable.details || !record.sizeCode ? null : record.sizeCode.summary
  if (id && type) return words.headlineIdAndType(id, type)
  if (id) return id
  if (type) return words.headlineTypeOnly(type)
  return words.HEADLINE_DEFAULT
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

  function add(topic: FoundTopic, parts: FoundParts) {
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
