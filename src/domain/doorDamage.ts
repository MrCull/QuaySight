// The door-end damage set (spec #27, ticket #35) and its answers as damage findings. Pure.
//
// Written in the side set's shape and stored as data beside it (questionSets/door-damage-v1.json): the same
// rubric, ISO 9897 CEDEX damage types and five-level severity. It judges the two door leaves, each split
// into photo-relative top, middle and bottom thirds (D1T…D2B, D1 the leaf at photo left), each region's
// visibility, deformation shape, the damage-type predicates and a severity, plus the locking bars, cams,
// hinges, gaskets, header, sill, corner posts and castings as components. Region ids are application
// regions, never CEDEX location codes: the photo does not establish which side of the container is which.
// The shared answer-reading pieces are in damageReading.ts; the side reader (sideDamage.ts) is the model.
import doorDamageJson from './questionSets/door-damage-v1.json'
import {
  COVERAGE,
  QUALITY,
  VISIBILITY,
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

export const DOOR_DAMAGE_SET: SharedQuestionSet = parseQuestionSet(doorDamageJson)

// The door end as fractions of its face (u across the width, v down from the top): corner posts at each
// edge, the header above and the sill below, the leaves between them. An illustrative layout, not a measure.
const POST = 0.05
const HEADER = 0.06
const SILL = 0.94
const LEAF_BANDS = ['T', 'M', 'B'] as const
const BAND_NAME = { T: 'top third', M: 'middle third', B: 'bottom third' }
const LEAF_NAME = { 1: 'photo-left door leaf', 2: 'photo-right door leaf' }

interface DoorRegion {
  id: string
  leaf: 1 | 2
  band: 'T' | 'M' | 'B'
}

const DOOR_REGIONS: DoorRegion[] = ([1, 2] as const).flatMap((leaf) =>
  LEAF_BANDS.map((band) => ({ id: `D${leaf}${band}`, leaf, band })),
)

function zoneOf({ leaf, band }: DoorRegion): FindingZone {
  const row = LEAF_BANDS.indexOf(band)
  const height = (SILL - HEADER) / LEAF_BANDS.length
  return {
    u0: leaf === 1 ? POST : 0.5,
    u1: leaf === 1 ? 0.5 : 1 - POST,
    v0: HEADER + row * height,
    v1: HEADER + (row + 1) * height,
  }
}

function regionOf(region: DoorRegion): PanelRegion {
  return {
    id: region.id,
    face: 'rear',
    zone: zoneOf(region),
    label: `${LEAF_NAME[region.leaf]}, ${BAND_NAME[region.band]}`,
  }
}

const WORDS = { surface: 'the door panel', locationOf: capitalise, regionNoun: 'region' }

const LEAVES_V = { v0: HEADER, v1: SILL }

function leafParts(side: 'left' | 'right'): ComponentCheck[] {
  const left = side === 'left'
  const leaf = left ? 'photo-left door leaf' : 'photo-right door leaf'
  return [
    {
      checks: [
        { name: `${side}_leaf_locking_bar_bent`, code: 'BT' },
        { name: `${side}_leaf_locking_bar_broken`, code: 'BR' },
      ],
      component: 'locking-bar',
      title: `Damage to a locking bar on the ${leaf}`,
      location: `Locking bar on the ${leaf}`,
      zone: { u0: left ? 0.2 : 0.74, u1: left ? 0.26 : 0.8, ...LEAVES_V },
      fallback: 'visibly bent, broken or missing',
    },
    {
      checks: [{ name: `${side}_leaf_hinge_damage`, code: null }],
      component: 'hinge',
      title: `Damage to the hinges on the ${leaf}`,
      location: `Hinges on the ${leaf}`,
      zone: { u0: left ? POST : 0.9, u1: left ? 0.1 : 1 - POST, ...LEAVES_V },
      fallback: 'visibly bent, cracked, broken or missing a pin',
    },
  ]
}

function beam(part: 'header' | 'sill'): ComponentCheck {
  const header = part === 'header'
  return {
    checks: [
      { name: `door_${part}_bent`, code: 'BT' },
      { name: `door_${part}_corrosion`, code: 'CO' },
      { name: `door_${part}_broken`, code: 'BR' },
    ],
    component: part,
    title: `Damage to the door ${part}`,
    location: `Door ${part}`,
    zone: { u0: POST, u1: 1 - POST, v0: header ? 0 : SILL, v1: header ? HEADER : 1 },
  }
}

// Door parts outside the leaf regions. Their areas are bands on the illustrative end; a cam, a gasket or a
// casting could be any of several, so those have no area and no pin.
const COMPONENTS: ComponentCheck[] = [
  ...leafParts('left').slice(0, 1),
  ...leafParts('right').slice(0, 1),
  {
    checks: [{ name: 'cam_keeper_damage', code: null }],
    component: 'cam',
    title: 'Damage to a locking cam or cam keeper',
    location: 'One of the locking cams or cam keepers; which one is not established',
    zone: null,
    fallback: 'visibly broken, bent or missing',
  },
  ...leafParts('left').slice(1),
  ...leafParts('right').slice(1),
  {
    checks: [{ name: 'door_gasket_damage', code: null }],
    component: 'gasket',
    title: 'Damage to a door gasket',
    location: 'A door gasket; which section is not established',
    zone: null,
    fallback: 'visibly torn, hanging out or missing',
  },
  beam('header'),
  beam('sill'),
  {
    checks: [{ name: 'left_corner_post_damage', code: null }],
    component: 'corner-post',
    title: 'Damage to the corner post at photo left',
    location: 'Corner post at photo left',
    zone: { u0: 0, u1: POST, v0: 0, v1: 1 },
  },
  {
    checks: [{ name: 'right_corner_post_damage', code: null }],
    component: 'corner-post',
    title: 'Damage to the corner post at photo right',
    location: 'Corner post at photo right',
    zone: { u0: 1 - POST, u1: 1, v0: 0, v1: 1 },
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
 * The door set's answers (by question name) as a damage-set reading: one panel finding per leaf region whose
 * severity is above none, one finding per damaged door part, every region's visibility, and the set's own
 * photo quality, coverage and "potentially significant damage" checks. Anything the reply left unanswered
 * stays unread (null), never clean.
 */
export function readDoorDamage(answers: Record<string, SharedAnswer>): DamageSetReading {
  const regions = DOOR_REGIONS.map(regionOf)
  const zones: ZoneCoverage[] = regions.map((region) => ({
    id: region.id,
    face: 'rear',
    zone: region.zone,
    label: region.label,
    visibility: VISIBILITY[choiceOf(answers[`${region.id}_visibility`]) ?? ''] ?? null,
  }))
  const found = [
    ...regions.map((region, i) => panelFinding(answers, region, zones[i]!.visibility, WORDS)),
    ...COMPONENTS.map((check) => componentFinding(answers, check, 'rear')),
  ].filter((f): f is Omit<DamageFinding, 'id'> => f !== null)

  const coverage = COVERAGE[choiceOf(answers.door_end_coverage) ?? ''] ?? null
  return {
    face: 'rear-doors',
    inspectable: coverage !== 'not-inspectable',
    findings: found.map((f, i) => ({ id: i + 1, ...f })),
    zones,
    imageQuality: QUALITY[choiceOf(answers.image_quality) ?? ''] ?? null,
    coverage,
    significantProbability: probabilityOf(answers.potentially_significant_damage),
    doorEnd: null,
  }
}
