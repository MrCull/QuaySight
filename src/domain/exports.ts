// Exports for an inspection (spec 8.3, 11.2): consolidated JSON, raw provider responses and a
// shareable plain-text summary. Every builder takes only the InspectionRecord. No key, header or
// credential can reach an export because none is an input.
import { getProvider } from './providers'
import { faceStatus, type DamageFace, type FaceStatus, type FindingZone } from './damage'
import type { CertaintyLabel, InspectionRecord, Provenance, RecheckRecord } from './inspection'

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
  unit?: 'kg'
  provenance: Provenance
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
  severity: string
  certainty: string
  types: string[]
  region: { location: string; zone: FindingZone }
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
  damage: {
    assessed: boolean
    photos: { photo: string; face: DamageFace }[]
    faces: { face: 'rear' | 'front' | 'left' | 'right' | 'roof'; status: FaceExportStatus }[]
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

  if (record.sizeCode) {
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

  const weights = record.weights
  if (weights?.maxGross) {
    values.push({
      field: 'maxGross',
      category: 'printed',
      value: weights.maxGross.valueKg,
      unit: 'kg',
      provenance: 'printed',
      certainty: weights.maxGross.certainty,
      uncertainty: 'Maximum gross is a rating, not a measured load.',
    })
  } else {
    unresolved.push({ field: 'maxGross', category: 'unresolved', reason: 'Not read.' })
  }
  if (weights?.tare) {
    values.push({
      field: 'tare',
      category: 'printed',
      value: weights.tare.valueKg,
      unit: 'kg',
      provenance: 'printed',
      certainty: weights.tare.certainty,
      uncertainty: null,
    })
  } else {
    unresolved.push({ field: 'tare', category: 'unresolved', reason: 'Not read.' })
  }
  if (weights?.payload) {
    values.push({
      field: 'payload',
      category: 'derived',
      value: weights.payload.valueKg,
      unit: 'kg',
      provenance: 'calculated',
      certainty: weights.payload.certainty,
      uncertainty: 'Maximum gross minus tare. Not a cargo weight.',
    })
  } else {
    unresolved.push({
      field: 'payload',
      category: 'unresolved',
      reason: 'Needs both maximum gross and tare.',
    })
  }
  if (weights?.conflict) conflicts.push(weights.conflict)

  const assessment = record.damage
  if (!assessment)
    unresolved.push({ field: 'damage', category: 'unresolved', reason: 'Not assessed.' })

  return {
    schemaVersion: record.schemaVersion,
    notice: EXPORT_NOTICE,
    inspection: {
      id: record.id,
      provider: record.provider,
      providerName: getProvider(record.provider).name,
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
    damage: {
      assessed: assessment !== null,
      photos: assessment?.photos ?? [],
      faces: FIXED_FACES.map((face) => ({
        face,
        status: assessment ? faceStatus(assessment, face) : 'not-assessed',
      })),
      findings: (assessment?.findings ?? []).map((f) => ({
        findingId: f.id,
        title: f.title,
        face: f.face,
        severity: f.severity,
        certainty: f.certainty,
        types: f.types.map((t) => t.code),
        region: { location: f.location, zone: f.zone },
        photo: assessment?.photos.find((p) => p.face === f.face)?.photo ?? null,
        sourcePass: { passId: record.id, kind: sourcePassKind(record) },
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

function formatKg(value: number): string {
  return `${value.toLocaleString('en-GB')} kg`
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
      `Recorded demonstration: ${json.inspection.providerName} / ${record.model}`,
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
  if (record.sizeCode) {
    lines.push(
      `Size code (decoded): ${record.sizeCode.code} - ${record.sizeCode.summary} - ${record.sizeCode.certainty}`,
    )
  }
  const weights = record.weights
  if (weights?.maxGross) {
    lines.push(
      `Max gross (printed): ${formatKg(weights.maxGross.valueKg)} - a rating, not a measured load`,
    )
  }
  if (weights?.tare) lines.push(`Tare (printed): ${formatKg(weights.tare.valueKg)}`)
  if (weights?.payload) {
    lines.push(`Payload (calculated): ${formatKg(weights.payload.valueKg)}`)
  }
  for (const conflict of json.conflicts) lines.push(`Conflict: ${conflict}`)
  lines.push('')

  if (!json.damage.assessed) {
    lines.push('Damage: not assessed.')
  } else {
    const n = json.damage.findings.length
    lines.push(`Suspected damage: ${n} finding${n === 1 ? '' : 's'}`)
    for (const f of json.damage.findings) {
      lines.push(`- ${f.title} - ${f.certainty}, ${f.severity}`)
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
