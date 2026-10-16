// The survey's container details in the JSON and summary exports (ticket #32). Pure.
import {
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  dgClassName,
  type CheckReading,
  type ContainerDetailsReading,
  type EquipmentCheck,
  type MarkingCheck,
} from './containerDetails'
import type { ExportUnresolved, ExportValue } from './exports'

export interface DetailsExport {
  values: ExportValue[]
  unresolved: ExportUnresolved[]
  conflicts: string[]
  /** Lines for the plain-text summary. */
  summary: string[]
}

const EQUIPMENT_NAME: Record<EquipmentCheck, string> = {
  reefer: 'reefer',
  openTop: 'open top',
  tank: 'tank',
  flatRack: 'flat rack',
}
const MARKING_NAME: Record<MarkingCheck, string> = {
  superHeavy: 'Super Heavy',
  highContainer: 'high-container caution',
  overwidth: 'overwidth',
  fumigation: 'fumigation',
  marinePollutant: 'marine pollutant',
}

const SIZE_CODE_UNRESOLVED: Record<string, string> = {
  other: 'A code is printed, but it is not one of the common codes asked.',
  unreadable: 'A code is printed, but it could not be read.',
  'not-visible': 'Not visible in this photo.',
  unclear: 'Not clear from the photo.',
}

const DG_CAVEAT = 'Not evidence that the cargo is non-hazardous.'

/** Values, unresolved fields, conflicts and summary lines for the details a live survey read. */
export function detailsExport(details: ContainerDetailsReading): DetailsExport {
  const values: ExportValue[] = []
  const unresolved: ExportUnresolved[] = []
  const conflicts: string[] = []
  const summary: string[] = []

  const code = details.sizeCode
  if (code.state === 'read' && code.code) {
    values.push({
      field: 'sizeCode',
      category: 'printed',
      value: code.code,
      provenance: 'printed',
      certainty: code.certainty,
      uncertainty: code.alternative ? `Also possible: ${code.alternative}.` : null,
    })
    summary.push(`Size/type code (printed): ${code.code} - ${code.certainty}`)
    const decoded = code.decoded
    if (decoded) {
      for (const [field, value] of [
        ['length', decoded.length.label],
        ['height', decoded.height.label],
        ['width', decoded.width.label],
        ['type', decoded.type.label],
      ] as const) {
        values.push({
          field: `sizeCode.${field}`,
          category: 'derived',
          value,
          provenance: 'decoded',
          certainty: code.certainty,
          uncertainty: null,
        })
      }
      summary.push(`  Decoded: ${decoded.summary}`)
    } else {
      unresolved.push({
        field: 'sizeCode.meaning',
        category: 'unresolved',
        reason: 'Not a code this app decodes.',
      })
    }
  } else {
    unresolved.push({
      field: 'sizeCode',
      category: 'unresolved',
      reason: SIZE_CODE_UNRESOLVED[code.state] ?? 'Not read.',
    })
    summary.push(
      `Size/type code: ${(SIZE_CODE_UNRESOLVED[code.state] ?? 'Not read.').toLowerCase()}`,
    )
  }

  const check = (field: string, reading: CheckReading, absent: string) => {
    if (reading.answer === null) {
      unresolved.push({ field, category: 'unresolved', reason: 'Not clear from the photo.' })
      return
    }
    values.push({
      field,
      category: 'printed',
      value: reading.answer === 'yes' ? 'yes' : absent,
      provenance: reading.source,
      certainty: reading.certainty,
      uncertainty: reading.conflict,
    })
    if (reading.conflict) conflicts.push(reading.conflict)
  }
  for (const c of EQUIPMENT_CHECKS) check(`equipment.${c}`, details.equipment[c], 'no')
  for (const c of MARKING_CHECKS) check(`markings.${c}`, details.markings[c], 'not visible')
  summary.push(
    `Equipment: ${EQUIPMENT_CHECKS.map((c) => `${EQUIPMENT_NAME[c]} ${details.equipment[c].answer ?? "can't tell"}`).join(', ')}`,
  )

  const dg = details.dgPlacard
  if (dg.answer === null) {
    unresolved.push({
      field: 'dgPlacard',
      category: 'unresolved',
      reason: 'Not clear from the photo.',
    })
    summary.push("DG placard: can't tell")
  } else if (dg.answer === 'none') {
    values.push({
      field: 'dgPlacard',
      category: 'printed',
      value: 'no DG placard visible',
      provenance: 'observed',
      certainty: dg.certainty,
      uncertainty: DG_CAVEAT,
    })
    summary.push(`DG placard: no DG placard visible (${DG_CAVEAT.slice(0, -1).toLowerCase()})`)
  } else {
    const what =
      dg.dgClass === null
        ? 'placard visible, class not readable'
        : `class ${dg.dgClass} (${dgClassName(dg.dgClass)}), symbol: ${dg.symbol}`
    values.push({
      field: 'dgPlacard',
      category: 'printed',
      value: what,
      provenance: 'observed',
      certainty: dg.certainty,
      uncertainty: 'Cargo status unknown without a declaration.',
    })
    summary.push(
      `DG placard: ${what} - ${dg.certainty}; cargo status unknown without a declaration`,
    )
  }

  const seen = MARKING_CHECKS.filter((c) => details.markings[c].answer === 'yes')
  summary.push(
    `Markings seen: ${seen.length ? seen.map((c) => `${MARKING_NAME[c]} (${details.markings[c].certainty})`).join(', ') : 'none'}`,
  )
  return { values, unresolved, conflicts, summary }
}
