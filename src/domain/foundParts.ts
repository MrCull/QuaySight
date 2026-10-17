// What was found, topic by topic (spec 8.1, ticket #36; split out in ticket #54): reads each part of the
// inspection record the way that part's own card does and decides which statement and which caveats
// apply. Pure. The sentences themselves come from foundWording.ts. A part whose whole content is a caveat
// (an uncertain ID, a code that cannot be read) is a caveat only, so nothing is said twice.
import { idResultState, UNREAD, visibleAlternatives } from './certainty'
import {
  dgClassName,
  EQUIPMENT_CHECKS,
  MARKING_CHECKS,
  type EquipmentCheck,
} from './containerDetails'
import { faceStatus, sortFindings, type DamageFace } from './damage'
import type { CertaintyLabel, ContainerIdReading, InspectionRecord } from './inspection'
import type { Units } from './unitPreference'
import { payloadConflictText, printedPayloadHidden, type WeightRow, type WeightChecks } from './weights'
import * as words from './foundWording'

export interface FoundParts {
  statement?: string
  caveats: string[]
}

const WEAK: ReadonlySet<CertaintyLabel> = new Set(['Uncertain', "Can't tell"])
const isWeak = (certainty: CertaintyLabel) => WEAK.has(certainty)

export function idParts(reading: ContainerIdReading | null): FoundParts {
  if (!reading) return { caveats: [words.NO_ID_TEXT] }
  const value = words.groupedId(reading.value)
  const caveats: string[] = []
  const unread = reading.value.includes(UNREAD)
  if (idResultState(reading) === 'insufficient') return { caveats: [words.NO_ID_TEXT] }

  if (reading.observedCheckDigit !== null && reading.calculatedCheckDigit !== null) {
    if (!reading.checkDigitValid) {
      caveats.push(
        words.checkDigitMismatchText(reading.observedCheckDigit, reading.calculatedCheckDigit),
      )
    }
  }

  if (unread || isWeak(reading.certainty) || reading.certainty === 'Not seen') {
    const also = visibleAlternatives(reading).map(words.groupedId)
    return {
      caveats: [words.idUncertainText(reading.certainty, value, unread, also), ...caveats],
    }
  }
  return { statement: words.idStatementText(value, reading.certainty), caveats }
}

export function typeParts(record: InspectionRecord): FoundParts {
  const caveats: string[] = []
  for (const check of EQUIPMENT_CHECKS as readonly EquipmentCheck[]) {
    const conflict = record.details?.equipment[check].conflict
    if (conflict) caveats.push(conflict)
  }

  const decoded = record.sizeCode
  const reading = record.details?.sizeCode
  if (decoded) {
    if (isWeak(decoded.certainty)) {
      return {
        caveats: [
          words.decodedCodeWeakText(
            decoded.certainty,
            decoded.code,
            decoded.summary,
            reading?.alternative,
          ),
          ...caveats,
        ],
      }
    }
    return {
      statement: words.decodedCodeStatementText(decoded.code, decoded.summary, decoded.certainty),
      caveats,
    }
  }

  if (!reading) {
    // Mirrors the Container details card: a recorded sample that read weights but no code saw none.
    return record.weights
      ? { statement: words.NO_CODE_VISIBLE_TEXT, caveats }
      : { statement: words.CODE_NOT_ASSESSED_TEXT, caveats }
  }
  switch (reading.state) {
    case 'read':
      return isWeak(reading.certainty)
        ? { caveats: [words.undecodedCodeWeakText(reading.code, reading.certainty), ...caveats] }
        : { statement: words.undecodedCodeStatementText(reading.code, reading.certainty), caveats }
    case 'not-visible':
      return { statement: words.NO_CODE_VISIBLE_TEXT, caveats }
    case 'other':
      return { caveats: [words.otherCodeText(reading.certainty), ...caveats] }
    case 'unreadable':
      return { caveats: [words.unreadableCodeText(reading.certainty), ...caveats] }
    default:
      return { caveats: [words.unclearCodeText(reading.certainty), ...caveats] }
  }
}

export function weightParts(
  weights: WeightChecks | null,
  units: Units,
): { statement: string; caveats: string[] } {
  if (!weights) return { statement: words.WEIGHTS_NOT_ASSESSED_TEXT, caveats: [] }

  const caveats: string[] = []
  const conflict = weights.payloadConflict
    ? payloadConflictText(weights.payloadConflict, units)
    : weights.conflict
  // A conflict between the figures explains why they are Uncertain: it is said once, not row by row.
  const explainedByPayload = Boolean(conflict)

  function row(
    label: string,
    value: WeightRow | null,
    unread: 'not-visible' | 'unclear' | undefined,
    options: { note?: string; calculated?: boolean },
  ): string {
    if (!value) {
      if (options.calculated) return words.weightNotCalculatedText(label)
      const word: CertaintyLabel = unread === 'unclear' ? "Can't tell" : 'Not seen'
      if (word === "Can't tell") caveats.push(words.weightUnseenText(label, word))
      return words.weightUnseenText(label, word)
    }
    if (value.units === 'conflict') {
      caveats.push(words.unitsDisagreeText(label, value))
    } else if (isWeak(value.certainty) && !explainedByPayload) {
      caveats.push(words.weightWeakText(label, value.certainty))
    }
    return words.weightSentence(label, value, units, options.note, options.calculated)
  }

  const sentences = [
    row('Maximum gross', weights.maxGross, weights.unread?.maxGross, {
      note: words.MAX_GROSS_NOTE,
    }),
    row('Tare', weights.tare, weights.unread?.tare, {}),
    row('Payload', weights.payload, undefined, { note: words.PAYLOAD_NOTE, calculated: true }),
  ]
  if (conflict) caveats.unshift(conflict)
  // The printed payload's own two units can disagree, too.
  const printed = weights.printedPayload
  if (printed?.units === 'conflict' && !printedPayloadHidden(weights))
    caveats.push(words.unitsDisagreeText('Printed payload', printed))
  return { statement: sentences.join(' '), caveats }
}

