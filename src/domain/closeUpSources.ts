// Where each close-up on screen is cut from (ticket #85). Pure. A close-up is the area the numbered
// regions found (ticket #84: idCropRead.box, sealZoomRead.box, the ISO code's area, the regions' hazard
// areas), cut from the photo whose reading won. The photo comes from the reading ("photo", 1-based); only
// a reading that has none is taken to be photo 1. Without an area nothing is shown, never a guess.
// A seal read from a photo that is itself a close-up of the seal shows that whole photo: the photo is the
// close-up, and a grid area of it (a quarter of the photo each way) only cuts the seal in half.
import { usableIdBox, type IdBox } from './cropRead'
import { ENLARGED_MARGIN, type ReadingBox } from './enlargedCrop'
import type { InspectionRecord } from './inspection'
import type { FaceReading } from './photoFace'
import type { RegionBox } from './regionMarks'

/** What a close-up needs: the 1-based photo, the box on it, and the margin to keep around the box. */
export interface CloseUpSource {
  photo: number
  box: IdBox
  /** 0 for a found area, which is already generous; ENLARGED_MARGIN for a model's own tight box. */
  margin: number
  /** A whole photo: trim plain borders off it (black bars on a screenshot) before showing it. */
  trim?: boolean
}

/** The parts of a reading a close-up looks at. `area` is where a combined reading says its winning area is. */
interface Located {
  photo?: number
  area?: RegionBox | null
  box?: ReadingBox | null
}

const asBox = (area: RegionBox): IdBox => ({ ...area, confidence: 1 })

/** Several photos: a record's own area fields belong to one photo only, which the record does not name. */
const hasSeveralPhotos = (record: InspectionRecord) => (record.photos?.length ?? 0) > 1

function source(
  reading: Located,
  found: RegionBox | null | undefined,
  record: InspectionRecord,
): CloseUpSource | null {
  const photo = reading.photo ?? 1
  // With several photos a reading that names no photo cannot be tied to the record's areas or boxes.
  if (hasSeveralPhotos(record) && reading.photo === undefined && !reading.area) return null
  // An area the reading carries itself is on the reading's photo.
  const area = reading.area ?? found
  if (area) {
    const box = usableIdBox(asBox(area))
    if (box) return { photo, box, margin: 0 }
  }
  const own = usableIdBox(reading.box)
  return own ? { photo, box: own, margin: ENLARGED_MARGIN } : null
}

/**
 * Space around the ID's own box. Jev's ID box is tight and stops short of the first letters and the
 * check digit; 0.35 of its long side brings them back (docs/research/live-api-findings-2026-10-16.md).
 */
export const ID_BOX_MARGIN = 0.35
/**
 * Space around a found area for the ID or the ISO code: the margin the zoomed ID read crops with
 * (idCropRead.ts). The area is a grid cell and the painting often runs over its edge; with this margin
 * the close-up shows what the zoomed read read the ID from.
 */
export const AREA_MARGIN = 0.25

/** Whether a model's box is usable and lies inside a found area (with the area's margin): two locators agree. */
export function boxAgrees(
  box: (RegionBox & { confidence?: number }) | null | undefined,
  area: RegionBox | null | undefined,
): boolean {
  const usable = box ? usableIdBox({ confidence: 1, ...box }) : null
  if (!usable || !area) return false
  // The area itself stood in for a box (no model box): that is one locator, not two.
  const same = (['top', 'bottom', 'left', 'right'] as const).every((k) => usable[k] === area[k])
  if (same) return false
  const pad = AREA_MARGIN * Math.max(area.right - area.left, area.bottom - area.top)
  return (
    usable.left >= area.left - pad &&
    usable.right <= area.right + pad &&
    usable.top >= area.top - pad &&
    usable.bottom <= area.bottom + pad
  )
}

export function idCloseUp(record: InspectionRecord): CloseUpSource | null {
  const reading = record.containerId as (Located & { box?: IdBox | null }) | null | undefined
  if (!reading) return null
  const found = hasSeveralPhotos(record)
    ? null
    : (record.idCropRead?.box ?? record.regions?.found?.id?.box)
  const area = reading.area ?? found
  // The model's own box, where the found area agrees with it: the tightest frame of the ID.
  if (boxAgrees(reading.box, area)) {
    const photo = reading.photo ?? (hasSeveralPhotos(record) ? undefined : 1)
    if (photo !== undefined) return { photo, box: reading.box!, margin: ID_BOX_MARGIN }
  }
  const located = source(reading, found, record)
  return located && located.margin === 0 ? { ...located, margin: AREA_MARGIN } : located
}

/**
 * Space around a part of the photo that reading parts placed a reading in (tileSearch.ts). The part
 * already holds the whole reading with room to spare: only a little is added.
 */
