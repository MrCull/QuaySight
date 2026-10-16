// The long-side damage set (spec #27, ticket #33) and its answers as damage findings. Pure.
//
// The set is the product owner's v2 set, stored as data beside the other damage sets
// (questionSets/side-damage-v2.json) with its "20-foot" wording generalised. It judges a photo-relative
// 5 × 2 grid over the main side sheet (Z1T…Z5B, columns from photo left, top and bottom halves), each
// zone's visibility, deformation shape, the CEDEX damage-type predicates and a five-level severity,
// plus rail, corner-post and casting checks. Zone ids are application zones, never CEDEX location
// codes: the photo does not establish which side or which end it is.
import sideDamageJson from './questionSets/side-damage-v2.json'
import { certaintyOfProbability } from './certainty'
import {
  SEVERITY_LEVELS,
  severityOfLevel,
  type DamageComponent,
  type DamageFinding,
  type DamageType,
  type FaceCoverage,
  type FindingCertainty,
  type FindingZone,
  type ImageQuality,
  type ZoneCoverage,
  type ZoneVisibility,
} from './damage'
import type { DamageSetReading } from './damageSets'
import { parseQuestionSet, type SharedAnswer, type SharedQuestionSet } from './questionSet'

export const SIDE_DAMAGE_SET: SharedQuestionSet = parseQuestionSet(sideDamageJson)

/** ISO 9897 CEDEX damage types the set asks about, in the set's order. Damage types, not locations. */
export const CEDEX_TYPES: readonly { code: string; name: string; noun: string }[] = [
  { code: 'DT', name: 'Dent', noun: 'Dent' },
  { code: 'BT', name: 'Bent', noun: 'Bend' },
  { code: 'BW', name: 'Bowed', noun: 'Bow' },
  { code: 'HO', name: 'Holed', noun: 'Hole' },
  { code: 'CK', name: 'Cracked', noun: 'Crack' },
  { code: 'CW', name: 'Cracked weld', noun: 'Cracked weld' },
  { code: 'CO', name: 'Corroded', noun: 'Corrosion' },
  { code: 'CH', name: 'Corroded and holed', noun: 'Corrosion hole' },
  { code: 'BR', name: 'Broken', noun: 'Break' },
]

/** At or above this probability a predicate counts as seen: a component finding, a named damage type. */
const PRESENT_MIN = 0.5
/** Damage types below this are left off a finding's list. */
const LISTED_MIN = 0.2
/** A severity level this probable is offered as a plausible alternative. */
const ALTERNATIVE_MIN = 0.2

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

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function probabilityOf(answer: SharedAnswer | undefined): number | null {
  return answer?.type === 'predicate' ? answer.probability : null
}

function choiceOf(answer: SharedAnswer | undefined): string | null {
  return answer?.type === 'choice' ? answer.value : null
}

const VISIBILITY: Record<string, ZoneVisibility> = {
  clear: 'clear',
  partial: 'partial',
  not_visible: 'not-visible',
}

const QUALITY: Record<string, ImageQuality> = { good: 'good', limited: 'limited', poor: 'poor' }

const COVERAGE: Record<string, FaceCoverage> = {
  full: 'full',
  most: 'most',
  partial: 'partial',
  not_inspectable: 'not-inspectable',
}

const SHAPE: Record<string, string> = {
  local_dent: 'a local dent',
  sharp_bend: 'a sharp bend',
  broad_bow: 'a broad bow',
  mixed: 'more than one kind of deformation',
}

/** A finding's certainty: Can't tell is never a finding's word, so it reads Uncertain. */
function findingCertainty(probability: number): FindingCertainty {
  const label = certaintyOfProbability(probability)
  return label === 'Confident' || label === 'Likely' ? label : 'Uncertain'
}

/** One step less certain, for a zone only partly visible. */
function lessCertain(certainty: FindingCertainty): FindingCertainty {
  return certainty === 'Confident' ? 'Likely' : 'Uncertain'
}

const SEVERITY_CAVEAT =
  'Severity is an apparent visual judgement from one photo, not a repair verdict.'

function typesOf(answers: Record<string, SharedAnswer>, prefix: string): DamageType[] {
  return CEDEX_TYPES.flatMap(({ code, name }) => {
    const probability = probabilityOf(answers[`${prefix}_${code}`])
    return probability === null ? [] : [{ code, name, probability }]
  }).sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
}

