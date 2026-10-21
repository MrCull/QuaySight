// The placards, the marine pollutant mark and the limited quantity mark as Markings card rows (ticket #69).
// Pure. A placard is a hazard badge (below Likely a neutral one: only possible); certainty is the chip beside it.
import { placardInDoubt } from '../domain/keyFacts'
import { dgClassName } from '../domain/containerDetails'
import type { ReadingBox } from '../domain/enlargedCrop'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'
import { faceChipLabel } from '../domain/photoFace'
import type { MarkReading, PlacardReading } from '../domain/placards'
import type { MarkingRow } from './markingRows'

export interface PlacardRow extends MarkingRow {
  key: string
  /** Which placard of the record this row is (its `closeUp` source); null for the other rows. */
  placard: number | null
  /** Where this placard is in the photo; the card shows a crop beside it when usable. */
  box: ReadingBox | null
  /** Several photos: the 1-based photo the box belongs to. */
  photo: number | null
}

const CARGO_CAVEAT = 'Cargo status unknown without a declaration'
const NOT_CLEAR = 'Not clear from this photo'
const NOT_VISIBLE = 'Not visible in this photo'

function unText(unNumber: string | null): { text: string; partial: boolean } {
  if (unNumber === null) return { text: 'UN number not read', partial: false }
  return { text: `UN ${unNumber.replace(/\?/g, '·')}`, partial: unNumber.includes('?') }
}

/** `present`: how sure the run is that placards are there at all; its UN digits do not make one less of a placard. */
function placardRow(p: PlacardReading, index: number, present: CertaintyLabel): PlacardRow {
  const un = unText(p.unNumber)
  const name = p.dgClass === null ? null : dgClassName(p.dgClass)
  const caveat = [
    name ? `${name[0]!.toUpperCase()}${name.slice(1)}.` : null,
    p.faces && p.faces.length > 0
      ? `Seen on: ${p.faces.map((f) => faceChipLabel(f).toLowerCase()).join(', ')}.`
      : null,
    un.partial ? 'A digit of the UN number was not read.' : null,
    CARGO_CAVEAT,
  ]
    .filter(Boolean)
    .join(' ')
  return {
    key: `placard-${index}`,
    placard: index,
    label: `PLACARD ${index + 1}`,
    badge: {
      text: `${p.dgClass === null ? 'Class not read' : `Class ${p.dgClass}`}, ${un.text}`,
      caveat,
      hazard: !placardInDoubt(present),
      glyph: 'hazard',
    },
    absentText: NOT_CLEAR,
    certainty: p.certainty,
    box: p.box ?? null,
    photo: p.photo ?? null,
  }
}

function markRow(key: string, label: string, seen: string, mark: MarkReading): PlacardRow {
  return {
    key,
    placard: null,
    label,
    badge:
      mark.answer === 'yes' ? { text: seen, caveat: null, hazard: true, glyph: 'hazard' } : null,
    absentText: mark.answer === 'no' ? NOT_VISIBLE : NOT_CLEAR,
    certainty: mark.certainty,
    box: null,
    photo: null,
  }
}

/** One row per placard seen (or one saying none were), then one per mark; empty when the run did not ask. */
export function placardRows(record: InspectionRecord): PlacardRow[] {
  const reading = record.placards
  if (!reading) return []
  const headRow = (badge: PlacardRow['badge']): PlacardRow => ({
    key: 'placards',
    placard: null,
    label: 'PLACARDS',
    badge,
    absentText: NOT_CLEAR,
    certainty: reading.certainty,
    box: null,
    photo: null,
  })
  const head: PlacardRow[] =
    reading.answer === 'none'
      ? [
          headRow({
            text: 'No placards seen',
            caveat: 'Not evidence that the cargo is non-hazardous',
            hazard: false,
            glyph: 'eye',
          }),
        ]
      : reading.answer === 'unclear'
        ? [headRow(null)]
        : reading.placards.length === 0
          ? [
              headRow({
                text: 'Placard visible, class and UN number not read',
                caveat: CARGO_CAVEAT,
                hazard: !placardInDoubt(reading.certainty),
                glyph: 'hazard',
              }),
            ]
          : reading.placards.map((p, i) => placardRow(p, i, reading.certainty))
  return [
    ...head,
    markRow('marine', 'MARINE POLLUTANT', 'Marine pollutant mark visible', reading.marinePollutant),
    markRow(
      'limited',
      'LIMITED QUANTITY',
      'Limited quantity mark visible',
      reading.limitedQuantity,
    ),
  ]
}
