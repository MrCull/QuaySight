// The whole-prefix owner-code question and how its answer combines with the letter-by-letter reading
// (spec 4.1, ticket #43). Pure. The model picks from the app's list of common BIC owner codes, or "none".
import { applyMargin, CERTAINTY_LABELS, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import type { ChoiceReading } from './idQuestions'
import { OWNER_CODES } from './ownerCodes'
import type { ChoiceQuestion, SharedAnswer } from './questionSet'

export const OWNER_QUESTION_NAME = 'owner_code'
/** The answer for a prefix that is not on the list, or that cannot be read. */
export const NONE_OF_THESE = 'none'

/** Listed codes this many letters (or fewer) from the letter-by-letter reading are offered as candidates. */
const NEAR_LETTERS = 2
const MAX_NEAR_MATCHES = 6

export function ownerQuestion(image: string): ChoiceQuestion {
  return {
    type: 'choice',
    name: OWNER_QUESTION_NAME,
    instructions: `The container number on ${image} starts with a four-letter owner code, the last letter of which is U. Which of these is the owner code? Answer ${NONE_OF_THESE} if it is not on the list or cannot be read.`,
    choices: [
      { value: NONE_OF_THESE, description: 'None of these' },
      ...OWNER_CODES.map((code) => ({ value: code, description: `Owner code ${code}` })),
    ],
  }
}

/** The model's list pick: a listed code, or null for "none of these", with its certainty. */
export interface OwnerPick {
  code: string | null
  certainty: CertaintyLabel
}

/** The list pick in an answer set, by meaning. No usable answer is no pick. */
export function readOwnerPick(answers: Record<string, SharedAnswer>): OwnerPick | null {
  const answer = answers[OWNER_QUESTION_NAME]
  if (answer?.type !== 'choice') return null
  const chosen = answer.probabilities[answer.value]
  if (chosen === undefined) return null
  const others = Object.entries(answer.probabilities)
    .filter(([value]) => value !== answer.value)
    .map(([, probability]) => probability)
  const best = others.length > 0 ? Math.max(...others) : null
  return {
    code: answer.value === NONE_OF_THESE ? null : answer.value,
    certainty: applyMargin(certaintyOfProbability(chosen), chosen, best),
  }
}

export interface OwnerReading {
  /** The letter readings, with a confident list pick standing in the owner positions. */
  readings: ChoiceReading[]
  /** Three-letter owner prefixes to rank as candidates: the losing reading and near matches. */
  alternatives: string[]
}

const OWNER_LETTERS = 3

function distance(a: string, b: string): number {
  return [...a].filter((ch, i) => ch !== b[i]).length
}

function worstOf(a: CertaintyLabel, b: CertaintyLabel): CertaintyLabel {
  return CERTAINTY_LABELS[Math.max(CERTAINTY_LABELS.indexOf(a), CERTAINTY_LABELS.indexOf(b))] ?? a
}

/**
 * Combines the list pick with the letter-by-letter reading. A Likely or Confident pick is the owner code.
 * Otherwise the letters stand, trusted less when their 4th character came back as something other than U.
 * Either way the losing reading, and listed codes one or two letters from the letters, are candidates.
 */
export function combineOwnerReading(
  readings: ChoiceReading[],
  pick: OwnerPick | null | undefined,
): OwnerReading {
  if (!pick) return { readings, alternatives: [] }
  const owner = readings.slice(0, OWNER_LETTERS)
  const letters = owner.every((r) => r.value !== null) ? owner.map((r) => r.value).join('') : null
  const pickLetters = pick.code?.slice(0, OWNER_LETTERS) ?? null
  const near = letters
    ? OWNER_CODES.map((code) => code.slice(0, OWNER_LETTERS))
        .filter((prefix) => distance(prefix, letters) <= NEAR_LETTERS)
        .sort((a, b) => distance(a, letters) - distance(b, letters))
        .slice(0, MAX_NEAR_MATCHES)
    : []
  const unique = (list: (string | null)[], standing: string | null) => [
    ...new Set(list.filter((p): p is string => p !== null && p !== standing)),
  ]

  if (pickLetters && (pick.certainty === 'Confident' || pick.certainty === 'Likely')) {
    const stood = (value: string): ChoiceReading => ({
      value,
      certainty: pick.certainty,
      runnerUp: null,
    })
    return {
      readings: readings.map((r, i) =>
        i < OWNER_LETTERS ? stood(pickLetters[i]!) : i === OWNER_LETTERS ? stood('U') : r,
      ),
      alternatives: unique([letters, ...near], pickLetters),
    }
  }

  const fourth = readings[OWNER_LETTERS]?.value
  const lessTrusted = fourth != null && fourth !== 'U'
  return {
    readings: lessTrusted
      ? readings.map((r, i) =>
          i < OWNER_LETTERS && r.value !== null
            ? { ...r, certainty: worstOf(r.certainty, 'Uncertain') }
            : r,
        )
      : readings,
    alternatives: unique([pickLetters, ...near], letters),
  }
}
