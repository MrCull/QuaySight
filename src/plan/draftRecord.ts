import {
  INSPECTION_SCHEMA_VERSION,
  type InspectionRecord,
  type PhotoRef,
  type ProviderId,
} from '../domain/inspection'

/**
 * The record a run starts from, before any request has answered: nothing read, nothing found. Each answer is
 * folded into it as it lands (`foldSettled`), live or replayed from a recording.
 */
export function draftRecord(fields: {
  id: string
  provider: ProviderId
  model: string
  source: InspectionRecord['source']
  photo: PhotoRef | null
}): InspectionRecord {
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    id: fields.id,
    provider: fields.provider,
    model: fields.model,
    resolvedVersion: '',
    rawResponses: [],
    source: fields.source,
    status: 'running',
    photo: fields.photo,
    containerId: null,
    damage: null,
    sizeCode: null,
    weights: null,
    rechecks: [],
  }
}