/** The panel finding for one zone, or null when its severity is none (or it was not seen). */
function zoneFinding(
  answers: Record<string, SharedAnswer>,
  zone: SideZone,
  visibility: ZoneVisibility | null,
): Omit<DamageFinding, 'id'> | null {
  const score = answers[`${zone.id}_severity`]
  if (score?.type !== 'score' || visibility === 'not-visible') return null
  const severity = severityOfLevel(score.label)
  if (!severity) return null

  const allTypes = typesOf(answers, zone.id)
  const listed = allTypes.filter((t, i) => i === 0 || (t.probability ?? 0) >= LISTED_MIN)
  const top = allTypes[0]
  const named = top && (top.probability ?? 0) >= PRESENT_MIN ? top : null
  const noun = named ? CEDEX_TYPES.find((t) => t.code === named.code)?.noun : null
  const corrosion = named?.code === 'CO' || named?.code === 'CH'
  const title = noun
    ? `${noun} ${corrosion ? 'on' : 'in'} the side sheet`
    : 'Possible damage in the side sheet'

  const hasDistribution = score.probabilities.some((p) => p > 0)
  const damaged = hasDistribution ? 1 - (score.probabilities[0] ?? 0) : (named?.probability ?? 0.5)
  let certainty = findingCertainty(damaged)
  const caveats: string[] = []
  if (visibility === 'partial') {
    certainty = lessCertain(certainty)
    caveats.push('Only part of this zone is clearly visible.')
  }
  caveats.push(
    `Approximate area: ${zoneLabel(zone)}. Not a measured or certified location.`,
    SEVERITY_CAVEAT,
  )

  const alternative = score.probabilities
    .map((p, i) => ({ p, level: SEVERITY_LEVELS[i] }))
    .filter((e) => e.level !== undefined && e.level !== severity && e.p >= ALTERNATIVE_MIN)
    .sort((a, b) => b.p - a.p)[0]
  const shape = SHAPE[choiceOf(answers[`${zone.id}_deformation_shape`]) ?? '']
  const what = noun ? noun.toLowerCase() : 'damage'

  return {
    face: 'long-side',
    zone: zoneOf(zone),
    component: 'panel',
    visibility,
    location: capitalise(zoneLabel(zone)),
    title,
    description: shape
      ? `The deformation looks like ${shape}.`
      : `Suspected ${what} in this part of the side sheet.`,
    bestInterpretation: `apparent ${severity} ${what}.`,
    uncertainty: alternative
      ? alternative.level === 'none'
        ? 'It could also be no damage at all.'
        : `The severity could also be ${alternative.level}.`
      : 'Depth and extent cannot be judged precisely from one photo.',
    types: listed,
    severity,
    ...(hasDistribution ? { severityProbabilities: [...score.probabilities] } : {}),
    certainty,
    caveats,
  }
}

interface ComponentCheck {
  /** The predicates, each with the damage type it names (null when it names none). */
  checks: { name: string; code: string | null }[]
  component: DamageComponent
  title: string
  location: string
  zone: FindingZone | null
}

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

function componentFinding(
  answers: Record<string, SharedAnswer>,
  check: ComponentCheck,
): Omit<DamageFinding, 'id'> | null {
  const seen = check.checks
    .map((c) => ({ ...c, probability: probabilityOf(answers[c.name]) }))
    .filter((c): c is typeof c & { probability: number } => (c.probability ?? 0) >= PRESENT_MIN)
    .sort((a, b) => b.probability - a.probability)
  const strongest = seen[0]
  if (!strongest) return null
  const types = seen.flatMap((c) => {
    const type = CEDEX_TYPES.find((t) => t.code === c.code)
    return type ? [{ code: type.code, name: type.name, probability: c.probability }] : []
  })
  return {
    face: 'long-side',
    zone: check.zone,
    component: check.component,
    visibility: null,
    location: check.location,
    title: check.title,
    description: `${check.location}: ${types.length > 0 ? types.map((t) => t.name.toLowerCase()).join(', ') : 'visibly dented, bent, cracked or broken'}.`,
    bestInterpretation: 'visible damage to this component.',
    uncertainty: 'The photo gives no severity rating for this component.',
    types,
    severity: null,
    certainty: findingCertainty(strongest.probability),
    caveats: ['Approximate location on an illustrative drawing.', SEVERITY_CAVEAT],
  }
}

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
    ...SIDE_ZONES.map((zone, i) => zoneFinding(answers, zone, zones[i]!.visibility)),
    ...COMPONENTS.map((check) => componentFinding(answers, check)),
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
    doorEnd: doorEnd === 'image_left' ? 'image-left' : doorEnd === 'image_right' ? 'image-right' : null,
  }
}
