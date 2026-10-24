// How a container ID reading is shown character by character (design-system ContainerId). Pure: the
// ContainerId card and the readings ledger's ID row draw from the same cells, tags and spoken label.
import type { CertaintyLabel, ContainerIdReading } from '../domain/inspection'
import { UNREAD } from '../domain/certainty'
import { NOT_COMMON_OWNER_TEXT, ownerIsListed } from '../domain/idConfidence'

/** Zero-based position of the check digit: the eleventh of the eleven ID characters. */
export const CHECK_DIGIT_INDEX = 10

/** The data-c state of a character: none for Confident. */
export type CharState = 'likely' | 'uncertain' | 'unknown' | undefined

export interface IdCell {
  ch: string
  index: number
  notRead: boolean
  state: CharState
}

export function charState(level: CertaintyLabel): CharState {
  if (level === 'Confident') return undefined
  if (level === 'Likely') return 'likely'
  if (level === 'Uncertain') return 'uncertain'
  return 'unknown'
}

const UNREAD_CELL: IdCell = { ch: '·', index: CHECK_DIGIT_INDEX, notRead: true, state: 'unknown' }

/** The eleven cells. Positions the photo did not show are marked with a dot and never filled in. */
export function idCells(reading: ContainerIdReading): IdCell[] {
  const value = reading.value.replace(/\s+/g, '').toUpperCase().padEnd(11, UNREAD)
  return value
    .slice(0, 11)
    .split('')
    .map((ch, index): IdCell => {
      const level = reading.positionCertainty?.[index] ?? reading.certainty
      const notRead = ch === UNREAD
      return {
        ch: notRead ? '·' : ch,
        index,
        notRead,
        state: notRead ? 'unknown' : charState(level),
      }
    })
}

/** Laid out as printed: owner code and category (4), the serial in 3 and 3, then the check digit. */
export function idLayout(cells: IdCell[]): { groups: IdCell[][]; check: IdCell } {
  return {
    groups: [cells.slice(0, 4), cells.slice(4, 7), cells.slice(7, 10)],
    check: cells[CHECK_DIGIT_INDEX] ?? UNREAD_CELL,
  }
}

export interface IdTag {
  text: string
  /** The ProvenanceTag modifier, or '' for the plain tag. */
  modifier: '' | 'qs-prov--calculated' | 'qs-prov--manifest'
}

/** The provenance tags under an ID: where it came from, the check digit result and the owner-code note. */
export function idTags(reading: ContainerIdReading, cells: IdCell[]): IdTag[] {
  const incomplete = cells.some((c) => c.notRead)
  const tags: IdTag[] = []
  if (reading.provenance === 'manifest') {
    tags.push({ text: 'Matched against manifest', modifier: 'qs-prov--manifest' })
  } else {
    tags.push({ text: reading.manifestChecked ? 'Read from image' : 'Printed', modifier: '' })
  }
  if (incomplete) {
    tags.push({ text: 'ID incomplete, check digit not checked', modifier: '' })
  } else {
    tags.push(
      reading.checkDigitValid
        ? { text: 'Check digit valid', modifier: 'qs-prov--calculated' }
        : { text: 'Check digit does not match', modifier: '' },
    )
  }
  // The check digit passes but the owner code is not on the list: that is why the ID is Likely at best.
  if (!incomplete && reading.checkDigitValid && !ownerIsListed(cells.map((c) => c.ch).join(''))) {
    tags.push({ text: NOT_COMMON_OWNER_TEXT, modifier: '' })
  }
  if (
    !incomplete &&
    !reading.checkDigitValid &&
    reading.observedCheckDigit !== null &&
    reading.calculatedCheckDigit !== null
  ) {
    tags.push({
      text: `Calculated ${reading.calculatedCheckDigit}`,
      modifier: 'qs-prov--calculated',
    })
  }
  return tags
}

/** The ID spelt out for a screen reader, with each doubtful character and the check-digit result. */
export function idSpelled(reading: ContainerIdReading, cells: IdCell[]): string {
  const incomplete = cells.some((c) => c.notRead)
  const spelledChars = cells.map((c) => {
    if (c.notRead) return `position ${c.index + 1} not read`
    if (c.state === 'uncertain' || c.state === 'unknown' || c.state === 'likely') {
      return `${c.ch} (${c.state === 'likely' ? 'likely' : 'uncertain'})`
    }
    return c.ch
  })
  const body = spelledChars.slice(0, 10).join(' ')
  const check = cells[CHECK_DIGIT_INDEX] ?? UNREAD_CELL
  const checkPart = check.notRead ? 'check digit not read' : `check digit ${check.ch}`
  const note =
    incomplete || reading.calculatedCheckDigit === null
      ? 'check digit not checked, ID incomplete'
      : reading.checkDigitValid
        ? 'check digit valid'
        : `check digit does not match, calculated ${reading.calculatedCheckDigit}`
  return `${body}, ${checkPart}, ${note}`
}
