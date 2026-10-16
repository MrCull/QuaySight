// The long-side damage set (spec #27, ticket #33) and its answers as damage findings. Pure.
//
// The set is the product owner's v2 set, stored as data beside the other damage sets
// (questionSets/side-damage-v2.json) with its "20-foot" wording generalised. It judges a photo-relative
// 5 × 2 grid over the main side sheet (Z1T…Z5B, columns from photo left, top and bottom halves), each
// zone's visibility, deformation shape, the CEDEX damage-type predicates and a five-level severity,
// plus rail, corner-post and casting checks. Zone ids are application zones, never CEDEX location
// codes: the photo does not establish which side or which end it is.
import sideDamageJson from './questionSets/side-damage-v2.json'
import {
  COVERAGE,
  QUALITY,
  VISIBILITY,
  CEDEX_TYPES,
  capitalise,
  choiceOf,
  componentFinding,
  panelFinding,
  probabilityOf,
  type ComponentCheck,
  type PanelRegion,
} from './damageReading'
import type { DamageFinding, FindingZone, ZoneCoverage } from './damage'
import type { DamageSetReading } from './damageSets'
import { parseQuestionSet, type SharedAnswer, type SharedQuestionSet } from './questionSet'

export const SIDE_DAMAGE_SET: SharedQuestionSet = parseQuestionSet(sideDamageJson)

export { CEDEX_TYPES }

const COLUMNS = 5
const ORDINAL_COLUMNS = ['1', '2', '3', '4', '5']

interface SideZone {
  id: string
  column: number
  half: 'T' | 'B'
}

const SIDE_ZONES: SideZone[] = ORDINAL_COLUMNS.flatMap((n) =>
  (['T', 'B'] as const).map((half) => ({ id: `Z${n}${half}`, column: Number(n), half })),
)

function zoneOf({ column, half }: SideZone): FindingZone {
  return {
    u0: (column - 1) / COLUMNS,
    u1: column / COLUMNS,
    v0: half === 'T' ? 0 : 0.5,
    v1: half === 'T' ? 0.5 : 1,
  }
}

function zoneLabel({ column, half }: SideZone): string {
  return `photo column ${column} of ${COLUMNS} from the left, ${half === 'T' ? 'upper' : 'lower'} half of the side sheet`
}

function regionOf(zone: SideZone): PanelRegion {
  return { id: zone.id, face: 'long-side', zone: zoneOf(zone), label: zoneLabel(zone) }
}

const WORDS = { surface: 'the side sheet', locationOf: capitalise, regionNoun: 'zone' }

// Rails, corner posts and castings sit outside the sheet's zones. Their areas are bands along the
// edges of the image-relative face; which casting is not said, so it has no area.
const COMPONENTS: ComponentCheck[] = [
  {
    checks: [
      { name: 'bottom_rail_bent', code: 'BT' },
      { name: 'bottom_rail_corrosion', code: 'CO' },
      { name: 'bottom_rail_broken', code: 'BR' },
    ],
    component: 'rail',
    title: 'Damage to the bottom side rail',
    location: 'Bottom side rail',
    zone: { u0: 0, u1: 1, v0: 0.93, v1: 1 },
  },
  {
    checks: [{ name: 'top_rail_bent', code: 'BT' }],
    component: 'rail',
    title: 'Damage to the top side rail',
    location: 'Top side rail',
    zone: { u0: 0, u1: 1, v0: 0, v1: 0.07 },
  },
  {
    checks: [{ name: 'left_end_corner_post_damage', code: null }],
    component: 'corner-post',
    title: 'Damage to the corner post at photo left',
    location: 'Corner post at photo left',
    zone: { u0: 0, u1: 0.04, v0: 0, v1: 1 },
  },
  {
    checks: [{ name: 'right_end_corner_post_damage', code: null }],
    component: 'corner-post',
    title: 'Damage to the corner post at photo right',
    location: 'Corner post at photo right',
    zone: { u0: 0.96, u1: 1, v0: 0, v1: 1 },
  },
  {
    checks: [{ name: 'corner_casting_damage', code: null }],
    component: 'casting',
    title: 'Damage to a corner casting',
    location: 'One of the corner castings; which one is not established',
    zone: null,
  },
]

/**
 * The side set's answers (by question name) as a damage-set reading: one panel finding per zone whose
 * severity is above none, one finding per damaged component, every zone's visibility, and the set's
 * own photo quality, coverage, door-end and "potentially significant damage" checks. Anything the reply
 * left unanswered stays unread (null), never clean.
 */
export function readSideDamage(answers: Record<string, SharedAnswer>): DamageSetReading {
  const zones: ZoneCoverage[] = SIDE_ZONES.map((zone) => ({
    id: zone.id,
    face: 'long-side',
    zone: zoneOf(zone),
    label: zoneLabel(zone),
    visibility: VISIBILITY[choiceOf(answers[`${zone.id}_visibility`]) ?? ''] ?? null,
  }))
  const found = [
    ...SIDE_ZONES.map((zone, i) =>
      panelFinding(answers, regionOf(zone), zones[i]!.visibility, WORDS),
    ),
    ...COMPONENTS.map((check) => componentFinding(answers, check, 'long-side')),
  ].filter((f): f is Omit<DamageFinding, 'id'> => f !== null)

  const coverage = COVERAGE[choiceOf(answers.side_panel_coverage) ?? ''] ?? null
  const doorEnd = choiceOf(answers.door_end_in_image)
  return {
    face: 'long-side',
    inspectable: coverage !== 'not-inspectable',
    findings: found.map((f, i) => ({ id: i + 1, ...f })),
    zones,
    imageQuality: QUALITY[choiceOf(answers.image_quality) ?? ''] ?? null,
    coverage,
    significantProbability: probabilityOf(answers.potentially_significant_damage),
    doorEnd:
      doorEnd === 'image_left' ? 'image-left' : doorEnd === 'image_right' ? 'image-right' : null,
  }
}
