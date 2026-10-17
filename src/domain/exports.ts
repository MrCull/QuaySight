// Exports for an inspection (spec 8.3, 11.2): consolidated JSON, raw provider responses and a
// shareable plain-text summary. Every builder takes only the InspectionRecord. No key, header or
// credential can reach an export because none is an input. The shapes are in exportTypes.ts and the
// summary's words in exportWording.ts (ticket #54); both are re-exported here.
import { labelsFor, recordedDemonstrationLabel } from './providers'
import { damageExport } from './damageExport'
import { chosenLength } from './chosenLength'
import type { InspectionRecord } from './inspection'
import { idResultState } from './certainty'
import { detailsExport } from './detailsExport'
import { weightsExport } from './weightsExport'
import type {
  ExportCandidate,
  ExportUnresolved,
  ExportValue,
  InspectionExport,
  RawResponsesExport,
} from './exportTypes'
import {
  EXPORT_NOTICE,
  idNotReadableLine,
  NOT_ESTABLISHED_HEAD,
  REPLAYED_LINE,
  SIGNIFICANT_LINE,
  SUMMARY_TITLE,
  alsoPossibleLine,
  checkDigitLine,
  conflictLine,
  damageNotAssessedLine,
  facesLine,
  findingCountLine,
  findingLines,
  idLine,
  inspectionLine,
  notEstablishedLine,
  providerLine,
  recheckLine,
  sizeCodeLine,
} from './exportWording'

export * from './exportTypes'
export { EXPORT_NOTICE }

export const EXPORT_SCHEMA_VERSION = 1

function unreadPositions(value: string): number[] {
  return [...value].flatMap((ch, i) => (ch === '?' ? [i] : []))
}

/** The ID reading, or null when too little of it was read to show (it is then exported as not read). */
function readableId(record: InspectionRecord) {
  const reading = record.containerId
  return reading && idResultState(reading) !== 'insufficient' ? reading : null
}

export function buildInspectionExport(record: InspectionRecord): InspectionExport {
  const values: ExportValue[] = []
  const unresolved: ExportUnresolved[] = []
  const conflicts: string[] = []
  const reading = readableId(record)

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

  const reading = readableId(record)
  if (reading) {
    lines.push(idLine(reading))
    if (reading.observedCheckDigit !== null) lines.push(checkDigitLine(reading))
    for (const alt of json.candidates) lines.push(alsoPossibleLine(alt.value))
  } else if (record.containerId) {
    lines.push(idNotReadableLine)
  }
  for (const check of json.rechecks) lines.push(recheckLine(check))
  if (record.details) {
    lines.push(...detailsExport(record.details).summary)
  } else if (record.sizeCode) {
    lines.push(
      sizeCodeLine(record.sizeCode.code, record.sizeCode.summary, record.sizeCode.certainty),
    )
  }
  lines.push(...weightsExport(record.weights).summary)
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
