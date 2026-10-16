import { applyMargin, certaintyOfProbability, UNREAD } from './certainty'
import { buildContainerIdReading } from './containerId'
import type { CertaintyLabel, ContainerIdReading } from './inspection'
import { questionSet, type SharedAnswer, type SharedQuestionSet } from './questionSet'

// Manifest retry (spec 3.2). Pasted entries are used as supplied: no ISO 6346 or check-digit checks.
// Live, the check is one call on the same provider and model with the photo as sent (spec 8.5); demo
// mode replays each sample's own recorded check (demoSamples.ts). Nothing here replays a fixture.

/** Limit for one paste, for this POC (spec 3.2). */
export const MANIFEST_LIMIT = 500

export interface ParsedManifest {
  /** Unique entries in the order pasted, spelled as pasted (first occurrence wins). */
  ids: string[]
  /** Entries ignored because an earlier entry matched, ignoring case. */
  duplicates: number
}

/** Every run of whitespace, comma or semicolon separates entries (lines, CSV, TSV, ;-lists, spaces). */
export function parseManifest(text: string): ParsedManifest {
  const seen = new Set<string>()
  const ids: string[] = []
  let duplicates = 0
  for (const raw of text.split(/[\s,;]+/)) {
    const entry = raw.trim()
    if (!entry) continue
    const key = entry.toUpperCase()
    if (seen.has(key)) {
      duplicates += 1
      continue
    }
    seen.add(key)
    ids.push(entry)
  }
  return { ids, duplicates }
}

export class ManifestRetryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestRetryError'
  }
}

/**
 * Whether the manifest check is offered for a reading: the ID was not identified at all, or the
 * first attempt left positions unread (spec 3.2).
 */
export function needsManifest(reading: ContainerIdReading | null): boolean {
  return reading === null || reading.value.includes(UNREAD)
}

/** The ledger's plain-language purpose for the live manifest check (spec 8.5). */
export const MANIFEST_PURPOSE = 'Checking against manifest'

/** The option every manifest question offers besides the pasted entries (spec 12.1). */
export const MANIFEST_NOT_LISTED = 'other_not_listed'

/**
 * Options per choice question, "not listed" included: TypeSafe documents up to 255 for System One
 * (docs/research/jev-guide-recheck.md). A longer paste is split over several questions in the same
 * call, each saying it holds only part of the manifest (spec 3.2: never pretend all were in one question).
 */
export const MANIFEST_OPTIONS_PER_QUESTION = 255

/** The text sent ahead of the photo for the manifest check. Names no expected ID. */
export const MANIFEST_STATE_INSTRUCTIONS =
  'Freight container photo. Judge only what is visible in the photo. Each question lists container numbers from a manifest the presenter supplied; the container in the photo may not be on it.'

const NOT_LISTED_DESCRIPTION =
  'None of these: the number printed on the container is not in this list, or cannot be read well enough to tell.'

/** Route-neutral choice question: each route translates it into its own wire format. */
export interface ManifestQuestion {
  name: string
  instructions: string
  /** The pasted entries, spelled as pasted, then MANIFEST_NOT_LISTED. */
  options: { value: string; description: string }[]
}

/**
 * The choice questions for one manifest check: the entries in order, in parts of at most
 * MANIFEST_OPTIONS_PER_QUESTION options, each with "not listed".
 */
export function buildManifestQuestions(entries: string[]): ManifestQuestion[] {
  const listed = entries.filter((e) => e.toLowerCase() !== MANIFEST_NOT_LISTED)
  const perPart = MANIFEST_OPTIONS_PER_QUESTION - 1
  const parts: string[][] = []
  for (let i = 0; i < listed.length; i += perPart) parts.push(listed.slice(i, i + perPart))
  return parts.map((part, index) => {
    const scope =
      parts.length === 1
        ? 'these container numbers from the manifest'
        : `these container numbers, part ${index + 1} of ${parts.length} of the manifest (the number may be in another part),`
    return {
      name: `manifest_${index + 1}`,
      instructions: `Which of ${scope} is the one printed on this container? Choose ${MANIFEST_NOT_LISTED} if it is not in this list or cannot be read well enough to tell. Never choose a number that only nearly matches.`,
      options: [
        ...part.map((value) => ({ value, description: value })),
        { value: MANIFEST_NOT_LISTED, description: NOT_LISTED_DESCRIPTION },
      ],
    }
  })
}

