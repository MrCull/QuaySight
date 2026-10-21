// The key-facts tiles (spec 8.1, ticket 102): the headline of a result at a glance. Pure: worked out
// from the inspection record and which parts of the run have arrived, and nothing else. Order on screen
// is the order here: Container ID, Seal, Damage, then Placards, which exists only when a placard is seen.
//
// A tile whose part has not arrived says "Reading…" and shows no value, even when the record already
// holds one. A part that failed or was cancelled says "No result", never "Not seen". The words are the
// fixed ones: Confident, Likely, Uncertain, Can't tell, Not seen. Certainty and severity are separate:
// a tile carries a certainty word and, for damage, a severity, and never one in place of the other.
import { idResultState, UNREAD } from './certainty'
import { dgClassName } from './containerDetailTypes'
import type { DamageFinding, Severity } from './damage'
import type { CertaintyLabel, ContainerIdReading, InspectionRecord } from './inspection'
import type { StageId } from './runStages'

export type PartState = 'reading' | 'arrived' | 'unavailable'
/** Where each stage of the run is: still reading, arrived, or failed or cancelled (unavailable). */
export type PartStates = Record<StageId, PartState>

export type KeyFactId = 'id' | 'seal' | 'damage' | 'placards'

export interface KeyFactTile {
  id: KeyFactId
  label: string
  state: PartState
  /** The tile's main words: the value, or "Reading…" / "No result". */
  headline: string
  /** Short facts under the headline (check-digit result, owner-code note). */
  notes: string[]
  certainty: CertaintyLabel | null
  /** Damage tile only: the worst apparent severity among the findings. A separate axis from certainty. */
  severity: Severity | null
  /** Container ID tile only: the reading to set in the ID display. Null when the ID is not readable. */
  reading: ContainerIdReading | null
}

export const READING_TEXT = 'Reading…'
export const NO_RESULT_TEXT = 'No result'
export const ID_NOT_READABLE_TEXT = 'ID not readable in this photo'
const NOT_ASSESSED_TEXT = 'Not assessed'

const LABEL: Record<KeyFactId, string> = {
  id: 'Container ID',
  seal: 'Seal',
  damage: 'Damage',
  placards: 'Placards',
}

function tile(id: KeyFactId, state: PartState, over: Partial<KeyFactTile> = {}): KeyFactTile {
  const headline =
    state === 'reading' ? READING_TEXT : state === 'unavailable' ? NO_RESULT_TEXT : ''
  return {
    id,
    label: LABEL[id],
    state,
    headline,
    notes: [],
    certainty: null,
    severity: null,
    reading: null,
    ...(state === 'arrived' ? over : {}),
  }
}

function idTile(state: PartState, record: InspectionRecord | null): KeyFactTile {
  const reading = record?.containerId ?? null
  if (!reading || idResultState(reading) === 'insufficient') {
    return tile('id', state, { headline: ID_NOT_READABLE_TEXT, certainty: "Can't tell" })
  }
  const value = reading.value.replace(/\s+/g, '').toUpperCase()
  return tile('id', state, { headline: value, certainty: reading.certainty, reading })
}

function sealTile(state: PartState, record: InspectionRecord | null): KeyFactTile {
  const seal = record?.seal
  if (!seal) return tile('seal', state, { headline: NOT_ASSESSED_TEXT })
  if (!seal.visible) return tile('seal', state, { headline: 'Not seen', certainty: 'Not seen' })
  if (!seal.characters.some((c) => c.value !== null)) {
    return tile('seal', state, { headline: 'Number not readable', certainty: seal.certainty })
  }
  return tile('seal', state, {
    headline: seal.value.split(UNREAD).join('·'),
    certainty: seal.certainty,
  })
}

const SEVERITY_ORDER: Severity[] = ['major', 'moderate', 'minor', 'cosmetic']

function worstSeverity(findings: DamageFinding[]): Severity | null {
  return SEVERITY_ORDER.find((s) => findings.some((f) => f.severity === s)) ?? null
}

function damageTile(state: PartState, record: InspectionRecord | null): KeyFactTile {
  const damage = record?.damage
  if (!damage || damage.notAssessed) return tile('damage', state, { headline: NOT_ASSESSED_TEXT })
  const n = damage.findings.length
  if (n === 0) return tile('damage', state, { headline: 'None seen' })
  const severity = worstSeverity(damage.findings)
  return tile('damage', state, {
    headline: `${n} ${n === 1 ? 'finding' : 'findings'}`,
    severity,
    notes: severity ? [] : ["Severity can't tell"],
  })
}

const className = (dgClass: number) => {
  const name = dgClassName(dgClass)
  return `Class ${dgClass}${name ? `, ${name}` : ''}`
}

/** Below Likely a placard is only possible: the tile says so and carries no hazard badge. */
export const placardInDoubt = (certainty: CertaintyLabel | null) =>
  certainty !== 'Confident' && certainty !== 'Likely'

/** One placard's headline: its class, "Placard seen" when the class is not read, "Possible placard" below Likely. */
const placardHeadline = (dgClass: number | null | undefined, certainty: CertaintyLabel) =>
  placardInDoubt(certainty)
    ? 'Possible placard'
    : dgClass == null
      ? 'Placard seen'
      : className(dgClass)

/** Placards from the placards question family (several allowed), else the survey's single DG answer. */
function placardsTile(state: PartState, record: InspectionRecord | null): KeyFactTile | null {
  if (state !== 'arrived') return null
  const reading = record?.placards
  if (reading) {
    if (reading.answer !== 'present') return null
    const classes = reading.placards.flatMap((p) => (p.dgClass === null ? [] : [p.dgClass]))
    if (reading.placards.length > 1) {
      return tile('placards', state, {
        headline: `${reading.placards.length} placards`,
        notes:
          classes.length > 0 ? [[...new Set(classes)].map((c) => `Class ${c}`).join(', ')] : [],
        certainty: reading.certainty,
      })
    }
    const only = reading.placards[0]
    return tile('placards', state, {
      headline: placardHeadline(only?.dgClass, reading.certainty),
      certainty: reading.certainty,
    })
  }
  const dg = record?.details?.dgPlacard
  if (dg?.answer !== 'placard') return null
  return tile('placards', state, {
    headline: placardHeadline(dg.dgClass, dg.certainty),
    certainty: dg.certainty,
  })
}

/**
 * The tiles for one inspection. `record` may be null before anything has landed. `parts` says which
 * stages have arrived: the ID stage carries the ID and the seal, details carry the placard, damage its own.
 */
export function buildKeyFacts(record: InspectionRecord | null, parts: PartStates): KeyFactTile[] {
  const placards = placardsTile(parts.details, record)
  return [
    idTile(parts.id, record),
    sealTile(parts.id, record),
    damageTile(parts.damage, record),
    ...(placards ? [placards] : []),
  ]
}
