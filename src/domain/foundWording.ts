// The words of "What we found" (spec 8.1, ticket #36; split out in ticket #54). Pure: facts in, sentences
// out, with no record and no decisions about which sentence applies. foundParts.ts decides what was found
// and calls these; whatWeFound.ts assembles the summary. The words are the fixed ones: Confident, Likely,
// Uncertain, Can't tell, Not seen. A marking that was not seen is not called absent, a missing DG placard
// says nothing about the cargo, and a maximum is a rating, never the weight of the cargo.
import { UNREAD } from './certainty'
import type { DamageFace } from './damage'
import type { CertaintyLabel } from './inspection'
import type { StageId } from './runStages'
import type { Units } from './unitPreference'
import { toImperial, type WeightRow } from './weights'
import type { MarkingCheck } from './containerDetails'

const fmt = (value: number) => value.toLocaleString('en-GB')

export function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

// ---------------------------------------------------------------------------------------------------
// The container ID

/** A full container number as it is printed ("APHU 658684 7"); an unread position shows as a middle dot. */
export function groupedId(id: string): string {
  const marked = id.replace(/\s+/g, '').toUpperCase().split(UNREAD).join('·')
  return marked.length === 11
    ? `${marked.slice(0, 4)} ${marked.slice(4, 10)} ${marked.slice(10)}`
    : marked
}

export const NO_ID_TEXT = 'No container ID could be read from this photo.'

export const checkDigitMismatchText = (observed: number, calculated: number) =>
  `The printed check digit (${observed}) does not match the one calculated from the other ten characters (${calculated}).`

/** The ID is not settled: its certainty, the best reading, the unread positions and the alternatives. */
export function idUncertainText(
  certainty: CertaintyLabel,
  best: string,
  unread: boolean,
  also: string[],
): string {
  return [
    `The container ID is ${certainty}.`,
    `Best reading: ${best}.`,
    unread ? 'Some positions were not read, marked ·.' : null,
    also.length > 0 ? `Also possible: ${also.join(', ')}.` : null,
  ]
    .filter((s): s is string => s !== null)
    .join(' ')
}

export const idStatementText = (value: string, certainty: CertaintyLabel) =>
  `The container ID reads ${value} (${certainty}).`

// ---------------------------------------------------------------------------------------------------
// The container type

export const NO_CODE_VISIBLE_TEXT = 'No size and type code is visible in this photo (Not seen).'
export const CODE_NOT_ASSESSED_TEXT = 'The size and type code was not assessed in this inspection.'

export const decodedCodeWeakText = (
  certainty: CertaintyLabel,
  code: string,
  summary: string,
  alternative: string | null | undefined,
) =>
  `The size and type code is ${certainty}. Best reading: ${code}, ${summary}.${
    alternative ? ` Also possible: ${alternative}.` : ''
  }`

export const decodedCodeStatementText = (
  code: string,
  summary: string,
  certainty: CertaintyLabel,
) => `The size and type code is ${code}: ${summary} (${certainty}).`

export const undecodedCodeWeakText = (code: string | null, certainty: CertaintyLabel) =>
  `The size and type code reads ${code}, which this app does not decode, and is ${certainty}.`

export const undecodedCodeStatementText = (code: string | null, certainty: CertaintyLabel) =>
  `The size and type code reads ${code}, which this app does not decode (${certainty}).`

export const otherCodeText = (certainty: CertaintyLabel) =>
  `The size and type code is printed, but it is not one of the common codes (${certainty}).`

export const unreadableCodeText = (certainty: CertaintyLabel) =>
  `The size and type code is printed but cannot be read (${certainty}).`

export const unclearCodeText = (certainty: CertaintyLabel) =>
  `The size and type code is not clear from this photo (${certainty}).`

// ---------------------------------------------------------------------------------------------------
// The weights

export const WEIGHTS_NOT_ASSESSED_TEXT = 'The weights were not assessed in this inspection.'

export function weightText(row: WeightRow, units: Units): string {
  return units === 'metric'
    ? `${fmt(row.valueKg)} kg`
    : `${fmt(row.valueLb ?? Math.round(toImperial('weight', row.valueKg)))} lb`
}

export const weightNotCalculatedText = (label: string) =>
  `${label}: not calculated, it needs maximum gross and tare.`

export const weightUnseenText = (label: string, word: CertaintyLabel) => `${label}: ${word}.`

/** A weight whose kg and lb readings disagree, with both readings. */
export const unitsDisagreeText = (label: string, row: WeightRow) =>
  `${label}: kg and lb disagree, read as ${fmt(row.printed?.kg ?? row.valueKg)} kg and ${fmt(row.printed?.lb ?? row.valueLb ?? 0)} lb, which do not match after conversion.`

export const weightWeakText = (label: string, certainty: CertaintyLabel) =>
  `${label} is ${certainty}.`

export function weightSentence(
  label: string,
  row: WeightRow,
  units: Units,
  note: string | undefined,
  calculated: boolean | undefined,
): string {
  return `${label} ${weightText(row, units)}${note ?? ''}${calculated ? ', calculated' : ''} (${row.certainty}).`
}

export const MAX_GROSS_NOTE = ', a rating, not the cargo weight'
export const PAYLOAD_NOTE = ', the most it may carry'