/** The manifest check in the shared question format: the text ahead of the photo, then one choice per part. */
export function manifestQuestionSet(questions: ManifestQuestion[]): SharedQuestionSet {
  return questionSet(
    MANIFEST_STATE_INSTRUCTIONS,
    questions.map((q) => ({
      type: 'choice',
      name: q.name,
      instructions: q.instructions,
      choices: q.options,
    })),
  )
}

/** The choice answers of a manifest-check reply, mapped by meaning, as readManifestAnswers takes them. */
export function manifestAnswersOf(
  answers: Record<string, SharedAnswer>,
): Record<string, ManifestChoiceAnswer> {
  const out: Record<string, ManifestChoiceAnswer> = {}
  for (const [name, answer] of Object.entries(answers)) {
    if (answer.type === 'choice') {
      out[name] = { choice: answer.value, probabilities: answer.probabilities }
    }
  }
  return out
}

/** One choice answer, translated from either route's shape: probabilities by option. */
export interface ManifestChoiceAnswer {
  choice: string
  probabilities: Record<string, number>
}

/** Other entries below this probability are not worth showing as "Also possible". */
const ALTERNATIVE_MIN = 0.15

/** The reading for a manifest entry the model chose. The entry is used as pasted; no ISO 6346 form is required of it. */
function manifestReading(entry: string, certainty: CertaintyLabel): ContainerIdReading {
  const value = entry.replace(/\s+/g, '').toUpperCase()
  const base: ContainerIdReading = /^[A-Z]{4}\d{6,7}$/.test(value)
    ? buildContainerIdReading({ printed: value, certainty })
    : {
        value,
        observedCheckDigit: null,
        calculatedCheckDigit: null,
        checkDigitValid: false,
        certainty,
        provenance: 'manifest',
      }
  return { ...base, provenance: 'manifest', manifestChecked: true }
}

/**
 * Reads the answers to a manifest check. Resolves to the chosen entry as a manifest reading, or null
 * when the model chose "not listed" everywhere or chose an entry too weakly to tell (spec 12.1: never
 * substitute a near-match). Certainty rests on the chosen probability and its margin over the best
 * other option, "not listed" and the other parts' choices included.
 */
export function readManifestAnswers(
  answers: Record<string, ManifestChoiceAnswer | undefined>,
  questions: ManifestQuestion[],
): ContainerIdReading | null {
  const scored: { value: string; probability: number }[] = []
  const chosen: { value: string; probability: number; runnerUp: number }[] = []
  for (const question of questions) {
    const answer = answers[question.name]
    if (!answer) continue
    const offered = question.options.map((o) => o.value)
    const probabilityOf = (value: string) => {
      const p = answer.probabilities[value]
      return typeof p === 'number' && Number.isFinite(p) ? p : 0
    }
    for (const value of offered) {
      if (value !== MANIFEST_NOT_LISTED) scored.push({ value, probability: probabilityOf(value) })
    }
    if (answer.choice === MANIFEST_NOT_LISTED || !offered.includes(answer.choice)) continue
    const others = offered.filter((v) => v !== answer.choice).map(probabilityOf)
    chosen.push({
      value: answer.choice,
      probability: probabilityOf(answer.choice),
      runnerUp: Math.max(0, ...others),
    })
  }
  chosen.sort((a, b) => b.probability - a.probability)
  const best = chosen[0]
  if (!best) return null
  const runnerUp = Math.max(best.runnerUp, chosen[1]?.probability ?? 0)
  const certainty = applyMargin(
    certaintyOfProbability(best.probability),
    best.probability,
    runnerUp,
  )
  if (certainty === "Can't tell") return null

  const reading = manifestReading(best.value, certainty)
  const alternatives = scored
    .filter((s) => s.value !== best.value && s.probability >= ALTERNATIVE_MIN)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 2)
    .map((s) => manifestReading(s.value, certainty).value)
  if (alternatives.length > 0) reading.alternatives = alternatives
  return reading
}
