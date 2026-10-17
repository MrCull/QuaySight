// Exports for an inspection (spec 8.3, 11.2): consolidated JSON, raw provider responses and a
// shareable plain-text summary. Every builder takes only the InspectionRecord. No key, header or
// credential can reach an export because none is an input.
import { labelsFor, recordedDemonstrationLabel } from './providers'
import {
  SEVERITY_LEVELS,
  faceStatus,
  potentiallySignificant,
  type DamageComponent,
  type DamageFace,
  type FaceCoverage,
  type FaceStatus,
  type FindingZone,
  type ImageQuality,
  type SeverityLevel,
  type SideInference,
  type ZoneVisibility,
} from './damage'
import { chosenLength, type ChosenLength, type ContainerLengthFt } from './chosenLength'
import { sectionScheme, sectionsOfZone } from './sideSections'
import type { FaceReading } from './photoFace'
import type { CertaintyLabel, InspectionRecord, Provenance, RecheckRecord } from './inspection'
import type { DetailSource } from './containerDetails'
import { detailsExport } from './detailsExport'
import { weightsExport } from './weightsExport'
import type { IdCropReadRecord } from './cropRead'

export const EXPORT_SCHEMA_VERSION = 1

export const EXPORT_NOTICE =
  'Quay Sight proof of concept (POC), non-certified. Estimates for discussion only, not an invoice and not a certified inspection.'

const SUMMARY_TITLE = 'Quay Sight - POC, non-certified'

export type ExportCategory = 'printed' | 'derived' | 'candidate' | 'unresolved'

export interface ExportValue {
  field: string
  /** Printed: read from the photo. Derived: decoded from a standard or calculated by arithmetic. */
  category: 'printed' | 'derived'
  value: string | number | null
  unit?: 'kg' | 'lb' | 'm3' | 'cu ft'
  /** observed: judged from the photo (an equipment check or a marking), not read as text. */
  provenance: Provenance | DetailSource
  certainty: CertaintyLabel | null
  uncertainty: string | null
}

export interface ExportCandidate {
  field: 'containerId'
  category: 'candidate'
  provenance: 'candidate'
  value: string
}

export interface ExportUnresolved {
  field: string
  category: 'unresolved'
  reason: string
}

export type FaceExportStatus = FaceStatus | 'not-assessed'

export interface ExportFindingLink {
  findingId: number
  title: string
  face: DamageFace
  /** Panel zone or structural component. */
  component: DamageComponent
  /** How well the finding's zone was seen, or null when the set did not say. */
  visibility: ZoneVisibility | null
  /** Apparent visual severity, or "can't tell" for a component the photo gives no severity for. */
  severity: string
  /** The model's probability for each severity level, when it gave them. */
  severityProbabilities: Partial<Record<SeverityLevel, number>> | null
  certainty: string
  types: string[]
  region: { location: string; zone: FindingZone | null }
  /** The CEDEX/IICL long-side sections the finding lies in, numbered from the door end; null off the long side or with no area. */
  sections: number[] | null
  photo: string | null
  sourcePass: { passId: string; kind: 'recorded-run' | 'provider-call' }
}

export interface InspectionExport {
  schemaVersion: number
  notice: string
  inspection: {
    id: string
    provider: string
    providerName: string
    model: string
    resolvedVersion: string
    source: InspectionRecord['source']
    status: InspectionRecord['status']
  }
  values: ExportValue[]
  candidates: ExportCandidate[]
  unresolved: ExportUnresolved[]
  conflicts: string[]
  /** Automatic re-checks: observations and outcome. Never shown in the UI. */
  rechecks: RecheckRecord[]
  /** Jev's crop read of the container ID: the crop and any character it disagreed on. Never shown in the UI. */
  idCropRead: IdCropReadRecord | null
  /** The container length the drawing used and where it came from (ISO code, model, or default). */
  containerLength: ChosenLength
  damage: {
    assessed: boolean
    /** Why the photo's view was not assessed (roof, close-up, unknown view, a face not inspectable), or null. */
    notAssessedReason: string | null
    /** The face the survey says the photo shows, or null when it did not say (or the run is recorded). */
    photoFace: FaceReading | null
    imageQuality: ImageQuality | null
    coverage: FaceCoverage | null
    /** "Potentially significant damage, closer inspection advised" (never a repair verdict); null when unread. */
    potentiallySignificant: boolean | null
    significantProbability: number | null
    /** Which edge of the photo the door end is at, only when the photo shows it directly. */
    doorEnd: 'image-left' | 'image-right' | null
    /** The long side a long-side photo was drawn on, and whether the doors inferred it or it was defaulted; null for other faces. */
    sideInference: SideInference | null
    photos: { photo: string; face: DamageFace }[]
    faces: { face: 'rear' | 'front' | 'left' | 'right' | 'roof'; status: FaceExportStatus }[]
    /** Every photo-relative zone the set judged, with its visibility: an unseen zone is never clean. */
    zones: {
      id: string
      face: DamageFace
      label: string
      visibility: ZoneVisibility | null
      /** The CEDEX/IICL long-side sections the zone covers, numbered from the door end; null off the long side. */
      sections: number[] | null
    }[]
    /** The long-side section scheme drawn: side, length and section count (5 for 20 ft, 10 for 40 and 45 ft); null off the long side. */
    longSideSections: {
      side: 'left' | 'right'
      lengthFt: ContainerLengthFt
      count: number
      /** 'assumed door end' when the side was defaulted, so the door end is not known. */
      numberedFrom: 'door end' | 'assumed door end'
    } | null
    findings: ExportFindingLink[]
  }
}

