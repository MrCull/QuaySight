// The damage of several photos of one container, as one assessment (spec #51, ticket #71). Pure.
//
// - Findings on the same face, of the same damage type, on the same part and in the same CEDEX section are
//   one damage: it keeps the higher severity, the agreement rule from #70 sets its certainty, and it lists
//   every photo it was seen in. A different type in the same section stays a separate damage.
// - Findings from a photo whose face could not be identified are not placed on the drawing: they are kept
//   apart in `unplaced`, under "Damage on a face we couldn't identify".
// - Every face that has a photo is photographed; only faces with no photo stay Not seen.
// - Cards are numbered 1.. in the order sortFindings gives (certainty, then severity); unplaced ones follow.
import { agree } from './combineReadings'
import { observeDamage } from './damageObservation'
import {
  sortFindings,
  type DamageAssessment,
  type DamageFace,
  type DamageFinding,
  type FindingCertainty,
  type PhotoCoverage,
  type Severity,
  type ZoneCoverage,
} from './damage'
import type { InspectionRecord } from './inspection'
import { facesShown, type PhotoFace } from './photoFace'
import { sectionScheme, sectionsOfZone } from './sideSections'

export interface DamageRun {
  /** 1-based photo number. */
  index: number
  name: string
  record: InspectionRecord
}

export const UNIDENTIFIED_FACE_HEADING = "Damage on a face we couldn't identify"

const SEVERITY_RANK: Record<Severity, number> = { major: 4, moderate: 3, minor: 2, cosmetic: 1 }
const CERTAINTY_RANK: Record<FindingCertainty, number> = { Confident: 3, Likely: 2, Uncertain: 1 }
const VISIBILITY_RANK = { clear: 3, partial: 2, 'not-visible': 1 } as const

const severityRank = (f: DamageFinding) => (f.severity ? SEVERITY_RANK[f.severity] : 0)

const assessedDamage = (run: DamageRun): DamageAssessment | null =>
  run.record.damage && !run.record.damage.notAssessed ? run.record.damage : null

const isDropped = (run: DamageRun) => run.record.photoFace?.face === 'not-container'

/** A face a photo shows, as the drawing names it; null for a close-up or a face it could not place. */
function drawingFace(run: DamageRun, face: PhotoFace | undefined): DamageFace | null {
  switch (face) {
    case 'rear-doors':
      return 'rear'
    case 'front-end':
      return 'front'
    case 'roof':
      return 'roof'
    case 'long-side':
      return run.record.damage?.sideInference?.side ?? 'long-side'
    default:
      return null
  }
}

/** The face a photo shows for the drawing, from the survey's reading; null when it did not place one. */
const faceOfRun = (run: DamageRun): DamageFace | null =>
  drawingFace(run, run.record.photoFace?.face)

interface Placed {
  finding: DamageFinding
  photo: number
  sections: number[] | null
}

function sectionsIntersect(a: number[] | null, b: number[] | null): boolean {
  if (!a || !b) return a === b
  return a.some((s) => b.includes(s))
}

function sameDamage(a: Placed, b: Placed): boolean {
  // Door regions carry detail that a shared component and damage type cannot replace.
  if (a.finding.face === 'rear') {
    const x = a.finding.zone
    const y = b.finding.zone
    if (!x || !y || x.u0 !== y.u0 || x.u1 !== y.u1 || x.v0 !== y.v0 || x.v1 !== y.v1) return false
  }
  return (
    a.finding.face === b.finding.face &&
    a.finding.component === b.finding.component &&
    (a.finding.types[0]?.code ?? '') === (b.finding.types[0]?.code ?? '') &&
    sectionsIntersect(a.sections, b.sections)
  )
}

function merge(group: Placed[]): DamageFinding {
  const best = group.reduce((a, c) =>
    severityRank(c.finding) > severityRank(a.finding) ||
    (severityRank(c.finding) === severityRank(a.finding) &&
      CERTAINTY_RANK[c.finding.certainty] > CERTAINTY_RANK[a.finding.certainty])
      ? c
      : a,
  )
  const certainty = agree(
    group.map((g) => ({ photo: g.photo, value: true, certainty: g.finding.certainty })),
  )!.certainty as FindingCertainty
  return {
    ...best.finding,
    certainty,
    photos: [...new Set(group.map((g) => g.photo))].sort((a, b) => a - b),
    ...(group.some((g) => g.finding.observations)
      ? {
          observations: group.flatMap((g) => g.finding.observations ?? []),
        }
      : {}),
  }
}

