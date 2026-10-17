// Exports for an inspection (spec 8.3, 11.2): consolidated JSON, raw provider responses and a
// shareable plain-text summary. Every builder takes only the InspectionRecord. No key, header or
// credential can reach an export because none is an input. The shapes are in exportTypes.ts and the
// summary's words in exportWording.ts (ticket #54); both are re-exported here. What the container ID,
// the details and the weights add comes from their question families (questionRegistry.ts, ticket #59).
import { labelsFor, recordedDemonstrationLabel } from './providers'
import { damageExport } from './damageExport'
import { chosenLength } from './chosenLength'
import type { InspectionRecord } from './inspection'
import { familyExports } from './questionRegistry'
import type {
  ExportCandidate,
  ExportPhoto,
  ExportUnresolved,
  ExportValue,
  InspectionExport,
  RawResponsesExport,
} from './exportTypes'
import {
  EXPORT_NOTICE,
  NOT_ESTABLISHED_HEAD,
  REPLAYED_LINE,
  SIGNIFICANT_LINE,
  SUMMARY_TITLE,
  conflictLine,
  damageNotAssessedLine,
  facesLine,
  findingCountLine,
  findingLines,
  inspectionLine,
  notEstablishedLine,
  providerLine,
} from './exportWording'

export * from './exportTypes'
export { EXPORT_NOTICE }

export const EXPORT_SCHEMA_VERSION = 1

/** Each photo with its face and the readings taken from it. One photo is listed too: everything came from it. */
function photoExports(record: InspectionRecord): ExportPhoto[] {
  if (record.photos) {
    return record.photos.map((p) => ({
      index: p.index,
      photo: p.name,
      face: p.face?.face ?? null,
      faceCertainty: p.face?.certainty ?? null,
      side: p.side,
      dropped: p.dropped,
      containerId: p.containerId?.value ?? null,
      readings: {
        containerId: { positions: p.contributed.containerId },
        details: p.contributed.details,
        weights: p.contributed.weights,
        damage: p.contributed.damage,
      },
      passIds: p.passIds,
    }))
  }
  if (!record.photo) return []
  const value = record.containerId?.value ?? null
  return [
    {
      index: 1,
      photo: record.photo.name,
      face: record.photoFace?.face ?? null,
      faceCertainty: record.photoFace?.certainty ?? null,
      side: null,
      dropped: false,
      containerId: value,
      readings: {
        containerId: {
          positions: [...(value ?? '')].flatMap((c, i) => (c === '?' ? [] : [i + 1])),
        },
        details: record.details ? ['all'] : [],
        weights: record.weights ? ['all'] : [],
        damage: (record.damage?.findings ?? []).map((f) => f.id),
      },
      passIds: record.rawResponses.map((r) => r.passId),
    },
  ]
}

export function buildInspectionExport(record: InspectionRecord): InspectionExport {
  const values: ExportValue[] = []
  const unresolved: ExportUnresolved[] = []
  const conflicts: string[] = []
  const candidates: ExportCandidate[] = []

  // What each question family adds, in registry order: the ID, the details, the weights.
  for (const family of familyExports(record)) {
    values.push(...family.values)
    unresolved.push(...family.unresolved)
    conflicts.push(...family.conflicts)
    candidates.push(...(family.candidates ?? []))
  }

  const { damage, unresolved: damageUnresolved } = damageExport(record)
  unresolved.push(...damageUnresolved)

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
    photos: photoExports(record),
    differentContainers: record.differentContainers ?? false,
    containerLength: chosenLength(record),
    damage,
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

export function buildSummaryText(record: InspectionRecord): string {
  const json = buildInspectionExport(record)
  const lines: string[] = [SUMMARY_TITLE, EXPORT_NOTICE, '']

  if (record.source === 'recorded') {
    lines.push(recordedDemonstrationLabel(record), REPLAYED_LINE, '')
  }
  lines.push(
    providerLine(json.inspection.providerName, record.model, record.resolvedVersion),
    inspectionLine(record.id),
    '',
  )

  for (const family of familyExports(record)) lines.push(...family.summary)
  for (const conflict of json.conflicts) lines.push(conflictLine(conflict))
  lines.push('')

  if (!json.damage.assessed) {
    lines.push(damageNotAssessedLine(json.damage.notAssessedReason))
  } else {
    lines.push(findingCountLine(json.damage.findings.length))
    if (json.damage.potentiallySignificant) lines.push(SIGNIFICANT_LINE)
    for (const f of json.damage.findings) lines.push(...findingLines(f))
  }
  lines.push(facesLine(json.damage.faces))
  lines.push('')

  if (json.unresolved.length > 0) {
    lines.push(NOT_ESTABLISHED_HEAD)
    for (const u of json.unresolved) lines.push(notEstablishedLine(u.field, u.reason))
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
