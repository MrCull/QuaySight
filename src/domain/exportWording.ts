// The words of the plain-text summary (spec 8.3; split out in ticket #54). Pure: each function takes the
// facts and returns the line, so the wording can change and be tested apart from the code that builds the
// export (exports.ts).
import type { InspectionRecord, RecheckRecord } from './inspection'
import type { ExportFindingLink, FaceExportStatus } from './exportTypes'

export const EXPORT_NOTICE =
  'Quay Sight proof of concept (POC), non-certified. Estimates for discussion only, not an invoice and not a certified inspection.'

export const SUMMARY_TITLE = 'Quay Sight - POC, non-certified'

export const REPLAYED_LINE = 'Replayed from a saved sample: no live API call and no charge.'

export const providerLine = (providerName: string, model: string, resolvedVersion: string) =>
  `Provider: ${providerName}, model ${model}, resolved version ${resolvedVersion}`

export const inspectionLine = (id: string) => `Inspection: ${id}`

export const idLine = (reading: NonNullable<InspectionRecord['containerId']>) =>
  `Container ID (printed): ${reading.value} - ${reading.certainty}`

export const checkDigitLine = (reading: NonNullable<InspectionRecord['containerId']>) =>
  reading.calculatedCheckDigit === null
    ? `  Check digit: observed ${reading.observedCheckDigit}, not calculated (ID incomplete)`
    : `  Check digit: observed ${reading.observedCheckDigit}, calculated ${reading.calculatedCheckDigit}, ${reading.checkDigitValid ? 'matches' : 'does not match'}`

export const alsoPossibleLine = (candidate: string) => `  Also possible: ${candidate}`

export function recheckLine(check: RecheckRecord): string {
  const cap = check.reason ? ` (stopped at the per-inspection ${check.reason} limit)` : ''
  return `Re-check of container ID (positions ${check.positions.join(', ')}): ${check.outcome}${cap}`
}

export const sizeCodeLine = (code: string, summary: string, certainty: string) =>
  `Size code (decoded): ${code} - ${summary} - ${certainty}`

export const conflictLine = (conflict: string) => `Conflict: ${conflict}`

export const damageNotAssessedLine = (reason: string | null) =>
  reason ? `Damage: not assessed for this view. ${reason}` : 'Damage: not assessed.'

export const findingCountLine = (n: number) => `Suspected damage: ${n} finding${n === 1 ? '' : 's'}`

export const SIGNIFICANT_LINE = 'Potentially significant damage, closer inspection advised.'

export function findingLines(f: ExportFindingLink): string[] {
  const severity = f.severity === 'not rated' ? 'severity not rated' : f.severity
  return [
    `- ${f.title} - ${f.certainty}, ${severity}`,
    `  Photo: ${f.photo ?? 'not linked'}, region: ${f.region.location}, source pass: ${f.sourcePass.passId} (${f.sourcePass.kind})`,
  ]
}

const FACE_LABEL: Record<FaceExportStatus, string> = {
  photographed: 'photographed',
  'side-unknown': 'long side photographed, side not established',
  'not-seen': 'Not seen',
  'not-assessed': 'not assessed',
}
const FACE_NAME: Record<'rear' | 'front' | 'left' | 'right' | 'roof', string> = {
  rear: 'Rear',
  front: 'Front',
  left: 'Left side',
  right: 'Right side',
  roof: 'Roof',
}

export const facesLine = (faces: { face: keyof typeof FACE_NAME; status: FaceExportStatus }[]) =>
  `Faces: ${faces.map((f) => `${FACE_NAME[f.face]}: ${FACE_LABEL[f.status]}`).join('; ')}`

export const NOT_ESTABLISHED_HEAD = 'Not established:'
export const notEstablishedLine = (field: string, reason: string) => `- ${field}: ${reason}`