/**
 * The combined damage of the photos' records, and for each photo the numbers of the damages it was seen in.
 * Null when no photo has an assessed face: the caller keeps what the first photo's record carries.
 */
export function combineDamage(runs: readonly DamageRun[]): {
  damage: DamageAssessment
  from: Record<number, number[]>
} | null {
  const kept = runs.filter((r) => !isDropped(r))
  const assessed = kept.filter((r) => assessedDamage(r))
  if (assessed.length === 0) return null
  const base = assessedDamage(assessed[0]!)!

  const placed: Placed[] = assessed.flatMap((run) => {
    const damage = assessedDamage(run)!
    const scheme = sectionScheme(damage)
    return damage.findings.map((finding) => ({
      finding: {
        ...finding,
        ...(finding.observations
          ? {
              observations: finding.observations.map((o) => ({
                ...o,
                id: `photo-${run.index}:${o.id}`,
                photo: { name: run.name, index: run.index },
              })),
            }
          : {}),
      },
      photo: run.index,
      sections:
        scheme && finding.zone && (finding.face === 'left' || finding.face === 'right')
          ? sectionsOfZone(finding.zone, scheme.lengthFt, scheme.side)
          : null,
    }))
  })
  const groups: Placed[][] = []
  for (const p of placed) {
    const group = groups.find((g) => g.every((m) => m.photo !== p.photo) && sameDamage(g[0]!, p))
    if (group) group.push(p)
    else groups.push([p])
  }
  const merged = sortFindings(groups.map(merge)).map((f, i) => ({
    ...f,
    id: i + 1,
    ...(f.observations
      ? { observations: f.observations.map((o) => ({ ...o, findingId: i + 1 })) }
      : {}),
  }))

  // Photos whose face could not be identified: their findings are listed but not drawn.
  const unidentified = kept.filter((r) => {
    const face = r.record.photoFace?.face
    return !assessedDamage(r) && (face === undefined || face === 'unknown')
  })
  const unplaced = unidentified
    .flatMap((run) =>
      (run.record.damageReadings ?? [])
        .filter((reading) => reading.inspectable)
        .flatMap((reading) =>
          reading.findings.map((f) => ({
            ...observeDamage(
              f,
              reading.face,
              { name: run.name, index: run.index },
              reading.passId ?? null,
            ),
            photos: [run.index],
          })),
        ),
    )
    .map((f, i) => ({
      ...f,
      id: merged.length + i + 1,
      observations: f.observations?.map((o) => ({ ...o, findingId: merged.length + i + 1 })),
    }))

  const from: Record<number, number[]> = {}
  for (const f of [...merged, ...unplaced]) {
    for (const photo of f.photos ?? []) (from[photo] ??= []).push(f.id)
  }

  const photos: PhotoCoverage[] = []
  for (const run of kept) {
    const own = assessedDamage(run)?.photos ?? []
    const face = faceOfRun(run)
    const faces = own.length > 0 ? own.map((p) => p.face) : face ? [face] : []
    // A corner photo shows a second face (doors and a side, a side and the front end): it is in a photo too.
    for (const shown of facesShown(run.record.photoFace)) {
      const extra = drawingFace(run, shown)
      if (extra && !faces.includes(extra)) faces.push(extra)
    }
    for (const f of faces) photos.push({ photo: run.name, face: f, index: run.index })
  }

  const zones = new Map<string, ZoneCoverage>()
  const zoneRank = (z: ZoneCoverage) => (z.visibility ? VISIBILITY_RANK[z.visibility] : 0)
  for (const run of assessed) {
    for (const z of assessedDamage(run)!.zones ?? []) {
      const key = `${z.face}:${z.id}`
      const had = zones.get(key)
      if (!had || zoneRank(z) > zoneRank(had)) zones.set(key, z)
    }
  }

  const probabilities = assessed.flatMap((r) => assessedDamage(r)!.significantProbability ?? [])
  // A side the doors settled beats one that was only assumed.
  const sides = assessed.map((r) => assessedDamage(r)!).filter((d) => d.sideInference)
  const withSide = sides.find((d) => d.sideInference!.basis === 'inferred') ?? sides[0]
  return {
    damage: {
      ...base,
      photos,
      findings: merged,
      ...(unplaced.length > 0 ? { unplaced } : {}),
      ...(zones.size > 0 ? { zones: [...zones.values()] } : {}),
      significantProbability: probabilities.length > 0 ? Math.max(...probabilities) : null,
      ...(withSide?.sideInference ? { sideInference: withSide.sideInference } : {}),
    },
    from,
  }
}
