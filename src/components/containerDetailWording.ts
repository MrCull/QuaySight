// The words of the Container details panel and the Markings card (ticket #54; split out of
// containerDetailRows.ts). Pure: facts in, strings out, with no row shapes and no decisions about which row
// to show, so the wording can change and be tested apart from the code that builds the rows.
import type { EquipmentCheck, MarkingCheck } from '../domain/containerDetails'
import type { SizeCodeState } from '../domain/containerDetails'
import type { Units } from '../domain/unitPreference'
import type { CapacityRow, WeightRow } from '../domain/weights'

export const NOT_VISIBLE = 'Not visible in this photo'
export const NOT_CLEAR = 'Not clear from this photo'

/** How a row's value came to be, as the panel names it, with the chip class that shows it. */
export const PRINTED = { provenance: 'Printed', provenanceClass: '' }
export const DECODED = { provenance: 'Decoded from ISO', provenanceClass: '' }
export const MODEL_SELECTED = { provenance: 'Model-selected', provenanceClass: 'qs-prov--model' }
export const SHAPE_ESTIMATED = {
  provenance: 'Estimated from shape',
  provenanceClass: 'qs-prov--model',
}
export const CALCULATED = { provenance: 'Calculated', provenanceClass: 'qs-prov--calculated' }

export const MAXIMUM_NOTE = 'A maximum rating, not the cargo weight.'
export const PAYLOAD_NOTE = 'The most the container may carry, not a cargo weight.'
export const PAYLOAD_NOT_CALCULATED = 'Not calculated: needs maximum gross and tare'
export const NOT_DECODED_TEXT = 'Not decoded: no size/type code read'
export const NOT_DECODED_CODE_NOTE = 'Not a code this app decodes.'
export const MAXIMUM_MINUS_TARE = 'Maximum gross minus tare.'

export const WEIGHTS_NOT_ASSESSED = 'Weights: not assessed in this inspection.'
export const EQUIPMENT_NOT_ASSESSED = 'Equipment checks: not assessed in this inspection.'

export const DECODED_LABELS = ['LENGTH', 'HEIGHT', 'WIDTH', 'TYPE'] as const

export const EQUIPMENT_LABEL: Record<EquipmentCheck, string> = {
  reefer: 'REEFER',
  openTop: 'OPEN TOP',
  tank: 'TANK',
  flatRack: 'FLAT RACK',
}

export const joinNotes = (...notes: (string | null)[]) => notes.filter(Boolean).join(' ') || null

export const fmt = (value: number) => value.toLocaleString('en-GB')

/** The size/type code row's note: what the code decodes to, then any other plausible code. */
export function sizeCodeNote(summary: string, alternative: string | null | undefined): string {
  return alternative ? `${summary} Also possible: ${alternative}.` : summary
}

/** What the ISO CODE row says when no code was read, by what the survey made of it. */
export function absentCodeText(state: Exclude<SizeCodeState, 'read'>): string {
  switch (state) {
    case 'not-visible':
      return NOT_VISIBLE
    case 'other':
      return 'Printed, but not one of the common codes'
    case 'unreadable':
      return 'Printed, but not clear enough to read'
    default:
      return NOT_CLEAR
  }
}

/** What the two units say about a weight, as evidence: agreement, a disagreement with both readings, or a conversion. */
export function unitEvidence(row: WeightRow, units: Units, converted: boolean): string | null {
  if (row.units === 'agree') return 'kg and lb agree.'
  if (row.units === 'conflict') {
    return `kg and lb disagree: read as ${fmt(row.printed?.kg ?? row.valueKg)} kg and ${fmt(row.printed?.lb ?? row.valueLb ?? 0)} lb, which do not match after conversion.`
  }
  if (converted) {
    return units === 'imperial'
      ? 'Converted from kg (1 kg = 2.20462 lb): the lb figure was not read.'
      : 'Converted from lb (1 kg = 2.20462 lb): the kg figure was not read.'
  }
  return null
}

/** What the two capacity units say, as evidence. `converted` is whether the shown unit was not read. */
export function capacityEvidence(capacity: CapacityRow, metric: boolean, converted: boolean) {
  if (capacity.units === 'agree') return 'm³ and cu ft agree.'
  if (capacity.units === 'conflict') {
    return `m³ and cu ft disagree: read as ${fmt(capacity.valueM3)} m³ and ${fmt(capacity.valueCuFt)} cu ft, which do not match after conversion.`
  }
  return converted
    ? `Converted from ${metric ? 'cu ft' : 'm³'} (1 m³ = 35.3147 cu ft): the ${metric ? 'm³' : 'cu ft'} figure was not read.`
    : null
}

export const capacityText = (capacity: CapacityRow, metric: boolean) =>
  metric ? `${fmt(capacity.valueM3)} m³` : `${fmt(capacity.valueCuFt)} cu ft`

/** The calculated payload is no better than the weights it comes from: say which of them is the reason. */
export function inheritedDoubtText(doubtful: string[]): string | null {
  if (doubtful.length === 0) return null
  const many = doubtful.length > 1
  return `Uncertain because ${doubtful.join(' and ')} ${many ? 'are' : 'is'}: ${
    many ? 'their' : 'its'
  } kg and lb readings disagree.`
}

export const yesNoText = (answer: 'yes' | 'no') => (answer === 'yes' ? 'Yes' : 'No')

// ---------------------------------------------------------------------------------------------------
// Markings

export const MARKINGS: { check: MarkingCheck; label: string; seen: string; hazard: boolean }[] = [
  { check: 'superHeavy', label: 'SUPER HEAVY', seen: 'SUPER HEAVY marking', hazard: true },
  {
    check: 'highContainer',
    label: 'HIGH CONTAINER',
    seen: 'High-container caution',
    hazard: false,
  },
  { check: 'overwidth', label: 'OVERWIDTH', seen: 'Overwidth marking', hazard: true },
  { check: 'fumigation', label: 'FUMIGATION', seen: 'Fumigation warning', hazard: true },
  {
    check: 'marinePollutant',
    label: 'MARINE POLLUTANT',
    seen: 'Marine pollutant mark',
    hazard: true,
  },
]

/** The DG placard badge's text: its class and name, or that the class cannot be read. */
export const dgSeenText = (dgClass: number | null, className: string | null) =>
  dgClass === null
    ? 'DG placard visible, class not readable'
    : `DG placard, class ${dgClass} (${className}) visible`

export const dgSeenCaveat = (symbol: string | null) =>
  `${symbol ? `Symbol: ${symbol}. ` : ''}Cargo status unknown without a declaration`

export const DG_NONE_TEXT = 'No DG placard visible'
export const DG_NONE_CAVEAT = 'Not evidence that the cargo is non-hazardous'