export const TILE_MARGIN = 0.1

/** The whole of a photo, as a found area: nothing to enlarge, the photo is the close-up. */
const WHOLE_PHOTO: IdBox = { top: 0, left: 0, bottom: 1, right: 1, confidence: 1 }

/** What the survey says photo `photo` shows: the record's own face with one photo, its summary with several. */
function faceOf(record: InspectionRecord, photo: number): FaceReading | null {
  if (!hasSeveralPhotos(record)) return photo === 1 ? (record.photoFace ?? null) : null
  return record.photos?.find((p) => p.index === photo)?.face ?? null
}

export function sealCloseUp(record: InspectionRecord): CloseUpSource | null {
  const reading = record.seal
  if (!reading?.visible) return null
  const photo = reading.photo ?? (hasSeveralPhotos(record) ? undefined : 1)
  // The number itself, where reading parts of the photo placed it.
  const tile = usableIdBox(
    reading.tileBox ?? (hasSeveralPhotos(record) ? undefined : record.tileSearch?.seal),
  )
  if (photo !== undefined && tile) return { photo, box: tile, margin: TILE_MARGIN }
  // Read from a close-up of the seal: that photo is the close-up, whatever area was found on it.
  const face = photo === undefined ? null : faceOf(record, photo)
  if (photo !== undefined && face?.face === 'close-up' && face.closeUpSubject === 'seal') {
    return { photo, box: WHOLE_PHOTO, margin: 0, trim: true }
  }
  const found = hasSeveralPhotos(record)
    ? null
    : (record.sealZoomRead?.box ?? record.regions?.found?.seal?.box)
  return source(reading as Located, found, record)
}

/** How much of the smaller of two areas the other covers (0..1). */
function overlap(a: IdBox, b: IdBox): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  if (w <= 0 || h <= 0) return 0
  const area = (x: IdBox) => (x.right - x.left) * (x.bottom - x.top)
  return (w * h) / Math.min(area(a), area(b))
}

/**
 * The ISO size and type code, where the regions step found it. Nothing when the code was not read, and
 * nothing when the area is mostly the ID's own on the same photo: the code is painted under the ID, the
 * grid often puts both in one area, and the ID's close-up already shows it.
 */
export function isoCloseUp(record: InspectionRecord): CloseUpSource | null {
  const reading = record.details?.sizeCode
  if (reading?.state !== 'read' || !reading.code) return null
  // The code itself, where reading parts of the photo placed it: shown whatever the ID's close-up shows.
  const tile = hasSeveralPhotos(record)
    ? reading.tileBox && reading.photo
      ? { photo: reading.photo, box: reading.tileBox }
      : null
    : record.tileSearch?.iso
      ? { photo: 1, box: record.tileSearch.iso }
      : null
  const usableTile = tile ? usableIdBox(tile.box) : null
  if (tile && usableTile) return { photo: tile.photo, box: usableTile, margin: TILE_MARGIN }
  const found = hasSeveralPhotos(record) ? null : record.regions?.found?.iso?.box
  const iso = source(reading as Located, found, record)
  if (!iso) return null
  // Compared with the ID's found area, not its tighter box: the grid puts both in one area.
  const idReading = record.containerId as Located | null | undefined
  const idFound = hasSeveralPhotos(record)
    ? null
    : (record.idCropRead?.box ?? record.regions?.found?.id?.box)
  const idArea = idReading ? source(idReading, idFound, record) : null
  if (idArea && iso.photo === idArea.photo && overlap(iso.box, idArea.box) >= 0.5) return null
  // Several photos: the code is painted under the ID, so when the photo the ID's close-up is cut from
  // also read the code, that close-up shows it. A grid area on another photo is more often wrong than
  // right (a live RWTU run cut a long side's logo for it).
  const idPhoto = idCloseUp(record)?.photo
  const gave = record.photos?.find((p) => p.index === idPhoto)?.contributed?.details ?? []
  if (hasSeveralPhotos(record) && (gave.includes('sizeCode') || gave.includes('all'))) return null
  return { ...iso, margin: AREA_MARGIN }
}

/**
 * The close-up of the placard at `index`. The regions step lists hazard stickers in the order it was
 * asked, which is the survey's order: its areas are used only when it found as many as the survey did.
 */
export function placardCloseUp(record: InspectionRecord, index: number): CloseUpSource | null {
  const all = record.placards?.placards
  const placard = all?.[index]
  if (!all || !placard) return null
  const areas = hasSeveralPhotos(record) ? [] : (record.regions?.found?.hazards ?? [])
  const found = areas.length === all.length ? areas[index]?.box : null
  return source(placard as Located, found, record)
}
