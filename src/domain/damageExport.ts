// The damage part of the inspection export (spec 8.3; split out in ticket #54), as detailsExport and
// weightsExport are for theirs. Pure: the record in, the `damage` block and any unresolved entry out.
import {
  SEVERITY_LEVELS,
  faceStatus,
  potentiallySignificant,
  type DamageFace,
  type DamageFinding,
  type FindingZone,
} from './damage'
import { sectionScheme, sectionsOfZone } from './sideSections'
import type { InspectionRecord } from './inspection'
import type { ExportUnresolved, InspectionExport } from './exportTypes'

function sectionsOf(
  scheme: ReturnType<typeof sectionScheme>,
  face: DamageFace,
  zone: FindingZone | null,
): number[] | null {
  return scheme && zone && (face === 'left' || face === 'right')
    ? sectionsOfZone(zone, scheme.lengthFt, scheme.side)
    : null
}

const FIXED_FACES = ['rear', 'front', 'left', 'right', 'roof'] as const

function sourcePassKind(record: InspectionRecord): 'recorded-run' | 'provider-call' {
  return record.source === 'recorded' ? 'recorded-run' : 'provider-call'
}

export function damageExport(record: InspectionRecord): {
  damage: InspectionExport['damage']
  unresolved: ExportUnresolved[]
} {
  const assessment = record.damage?.notAssessed ? null : record.damage
  const scheme = assessment ? sectionScheme(assessment) : null
  const notAssessedReason = record.damage?.notAssessed?.reason ?? null
  const unresolved: ExportUnresolved[] = []
  if (!assessment) {
    unresolved.push({
      field: 'damage',
      category: 'unresolved',
      reason: notAssessedReason
        ? `Not assessed for this view. ${notAssessedReason}`
        : 'Not assessed.',
    })
  }
  /** The photos (by name) a finding was seen in; empty for a single photo's own findings. */
  const photosOf = (f: DamageFinding): string[] =>
    (f.photos ?? []).map((n) => record.photos?.find((p) => p.index === n)?.name ?? `Photo ${n}`)
  return {
    unresolved,
    damage: {
      assessed: assessment !== null,
      notAssessedReason,
      photoFace: record.photoFace ?? null,
      imageQuality: assessment?.imageQuality ?? null,
      coverage: assessment?.coverage ?? null,
      potentiallySignificant:
        assessment && assessment.significantProbability != null
          ? potentiallySignificant(assessment)
          : null,
      significantProbability: assessment?.significantProbability ?? null,
      doorEnd: assessment?.doorEnd ?? null,
      sideInference: assessment?.sideInference ?? null,
      photos: assessment?.photos ?? [],
      faces: FIXED_FACES.map((face) => ({
        face,
        status: assessment ? faceStatus(assessment, face) : 'not-assessed',
      })),
      zones: (assessment?.zones ?? []).map((z) => ({
        id: z.id,
        face: z.face,
        label: z.label,
        visibility: z.visibility,
        sections: sectionsOf(scheme, z.face, z.zone),
      })),
      longSideSections: scheme && {
        ...scheme,
        numberedFrom:
          assessment?.sideInference?.basis === 'defaulted' ? 'assumed door end' : 'door end',
      },
      findings: [
        ...(assessment?.findings ?? []).map((f) => ({ f, unidentifiedFace: false })),
        ...(assessment?.unplaced ?? []).map((f) => ({ f, unidentifiedFace: true })),
      ].map(({ f, unidentifiedFace }) => ({
        findingId: f.id,
        title: f.title,
        face: f.face,
        component: f.component,
        visibility: f.visibility,
        severity: f.severity ?? "can't tell",
        severityProbabilities: f.severityProbabilities
          ? Object.fromEntries(
              SEVERITY_LEVELS.map((level, i) => [level, f.severityProbabilities![i] ?? 0]),
            )
          : null,
        certainty: f.certainty,
        types: f.types.map((t) => t.code),
        region: { location: f.location, zone: f.zone },
        sections: sectionsOf(scheme, f.face, f.zone),
        photo: photosOf(f)[0] ?? assessment?.photos.find((p) => p.face === f.face)?.photo ?? null,
        photos: photosOf(f),
        unidentifiedFace,
        sourcePass: { passId: assessment?.passId ?? record.id, kind: sourcePassKind(record) },
      })),
    },
  }
}
