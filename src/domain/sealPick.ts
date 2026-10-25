// The seal pick (spec 4.5). Pure.
//
// Read one place at a time, a model loses count in a run of one repeated digit: live Jev read 6400003 as
// 64000003 and 1004440 as 100440, and its answer to how many characters the number has was no steadier.
// Shown the whole number, it tells the right one from its near misses easily (the same photos, offered
// the read and its neighbours, picked 6400003, 1004440 and 0015167 at 0.89 to 1.00). So the seal reads
// give the candidates, and a second request asks which of them is the number printed on the seal.
//
// The candidates are each read (from the left and from the right), with each place's next most likely
// character, and with every run of one repeated character a character longer and a character shorter.
// The pick is never shown as a choice: the result is the seal number, its certainty and, when the
// model was torn, the other number as its alternative.
import { applyMargin, CERTAINTY_LABELS, certaintyOfProbability } from './certainty'
import type { CertaintyLabel } from './inspection'
import type { SealReading } from './sealFamily'
import type { ChoiceQuestion, SharedAnswer } from './questionSetTypes'

/** The most candidates offered in one pick. Far under a choice question's limit; enough for the read and its near misses. */
export const MAX_SEAL_CANDIDATES = 24
/** The longest seal number offered. A run lengthened past the places read can reach one past them. */
const MAX_LENGTH = 10
/** A character at a place is a candidate when its probability is at least this. */
const OPTION_MIN = 0.05
/** Strings kept from one direction's read before the run variants are added. */
const BEAM = 8
/** The other number is shown as the alternative when its pick probability is at least this. */
const ALTERNATIVE_MIN = 0.15

const PICK_QUESTION = 'seal_number'
const OTHER = 'other'
const NONE = 'none'
const SEAL_CHARACTER = /^[0-9A-Z]$/

interface Scored {
  value: string
  score: number
}

