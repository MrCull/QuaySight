// How certain a container ID can be (spec #75, ticket #79). Pure.
//
// Confident for the ID needs all of: a passing check digit, an owner code on the full list, and either
// every character at least Likely in one read or two independent reads agreeing on all 11 characters.
// Otherwise a passing check digit caps the ID at Likely and a failing one at Uncertain. The check digit
// therefore gates the step up to Confident as well as lowering certainty.
import { CERTAINTY_LABELS, UNREAD } from './certainty'
import { checkDigitMatches } from './iso6346'
import type { CertaintyLabel } from './inspection'
import { isOnOwnerList } from './ownerCodes'

const ID_LENGTH = 11
const OWNER_CODE_LENGTH = 4

/** The weaker of the given certainty words. */
export function weakestOf(labels: readonly CertaintyLabel[]): CertaintyLabel {
  return (
    CERTAINTY_LABELS[Math.max(...labels.map((l) => CERTAINTY_LABELS.indexOf(l)))] ?? "Can't tell"
  )
}

/** A complete ID that passes the check digit. */
export function passesCheckDigit(id: string): boolean {
  return id.length === ID_LENGTH && !id.includes(UNREAD) && checkDigitMatches(id)
}

/** Shown beside an ID whose check digit passes but whose owner code is not on the list. */
export const NOT_COMMON_OWNER_TEXT = 'Not a common owner code'

/** Whether the ID's four-character owner code is on the full owner-code list. */
export function ownerIsListed(id: string): boolean {
  return isOnOwnerList(id.slice(0, OWNER_CODE_LENGTH))
}

export interface IdCertaintyInput {
  /** The ID as one character per position, UNREAD for a position not read. */
  id: string
  /** Certainty of each position (11 entries). */
  positionCertainty: readonly CertaintyLabel[]
  /** Two independent reads agreed on every one of the 11 characters. */
  corroborated?: boolean
  /** The most certain the photo as a whole allows (caveats such as "hard to read"). */
  ceiling?: CertaintyLabel
}

/** The certainty word for the whole ID. An incomplete ID has no check digit to apply and keeps its weakest position. */
export function idCertainty({
  id,
  positionCertainty,
  corroborated = false,
  ceiling = 'Confident',
}: IdCertaintyInput): CertaintyLabel {
  const weakest = weakestOf([...positionCertainty, ceiling])
  if (id.length !== ID_LENGTH || id.includes(UNREAD)) return weakest
  if (!checkDigitMatches(id)) return weakestOf([weakest, 'Uncertain'])
  const atLeastLikely = CERTAINTY_LABELS.indexOf(weakestOf(positionCertainty)) <= 1
  const earned = ownerIsListed(id) && (atLeastLikely || corroborated)
  return earned ? weakestOf(['Confident', ceiling]) : weakestOf([weakest, 'Likely'])
}
