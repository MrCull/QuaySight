// The door end checked on its own. Pure.
//
// A photo taken at a corner shows the door end beside a long side. Asked of the whole photo, the door set
// has to find the door end before it can split it into the photo-left and photo-right leaves, and a live
// run on a torn door (CAI, doors at photo left beside the right side) put the damage on the wrong leaf.
// Once the numbered regions name the grid columns the door end spans (regionMarks.ts), that area is cut from
// the full-resolution photo and the door set is asked again of the crop alone. The crop's reading stands in
// for the whole-photo one (damageSets.ts withDamageReading): the leaves are halves of what it was sent.
import type { IdBox } from './cropRead'
import { facesShown, type FaceReading } from './photoFace'
import type { RegionsReading } from './regionMarks'

/** Margin around the door end's columns, as a fraction of the area's longer side (the photo's height). */
export const DOOR_END_MARGIN = 0.03

/**
 * The door end's area to cut out, or null when there is nothing to gain: the photo shows no door end, the
 * regions did not locate it, or it already spans the photo's whole width.
 */
export function doorEndBox(
  face: FaceReading | null | undefined,
  regions: RegionsReading | null | undefined,
): IdBox | null {
  if (!facesShown(face).includes('rear-doors')) return null
  const area = regions?.doorEnd
  if (!area) return null
  if (area.left <= 0 && area.right >= 1) return null
  return { ...area, confidence: 1 }
}

/** What the door-end crop did, for the export. Never shown. */
export interface DoorEndCropRecord {
  outcome: 'checked' | 'failed' | 'cancelled' | 'skipped-cap'
  /** The area the crop was cut around, as fractions of the photo. */
  box: IdBox
  crop: {
    x: number
    y: number
    width: number
    height: number
    sentWidth: number
    sentHeight: number
  } | null
  resolvedVersion: string | null
  reason: 'requests' | 'spend' | null
}

declare module './inspection' {
  interface InspectionRecord {
    /** The door set asked again of the door end alone, when one was started. Absent on other runs. */
    doorEndCrop?: DoorEndCropRecord
  }
}