export interface RawResponsesExport {
  schemaVersion: number
  notice: string
  /** Top-level provenance so no reader mistakes a replayed sample for a live response (parent spec, Recorded samples). */
  source: 'recorded demonstration, not a live provider response' | 'live provider response'
  inspectionId: string
  responses: InspectionRecord['rawResponses']
}

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

function unreadPositions(value: string): number[] {
  return [...value].flatMap((ch, i) => (ch === '?' ? [i] : []))
}

export function buildInspectionExport(record: InspectionRecord): InspectionExport {
  const values: ExportValue[] = []
  const unresolved: ExportUnresolved[] = []
  const conflicts: string[] = []
  const reading = record.containerId

  if (reading) {
    values.push({
      field: 'containerId',
      category: 'printed',
      value: reading.value,
      provenance: 'printed',
      certainty: reading.certainty,
      uncertainty: reading.uncertainty ?? null,
    })
    for (const index of unreadPositions(reading.value)) {
      unresolved.push({
        field: `containerId.position[${index}]`,
        category: 'unresolved',
        reason: 'Character not read from the photo.',
      })
    }
    if (reading.observedCheckDigit === null) {
      unresolved.push({
        field: 'containerId.observedCheckDigit',
        category: 'unresolved',
        reason: 'Check digit not seen in the photo.',
      })
    } else {
      values.push({
        field: 'containerId.observedCheckDigit',
        category: 'printed',
        value: reading.observedCheckDigit,
        provenance: 'printed',
        certainty: reading.certainty,
        uncertainty: null,
      })
    }
    if (reading.calculatedCheckDigit === null) {
      unresolved.push({
        field: 'containerId.calculatedCheckDigit',
        category: 'unresolved',
        reason: 'Not calculated: the first ten characters are not all read.',
      })
    } else {
      values.push({
        field: 'containerId.calculatedCheckDigit',
        category: 'derived',
        value: reading.calculatedCheckDigit,
        provenance: 'calculated',
        certainty: null,
        uncertainty: null,
      })
    }
  } else {
    unresolved.push({ field: 'containerId', category: 'unresolved', reason: 'Not read.' })
  }

  const candidates: ExportCandidate[] = (reading?.alternatives ?? []).map((alt) => ({
    field: 'containerId',
    category: 'candidate',
    provenance: 'candidate',
    value: alt,
  }))

  if (record.details) {
    // A live survey: the printed code, what it decodes to, the checks and the markings.
    const details = detailsExport(record.details)
    values.push(...details.values)
    unresolved.push(...details.unresolved)
    conflicts.push(...details.conflicts)
  } else if (record.sizeCode) {
    values.push({
      field: 'sizeCode',
      category: 'derived',
      value: record.sizeCode.code,
      provenance: 'decoded',
      certainty: record.sizeCode.certainty,
      uncertainty: null,
    })
    values.push({
      field: 'sizeCode.meaning',
      category: 'derived',
      value: record.sizeCode.summary,
      provenance: 'decoded',
      certainty: record.sizeCode.certainty,
      uncertainty: null,
    })
  } else {
    unresolved.push({
      field: 'sizeCode',
      category: 'unresolved',
      reason: 'Not read or not decoded.',
    })
  }

  // Weights, in both units whatever the display units are (weightsExport.ts).
  const weights = weightsExport(record.weights)
  values.push(...weights.values)
  unresolved.push(...weights.unresolved)
  conflicts.push(...weights.conflicts)

  const assessment = record.damage?.notAssessed ? null : record.damage
  const scheme = assessment ? sectionScheme(assessment) : null
  const notAssessedReason = record.damage?.notAssessed?.reason ?? null
  if (!assessment) {
    unresolved.push({
      field: 'damage',
      category: 'unresolved',
      reason: notAssessedReason
        ? `Not assessed for this view. ${notAssessedReason}`
        : 'Not assessed.',
    })
  }

  return {
    schemaVersion: record.schemaVersion,
    notice: EXPORT_NOTICE,
    inspection: {
      id: record.id,
      provider: record.provider,
      providerName: labelsFor(record.provider, record.model).provider,
      model: record.model,
      resolvedVersion: record.resolvedVersion,
      source: record.source,
      status: record.status,
    },
    values,
    candidates,
    unresolved,
    conflicts,
    rechecks: record.rechecks ?? [],
    idCropRead: record.idCropRead ?? null,
    containerLength: chosenLength(record),
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
      findings: (assessment?.findings ?? []).map((f) => ({
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
        photo: assessment?.photos.find((p) => p.face === f.face)?.photo ?? null,
        sourcePass: { passId: assessment?.passId ?? record.id, kind: sourcePassKind(record) },
      })),
    },
  }
}

