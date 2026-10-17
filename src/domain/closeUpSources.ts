// Where each close-up on screen is cut from (ticket #85). Pure. A close-up is the area the numbered
// regions found (ticket #84: idCropRead.box, sealZoomRead.box, the regions' hazard areas), cut from the
// photo whose reading won. The photo comes from the reading ("photo", 1-based); only a reading that has
// none is taken to be photo 1. Without an area nothing is shown, never a guess.
import { usableIdBox, type IdBox } from './cropRead'
import { ENLARGED_MARGIN, type ReadingBox } from './enlargedCrop'
import type { InspectionRecord } from './inspection'
import type { RegionBox } from './regionMarks'

/** What a close-up needs: the 1-based photo, the box on it, and the margin to keep around the box. */
export interface CloseUpSource {
  photo: number
  box: IdBox
  /** 0 for a found area, which is already generous; ENLARGED_MARGIN for a model's own tight box. */
  margin: number
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

export function idCloseUp(record: InspectionRecord): CloseUpSource | null {
  const reading = record.containerId
  if (!reading) return null
  const found = hasSeveralPhotos(record)
    ? null
    : (record.idCropRead?.box ?? record.regions?.found?.id?.box)
  return source(reading as Located, found, record)
}

export function sealCloseUp(record: InspectionRecord): CloseUpSource | null {
  const reading = record.seal
  if (!reading?.visible) return null
  const found = hasSeveralPhotos(record)
    ? null
    : (record.sealZoomRead?.box ?? record.regions?.found?.seal?.box)
  return source(reading as Located, found, record)
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
