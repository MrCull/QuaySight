// The shapes of the exports (spec 8.3, 11.2; split out in ticket #54). Types only: exports.ts re-exports
// them, so importers keep their path.
import type {
  DamageComponent,
  DamageObservation,
  DamageFace,
  FaceCoverage,
  FaceStatus,
  FindingZone,
  ImageQuality,
  SeverityLevel,
  SideInference,
  ZoneVisibility,
} from './damage'
import type { ChosenLength, ContainerLengthFt } from './chosenLength'
import type { FaceReading } from './photoFace'
import type { CertaintyLabel, InspectionRecord, Provenance, RecheckRecord } from './inspection'
import type { DetailSource } from './containerDetails'
import type { IdCropReadRecord } from './cropRead'

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
  observations?: DamageObservation[]
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
  /** Every photo the damage was seen in (several photos); empty for a single photo. */
  photos: string[]
  /** True for damage on a face that could not be identified: listed, not placed on the drawing. */
  unidentifiedFace: boolean
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
  /** Every photo of the inspection (ticket #70): its face, and which readings of the result came from it. */
  photos: ExportPhoto[]
  /** True when two photos read different complete IDs that both pass the check digit; nothing was combined. */
  differentContainers: boolean
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

export interface ExportPhoto {
  /** 1-based, in the order given. */
  index: number
  photo: string
  /** The face the survey says the photo shows; null when it gave none. */
  face: FaceReading['face'] | null
  faceCertainty: FaceReading['certainty'] | null
  /** The long side, when the doors in the photo settled it. */
  side: 'left' | 'right' | null
  /** True for a photo that shows no container: nothing from it is used. */
  dropped: boolean
  /** The ID this photo gave on its own. */
  containerId: string | null
  /** Which readings of the result came from this photo. */
  readings: {
    containerId: { positions: number[] }
    details: string[]
    weights: string[]
    /** The numbers of the damages (finding ids) seen in the photo. */
    damage: number[]
  }
  /** The raw responses (rawResponses[].passId) this photo's requests gave. */
  passIds: string[]
}