export function markingParts(record: InspectionRecord): FoundParts {
  const details = record.details
  if (!details) return { statement: words.MARKINGS_NOT_ASSESSED_TEXT, caveats: [] }
  const caveats: string[] = []
  const checks = MARKING_CHECKS.map((check) => ({ check, reading: details.markings[check] }))

  const seen = checks.filter((c) => c.reading.answer === 'yes')
  const unknown = checks.filter((c) => c.reading.answer === null)
  const notSeen = checks.some((c) => c.reading.answer === 'no')
  for (const { check, reading } of seen) {
    if (isWeak(reading.certainty)) caveats.push(words.markingWeakText(check, reading.certainty))
    if (reading.conflict) caveats.push(reading.conflict)
  }
  if (unknown.length > 0) caveats.push(words.markingsUnknownText(unknown.map((c) => c.check)))

  const parts: string[] = []
  if (seen.length > 0) {
    parts.push(
      words.markingsSeenText(seen.map((c) => ({ check: c.check, certainty: c.reading.certainty }))),
    )
  } else if (notSeen) {
    parts.push(words.NO_MARKINGS_TEXT)
  }

  const dg = details.dgPlacard
  if (dg.answer === 'placard') {
    const name = dg.dgClass === null ? null : dgClassName(dg.dgClass)
    parts.push(words.dgPlacardSeenText(dg.dgClass, name, dg.certainty), words.DG_CARGO_UNKNOWN_TEXT)
    if (isWeak(dg.certainty)) caveats.push(words.dgWeakText(dg.certainty))
  } else if (dg.answer === 'none') {
    parts.push(words.DG_NONE_TEXT)
  } else {
    caveats.push(words.dgUnknownText(dg.certainty))
  }
  return { statement: parts.length > 0 ? parts.join(' ') : undefined, caveats }
}

const LISTED = 3
const FIXED_FACES = ['rear', 'front', 'left', 'right', 'roof'] as const

/** The faces an assessment looked at: from its photos, else from its findings. */
function facesOf(assessment: NonNullable<InspectionRecord['damage']>): DamageFace[] {
  return [
    ...new Set([
      ...assessment.photos.map((p) => p.face),
      ...(assessment.photos.length === 0 ? assessment.findings.map((f) => f.face) : []),
    ]),
  ]
}

export function damageParts(damage: InspectionRecord['damage']): {
  statement: string
  caveats: string[]
} {
  if (!damage) return { statement: words.DAMAGE_NOT_ASSESSED_TEXT, caveats: [] }
  if (damage.notAssessed) {
    return { statement: words.damageViewNotAssessedText(damage.notAssessed.reason), caveats: [] }
  }
  const face = words.facesText(facesOf(damage))
  const caveats: string[] = []
  if (damage.imageQuality === 'limited' || damage.imageQuality === 'poor') {
    caveats.push(words.photoQualityText(damage.imageQuality))
  }
  if (damage.coverage === 'partial') caveats.push(words.partVisibleText(face))
  else if (damage.coverage === 'most') caveats.push(words.notAllVisibleText(face))
  if (damage.zones?.some((z) => z.visibility === 'not-visible')) {
    caveats.push(words.partNotSeenText(face))
  }
  const sorted = sortFindings(damage.findings)
  for (const f of sorted) {
    if (f.certainty === 'Uncertain') caveats.push(words.findingUncertainText(f.title))
  }

  const n = sorted.length
  const sentences: string[] = []
  if (n === 0) {
    sentences.push(words.noDamageText(face))
  } else {
    const listed = sorted
      .slice(0, LISTED)
      .map((f) => words.findingText(f.title, f.severity, f.certainty))
    sentences.push(words.findingsText(n, listed, LISTED, face))
  }
  if ((damage.significantProbability ?? 0) >= 0.5) sentences.push(words.SIGNIFICANT_TEXT)
  if (FIXED_FACES.some((f) => faceStatus(damage, f) !== 'photographed')) {
    sentences.push(words.OTHER_FACES_TEXT)
  }
  return { statement: sentences.join(' '), caveats }
}