export function buildRawResponsesExport(record: InspectionRecord): RawResponsesExport {
  return {
    schemaVersion: record.schemaVersion,
    notice: EXPORT_NOTICE,
    source:
      record.source === 'recorded'
        ? 'recorded demonstration, not a live provider response'
        : 'live provider response',
    inspectionId: record.id,
    responses: record.rawResponses,
  }
}

const FACE_LABEL: Record<FaceExportStatus, string> = {
  photographed: 'photographed',
  'side-unknown': 'long side photographed, side not established',
  'not-seen': 'Not seen',
  'not-assessed': 'not assessed',
}
const FACE_NAME: Record<(typeof FIXED_FACES)[number], string> = {
  rear: 'Rear',
  front: 'Front',
  left: 'Left side',
  right: 'Right side',
  roof: 'Roof',
}

export function buildSummaryText(record: InspectionRecord): string {
  const json = buildInspectionExport(record)
  const lines: string[] = [SUMMARY_TITLE, EXPORT_NOTICE, '']

  if (record.source === 'recorded') {
    lines.push(
      recordedDemonstrationLabel(record),
      'Replayed from a saved sample: no live API call and no charge.',
      '',
    )
  }
  lines.push(
    `Provider: ${json.inspection.providerName}, model ${record.model}, resolved version ${record.resolvedVersion}`,
    `Inspection: ${record.id}`,
    '',
  )

  const reading = record.containerId
  if (reading) {
    lines.push(`Container ID (printed): ${reading.value} - ${reading.certainty}`)
    if (reading.observedCheckDigit !== null) {
      lines.push(
        reading.calculatedCheckDigit === null
          ? `  Check digit: observed ${reading.observedCheckDigit}, not calculated (ID incomplete)`
          : `  Check digit: observed ${reading.observedCheckDigit}, calculated ${reading.calculatedCheckDigit}, ${reading.checkDigitValid ? 'matches' : 'does not match'}`,
      )
    }
    for (const alt of json.candidates) lines.push(`  Also possible: ${alt.value}`)
  }
  for (const check of json.rechecks) {
    const cap = check.reason ? ` (stopped at the per-inspection ${check.reason} limit)` : ''
    lines.push(
      `Re-check of container ID (positions ${check.positions.join(', ')}): ${check.outcome}${cap}`,
    )
  }
  if (record.details) {
    lines.push(...detailsExport(record.details).summary)
  } else if (record.sizeCode) {
    lines.push(
      `Size code (decoded): ${record.sizeCode.code} - ${record.sizeCode.summary} - ${record.sizeCode.certainty}`,
    )
  }
  lines.push(...weightsExport(record.weights).summary)
  for (const conflict of json.conflicts) lines.push(`Conflict: ${conflict}`)
  lines.push('')

  if (json.damage.notAssessedReason) {
    lines.push(`Damage: not assessed for this view. ${json.damage.notAssessedReason}`)
  } else if (!json.damage.assessed) {
    lines.push('Damage: not assessed.')
  } else {
    const n = json.damage.findings.length
    lines.push(`Suspected damage: ${n} finding${n === 1 ? '' : 's'}`)
    if (json.damage.potentiallySignificant) {
      lines.push('Potentially significant damage, closer inspection advised.')
    }
    for (const f of json.damage.findings) {
      const severity = f.severity === "can't tell" ? "severity can't tell" : f.severity
      lines.push(`- ${f.title} - ${f.certainty}, ${severity}`)
      lines.push(
        `  Photo: ${f.photo ?? 'not linked'}, region: ${f.region.location}, source pass: ${f.sourcePass.passId} (${f.sourcePass.kind})`,
      )
    }
  }
  const faces = json.damage.faces
    .map((f) => `${FACE_NAME[f.face]}: ${FACE_LABEL[f.status]}`)
    .join('; ')
  lines.push(`Faces: ${faces}`)
  lines.push('')

  if (json.unresolved.length > 0) {
    lines.push('Not established:')
    for (const u of json.unresolved) lines.push(`- ${u.field}: ${u.reason}`)
  }
  return lines.join('\n') + '\n'
}

/** Download names for the three files, derived from the inspection id. */
export function exportFilenames(record: InspectionRecord): {
  json: string
  raw: string
  summary: string
} {
  const stem = `quay-sight-${record.id.replace(/[^A-Za-z0-9._-]+/g, '-')}`
  return {
    json: `${stem}-inspection.json`,
    raw: `${stem}-raw-responses.json`,
    summary: `${stem}-summary.txt`,
  }
}
