// What every damage set's reader shares (spec #27, tickets #33 and #35). Pure.
//
// A damage set (long side, door end) asks the same rubric: per-region visibility, deformation shape, the
// CEDEX damage-type predicates and a five-level severity, plus component checks outside the regions. These
// are the answer-reading pieces, so each set's reader is only its own geometry and wording.
import { certaintyOfProbability } from './certainty'
import {
  SEVERITY_LEVELS,
  severityOfLevel,
  type DamageComponent,
  type DamageFace,
  type DamageFinding,
  type DamageType,
  type FaceCoverage,
  type FindingCertainty,
  type FindingZone,
  type ImageQuality,
  type ZoneVisibility,
} from './damage'
import type { SharedAnswer } from './questionSet'

/** ISO 9897 CEDEX damage types the sets ask about, in their order. Damage types, not locations. */
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
export const PRESENT_MIN = 0.5
/** Damage types below this are left off a finding's list. */
const LISTED_MIN = 0.2
/** A severity level this probable is offered as a plausible alternative. */
const ALTERNATIVE_MIN = 0.2

export const SEVERITY_CAVEAT =
  'Severity is an apparent visual judgement from one photo, not a repair verdict.'

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function probabilityOf(answer: SharedAnswer | undefined): number | null {
  return answer?.type === 'predicate' ? answer.probability : null
}

export function choiceOf(answer: SharedAnswer | undefined): string | null {
  return answer?.type === 'choice' ? answer.value : null
}

export const VISIBILITY: Record<string, ZoneVisibility> = {
  clear: 'clear',
  partial: 'partial',
  not_visible: 'not-visible',
}

export const QUALITY: Record<string, ImageQuality> = {
  good: 'good',
  limited: 'limited',
  poor: 'poor',
}

export const COVERAGE: Record<string, FaceCoverage> = {
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
export function findingCertainty(probability: number): FindingCertainty {
  const label = certaintyOfProbability(probability)
  return label === 'Confident' || label === 'Likely' ? label : 'Uncertain'
}

/** One step less certain, for a region only partly visible. */
function lessCertain(certainty: FindingCertainty): FindingCertainty {
  return certainty === 'Confident' ? 'Likely' : 'Uncertain'
}

function typesOf(answers: Record<string, SharedAnswer>, prefix: string): DamageType[] {
  return CEDEX_TYPES.flatMap(({ code, name }) => {
    const probability = probabilityOf(answers[`${prefix}_${code}`])
    return probability === null ? [] : [{ code, name, probability }]
  }).sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
}

/** One judged region of a face: the set's own id, its area and its plain-words label. */
export interface PanelRegion {
  id: string
  face: DamageFace
  zone: FindingZone
  /** Lower-case plain words, e.g. "photo-left door leaf, top third". */
  label: string
}

/** How a set words its panel findings. */
export interface PanelWords {
  /** The surface, e.g. "the side sheet" or "the door panel". */
  surface: string
  /** The finding's location, from the region label. */
  locationOf: (label: string) => string
  /** The word for a region in caveats, e.g. "zone" or "region". */
  regionNoun: string
}

/** The panel finding for one region, or null when its severity is none (or it was not seen). */
export function panelFinding(
  answers: Record<string, SharedAnswer>,
  region: PanelRegion,
  visibility: ZoneVisibility | null,
  words: PanelWords,
): Omit<DamageFinding, 'id'> | null {
  const score = answers[`${region.id}_severity`]
  if (score?.type !== 'score' || visibility === 'not-visible') return null
  const severity = severityOfLevel(score.label)
  if (!severity) return null

  const allTypes = typesOf(answers, region.id)
  const listed = allTypes.filter((t, i) => i === 0 || (t.probability ?? 0) >= LISTED_MIN)
  const top = allTypes[0]
  const named = top && (top.probability ?? 0) >= PRESENT_MIN ? top : null
  const noun = named ? CEDEX_TYPES.find((t) => t.code === named.code)?.noun : null
  const corrosion = named?.code === 'CO' || named?.code === 'CH'
  const title = noun
    ? `${noun} ${corrosion ? 'on' : 'in'} ${words.surface}`
    : `Possible damage in ${words.surface}`

  const hasDistribution = score.probabilities.some((p) => p > 0)
  const damaged = hasDistribution ? 1 - (score.probabilities[0] ?? 0) : (named?.probability ?? 0.5)
  let certainty = findingCertainty(damaged)
  const caveats: string[] = []
  if (visibility === 'partial') {
    certainty = lessCertain(certainty)
    caveats.push(`Only part of this ${words.regionNoun} is clearly visible.`)
  }
  caveats.push(
    `Approximate area: ${region.label}. Not a measured or certified location.`,
    SEVERITY_CAVEAT,
  )

  const alternative = score.probabilities
    .map((p, i) => ({ p, level: SEVERITY_LEVELS[i] }))
    .filter((e) => e.level !== undefined && e.level !== severity && e.p >= ALTERNATIVE_MIN)
    .sort((a, b) => b.p - a.p)[0]
  const shape = SHAPE[choiceOf(answers[`${region.id}_deformation_shape`]) ?? '']
  const what = noun ? noun.toLowerCase() : 'damage'

  return {
    face: region.face,
    zone: region.zone,
    component: 'panel',
    visibility,
    location: words.locationOf(region.label),
    title,
    description: shape
      ? `The deformation looks like ${shape}.`
      : `Suspected ${what} in this part of ${words.surface}.`,
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

/** A part outside the judged regions, asked as one or more predicates. */
export interface ComponentCheck {
  /** The predicates, each with the damage type it names (null when it names none). */
  checks: { name: string; code: string | null }[]
  component: DamageComponent
  title: string
  location: string
  /** The part's area on the face; null when the set does not say which one (e.g. "a corner casting"). */
  zone: FindingZone | null
  /** What the card says when no damage type is named. Defaults to a generic phrase. */
  fallback?: string
}

/** The component finding, or null when no check reaches PRESENT_MIN. Never rated: the photo gives no severity. */
export function componentFinding(
  answers: Record<string, SharedAnswer>,
  check: ComponentCheck,
  face: DamageFace,
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
    face,
    zone: check.zone,
    component: check.component,
    visibility: null,
    location: check.location,
    title: check.title,
    description: `${check.location}: ${types.length > 0 ? types.map((t) => t.name.toLowerCase()).join(', ') : (check.fallback ?? 'visibly dented, bent, cracked or broken')}.`,
    bestInterpretation: 'visible damage to this component.',
    uncertainty: 'The photo gives no severity rating for this component.',
    types,
    severity: null,
    certainty: findingCertainty(strongest.probability),
    caveats: ['Approximate location on an illustrative drawing.', SEVERITY_CAVEAT],
  }
}