/** The characters a place may hold, most likely first; `none` ends the number there. */
function optionsAt(answer: SharedAnswer | undefined): Scored[] {
  if (answer?.type !== 'choice') return []
  return Object.entries(answer.probabilities)
    .filter(([v, p]) => p >= OPTION_MIN && (v === NONE || SEAL_CHARACTER.test(v)))
    .map(([value, score]) => ({ value, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

/** The likeliest numbers one direction's places spell, each place's options multiplied through. */
function spelled(places: (SharedAnswer | undefined)[]): Scored[] {
  let beam: (Scored & { ended: boolean })[] = [{ value: '', score: 1, ended: false }]
  for (const answer of places) {
    const options = optionsAt(answer)
    if (options.length === 0) break
    const next: (Scored & { ended: boolean })[] = []
    for (const s of beam) {
      if (s.ended) {
        next.push(s)
        continue
      }
      for (const o of options) {
        next.push(
          o.value === NONE
            ? { value: s.value, score: s.score * o.score, ended: true }
            : { value: s.value + o.value, score: s.score * o.score, ended: false },
        )
      }
    }
    beam = merge(next).slice(0, BEAM * 2) as typeof beam
  }
  return merge(beam).filter((s) => s.value.length > 0)
}

/** One entry per value, at its best score, best first. */
function merge<T extends Scored>(list: T[]): T[] {
  const best = new Map<string, T>()
  for (const s of list) {
    const seen = best.get(s.value)
    if (!seen || seen.score < s.score) best.set(s.value, s)
  }
  return [...best.values()].sort((a, b) => b.score - a.score)
}

/** The number with each run of one repeated character a character longer, and a character shorter. */
export function runVariants(value: string): string[] {
  const out: string[] = []
  for (let i = 0; i < value.length;) {
    let j = i
    while (value[j] === value[i]) j++
    out.push(value.slice(0, i) + value[i] + value.slice(i))
    if (j - i > 1) out.push(value.slice(0, i) + value.slice(i + 1))
    i = j
  }
  return out
}

/**
 * The numbers the pick offers for one read of the seal: the read's answers (`seal_char_NN` from the
 * left, `seal_rchar_NN` from the right) and the reading made of them. Empty when nothing was read.
 */
export function sealCandidates(
  answers: Record<string, SharedAnswer>,
  reading: SealReading | null,
  positions: number,
): string[] {
  const name = (prefix: string, i: number) => `${prefix}${String(i + 1).padStart(2, '0')}`
  const left = spelled(Array.from({ length: positions }, (_, i) => answers[name('seal_char_', i)]))
  const right = spelled(
    Array.from({ length: positions }, (_, i) => answers[name('seal_rchar_', i)]),
  ).map((s) => ({ ...s, value: [...s.value].reverse().join('') }))
  const read = [
    reading?.value,
    reading?.alternative,
    ...left.slice(0, BEAM).map((s) => s.value),
    ...right.slice(0, BEAM).map((s) => s.value),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0 && !v.includes('?'))
  const firsts = [reading?.value, reading?.alternative, left[0]?.value, right[0]?.value].filter(
    (v): v is string => typeof v === 'string' && v.length > 0 && !v.includes('?'),
  )
  const all = [...read, ...firsts.flatMap(runVariants)]
  return [...new Set(all)]
    .filter((v) => v.length <= MAX_LENGTH && [...v].every((c) => SEAL_CHARACTER.test(c)))
    .slice(0, MAX_SEAL_CANDIDATES)
}

/** Candidates from more than one read (the survey and the zoomed read), the first read's first. */
export function joinCandidates(...lists: string[][]): string[] {
  const out: string[] = []
  const longest = Math.max(0, ...lists.map((l) => l.length))
  // Taken in turn, so each read's likeliest numbers make the cut before any read's long tail.
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const v = list[i]
      if (v !== undefined && !out.includes(v)) out.push(v)
    }
  }
  return out.slice(0, MAX_SEAL_CANDIDATES)
}

/** The pick's one question. The candidates are offered in sorted order, so none is placed first as the read. */
export function sealPickQuestion(candidates: string[]): ChoiceQuestion {
  return {
    type: 'choice',
    name: PICK_QUESTION,
    instructions:
      'Which of these is exactly the number printed or embossed on the seal fitted to the container door? This is not the container identification. Compare every character, and count how many times each repeated character appears in a row.',
    choices: [
      ...[...candidates].sort().map((value) => ({ value, description: `The number ${value}` })),
      {
        value: OTHER,
        description: 'None of these: the number on the seal differs from every one listed',
      },
    ],
  }
}

export const SEAL_PICK_INSTRUCTIONS =
  'This photo shows a freight container. A tamper-evident seal is fitted to its door, with its own number printed or embossed on it.'

export interface SealPick {
  /** The number picked, or null when the model answered none of these (or gave no usable answer). */
  value: string | null
  probability: number
  /** The likeliest other candidate, and its probability. */
  runnerUp: { value: string; probability: number } | null
}

export function readSealPick(
  answers: Record<string, SharedAnswer>,
  candidates: string[],
): SealPick {
  const answer = answers[PICK_QUESTION]
  if (answer?.type !== 'choice') return { value: null, probability: 0, runnerUp: null }
  const ranked = Object.entries(answer.probabilities)
    .filter(([v]) => v === OTHER || candidates.includes(v))
    .sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  if (!top || top[0] === OTHER || top[0] !== answer.value) {
    return { value: null, probability: top?.[1] ?? 0, runnerUp: null }
  }
  const second = ranked.find(([v]) => v !== top[0] && v !== OTHER)
  return {
    value: top[0],
    probability: top[1],
    runnerUp: second ? { value: second[0], probability: second[1] } : null,
  }
}

const rank = (l: CertaintyLabel) => CERTAINTY_LABELS.indexOf(l)
const weaker = (a: CertaintyLabel, b: CertaintyLabel) => (rank(a) >= rank(b) ? a : b)

/**
 * The seal after the pick. A picked number stands at the certainty its probability gives, a level lower
 * when the runner-up is within the margin, with the runner-up as its alternative when it is plausible.
 * Its characters all carry that certainty: the pick weighs the number as a whole. When the model picked
 * none of the candidates, or picked too weakly to say, the read stands at no better than Uncertain.
 */
export function applySealPick(seal: SealReading, pick: SealPick): SealReading {
  const runner = pick.runnerUp
  const certainty =
    pick.value === null
      ? "Can't tell"
      : applyMargin(
          certaintyOfProbability(pick.probability),
          pick.probability,
          runner?.probability ?? null,
        )
  if (pick.value === null || certainty === "Can't tell") {
    const cap = (c: CertaintyLabel) => (c === "Can't tell" ? c : weaker(c, 'Uncertain'))
    return {
      ...seal,
      characters: seal.characters.map((c) => ({ ...c, certainty: cap(c.certainty) })),
      certainty: cap(seal.certainty),
    }
  }
  const picked: SealReading = {
    ...seal,
    visible: true,
    characters: [...pick.value].map((value) => ({ value, certainty })),
    value: pick.value,
    certainty,
  }
  delete picked.alternative
  delete picked.candidates
  if (runner && runner.probability >= ALTERNATIVE_MIN) picked.alternative = runner.value
  return picked
}