// ---------------------------------------------------------------------------------------------------
// Markings and the DG placard

export const MARKING_SEEN: Record<MarkingCheck, string> = {
  superHeavy: 'SUPER HEAVY marking',
  highContainer: 'High-container caution',
  overwidth: 'Overwidth marking',
  fumigation: 'Fumigation warning',
  marinePollutant: 'Marine pollutant mark',
}
export const MARKING_NAME: Record<MarkingCheck, string> = {
  superHeavy: 'super heavy',
  highContainer: 'high container',
  overwidth: 'overwidth',
  fumigation: 'fumigation',
  marinePollutant: 'marine pollutant',
}

export const MARKINGS_NOT_ASSESSED_TEXT =
  'Markings and DG placards were not assessed in this inspection.'
export const NO_MARKINGS_TEXT = 'No operational markings seen.'

export const markingWeakText = (check: MarkingCheck, certainty: CertaintyLabel) =>
  `${MARKING_SEEN[check]} is ${certainty}.`

export const markingsUnknownText = (checks: MarkingCheck[]) =>
  `Could not tell whether these markings are present (Can't tell): ${checks
    .map((c) => MARKING_NAME[c])
    .join(', ')}.`

export const markingsSeenText = (seen: { check: MarkingCheck; certainty: CertaintyLabel }[]) =>
  `Seen: ${seen.map((c) => `${MARKING_SEEN[c.check]} (${c.certainty})`).join(', ')}.`

export const dgPlacardSeenText = (
  dgClass: number | null,
  className: string | null,
  certainty: CertaintyLabel,
) =>
  dgClass === null
    ? `A DG placard is visible, but its class cannot be read (${certainty}).`
    : `A DG placard, class ${dgClass}${className ? ` (${className})` : ''}, is visible (${certainty}).`

export const DG_CARGO_UNKNOWN_TEXT = 'The cargo status is unknown without a declaration.'
export const DG_NONE_TEXT = 'No DG placard visible, which says nothing about the cargo.'
export const dgWeakText = (certainty: CertaintyLabel) => `The DG placard is ${certainty}.`
export const dgUnknownText = (certainty: CertaintyLabel) =>
  `Could not tell whether a DG placard is visible (${certainty}).`

// ---------------------------------------------------------------------------------------------------
// Damage

export const FACE_NAME: Record<DamageFace, string> = {
  rear: 'door end',
  front: 'front end',
  left: 'left side',
  right: 'right side',
  roof: 'roof',
  'long-side': 'long side',
}

/** The faces an assessment looked at, in plain words; "photo" when it names none. */
export const facesText = (faces: DamageFace[]) =>
  faces.length === 0 ? 'photo' : joinWords(faces.map((f) => FACE_NAME[f]))

export const DAMAGE_NOT_ASSESSED_TEXT = 'Damage was not assessed in this inspection.'
export const damageViewNotAssessedText = (reason: string) =>
  `Damage not assessed for this view. ${reason}`

export const photoQualityText = (quality: string) =>
  `The photo quality is ${quality}, so damage could be missed.`
export const partVisibleText = (face: string) => `Only part of the ${face} is visible.`
export const notAllVisibleText = (face: string) => `Not all of the ${face} is visible.`
export const partNotSeenText = (face: string) => `Part of the ${face} could not be seen (Not seen).`
export const findingUncertainText = (title: string) => `${title} is Uncertain.`

export const findingText = (title: string, severity: string | null, certainty: CertaintyLabel) =>
  `${title}, ${severity ?? 'not rated'} (${certainty})`

export const noDamageText = (face: string) => `No suspected damage on the ${face}.`

export const findingsText = (n: number, listed: string[], listedMax: number, face: string) => {
  const more = n > listedMax ? [`and ${n - listedMax} more`] : []
  return `${n} suspected finding${n === 1 ? '' : 's'} on the ${face}: ${[...listed, ...more].join('; ')}.`
}

export const SIGNIFICANT_TEXT = 'Potentially significant damage, closer inspection advised.'
export const OTHER_FACES_TEXT = 'Other faces were not in the photo, so we have not seen them.'

// ---------------------------------------------------------------------------------------------------
// What a partial run is missing, and the headline

export type Unavailable = 'pending' | 'failed' | 'cancelled'

export const PART_NAME: Record<StageId, string> = {
  id: 'the container ID',
  details: 'container details',
  damage: 'damage',
}
export const GAP_LEAD: Record<StageId, Record<Unavailable, string>> = {
  id: { failed: 'Could not be read', cancelled: 'Not finished', pending: 'Still arriving' },
  details: { failed: 'Could not be read', cancelled: 'Not finished', pending: 'Still arriving' },
  damage: { failed: 'Could not be checked', cancelled: 'Not finished', pending: 'Still arriving' },
}

export const gapText = (lead: string, parts: string[]) => `${lead}: ${joinWords(parts)}.`

export const HEADLINE_UNCERTAIN = 'Some of what we found is uncertain'
export const HEADLINE_ARRIVING = 'Here is what has arrived so far'
export const HEADLINE_PARTIAL = 'Here is what arrived'
export const HEADLINE_DEFAULT = 'Here is what we found'
export const headlineIdAndType = (id: string, type: string) => `${id}: ${type}`
export const headlineTypeOnly = (type: string) => `A ${type}`
