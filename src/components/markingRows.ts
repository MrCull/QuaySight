// What the Markings card shows, row by row, from the record. Pure (ticket #54: split out of
// containerDetailRows.ts; its words are in containerDetailWording.ts).
import { placardInDoubt } from '../domain/keyFacts'
import { dgClassName } from '../domain/containerDetails'
import type { CertaintyLabel, InspectionRecord } from '../domain/inspection'
import {
  DG_NONE_CAVEAT,
  DG_NONE_TEXT,
  MARKINGS,
  NOT_CLEAR,
  NOT_VISIBLE,
  dgSeenCaveat,
  dgSeenText,
} from './containerDetailWording'

export interface MarkingBadge {
  text: string
  caveat: string | null
  /** The hazard diamond: only for DG placards and safety markings (MarkingBadge README). */
  hazard: boolean
  /** hazard: the diamond. check: a neutral marking seen. eye: an absence stated ("No DG placard visible"). */
  glyph: 'hazard' | 'check' | 'eye'
}

export interface MarkingRow {
  label: string
  /** The badge for a marking that was seen (or for "No DG placard visible"); null otherwise. */
  badge: MarkingBadge | null
  /** Shown when there is no badge. */
  absentText: string
  certainty: CertaintyLabel
}

const ORDER: readonly CertaintyLabel[] = [
  'Confident',
  'Likely',
  'Uncertain',
  "Can't tell",
  'Not seen',
]

/**
 * The DG placard and each operational marking, one row each; null when the run did not check them.
 * Markings seen come first, most certain first; then those not settled, then those not seen.
 */
export function markingRows(record: InspectionRecord): MarkingRow[] | null {
  const details = record.details
  if (!details) return null
  // A run that read the placards (ticket #69) shows them in their own rows, which replace these two.
  const placardsRead = record.placards !== undefined
  const dg = details.dgPlacard
  const className = dg.dgClass === null ? null : dgClassName(dg.dgClass)
  const dgRow: MarkingRow = {
    label: 'DG PLACARD',
    badge:
      dg.answer === 'placard'
        ? {
            text: dgSeenText(dg.dgClass, className),
            caveat: dgSeenCaveat(dg.symbol),
            // Below Likely the placard is only possible: no hazard colour.
            hazard: !placardInDoubt(dg.certainty),
            glyph: 'hazard',
          }
        : dg.answer === 'none'
          ? { text: DG_NONE_TEXT, caveat: DG_NONE_CAVEAT, hazard: false, glyph: 'eye' }
          : null,
    absentText: NOT_CLEAR,
    certainty: dg.certainty,
  }
  const rows: MarkingRow[] = [
    ...(placardsRead ? [] : [dgRow]),
    ...MARKINGS.filter(({ check }) => !(placardsRead && check === 'marinePollutant')).map(
      ({ check, label, seen, hazard }): MarkingRow => {
        const reading = details.markings[check]
        return {
          label,
          badge:
            reading.answer === 'yes'
              ? { text: seen, caveat: reading.conflict, hazard, glyph: hazard ? 'hazard' : 'check' }
              : null,
          absentText: reading.answer === 'no' ? NOT_VISIBLE : NOT_CLEAR,
          certainty: reading.certainty,
        }
      },
    ),
  ]
  const seen = (row: MarkingRow) =>
    row.badge !== null && row.certainty !== 'Not seen' ? 0 : row.certainty === 'Not seen' ? 2 : 1
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        seen(a.row) - seen(b.row) ||
        ORDER.indexOf(a.row.certainty) - ORDER.indexOf(b.row.certainty) ||
        a.index - b.index,
    )
    .map(({ row }) => row)
}
