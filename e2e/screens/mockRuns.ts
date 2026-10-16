// Mocked provider replies for the screenshot harness (spec #27, ticket #38). Test code only.
//
// A live run now sends several requests at once (the survey, the long-side damage set, the door-end damage set,
// and sometimes a weights or ID second look). The harness answers each by its own questions, in OpenAI's Decisions
// shape. Every reply is hand-written from the COYU 266813 0 door figures (src/__tests__/weightReplies.ts): the
// harness shows how the screens treat such answers, it does not claim any provider said them. Nothing here is a
// recording and none of it reaches the demo.
import { openAiSurveyReply, type SurveyChoice } from '../../src/__tests__/surveyReplies'
import { COYU_WEIGHTS, weightChoices, type PrintedFigures } from '../../src/__tests__/weightReplies'

export type RequestKind = 'survey' | 'side' | 'door' | 'weights' | 'recheck'

/** Which request this is, from the questions in its body. */
export function kindOfRequest(body: string): RequestKind {
  if (body.includes('D1T_DT')) return 'door'
  if (body.includes('Z1T_DT')) return 'side'
  if (body.includes('photo_face')) return 'survey'
  if (body.includes('max_gross_kg_')) return 'weights'
  return 'recheck'
}

/** A scripted answer to a request: a reply body, or never (the request stays in flight). */
export const HOLD = Symbol('hold')
export type Reply = unknown | typeof HOLD
export type Script = (kind: RequestKind, n: number) => Reply

// ---- Survey ----------------------------------------------------------------------------------------

export interface SurveyOptions {
  id?: string
  face?: 'rear_doors' | 'long_side' | 'front_end' | 'roof' | 'close_up' | 'unknown'
  weights?: PrintedFigures | null
  /** Marking answers by name; the rest are answered no. */
  markings?: Record<string, SurveyChoice>
  dg?: SurveyChoice
}

const NO = (p = 0.95): SurveyChoice => [['no', p]]
const YES = (p = 0.9): SurveyChoice => [['yes', p]]

export function surveyReply(options: SurveyOptions = {}) {
  const details: Record<string, SurveyChoice> = {
    size_type_code: [['22G1', 0.95]],
    equipment_reefer: NO(),
    equipment_open_top: NO(),
    equipment_tank: NO(),
    equipment_flat_rack: NO(),
    marking_super_heavy: NO(),
    marking_high_container: NO(),
    marking_overwidth: NO(),
    marking_fumigation: NO(),
    marking_marine_pollutant: NO(),
    dg_placard: options.dg ?? [['none', 0.95]],
    photo_face: [[options.face ?? 'rear_doors', 0.96]],
    ...options.markings,
    ...(options.weights === null ? {} : weightChoices(options.weights ?? COYU_WEIGHTS)),
  }
  return openAiSurveyReply(options.id ?? 'COYU2668130', { details })
}

/** The survey reply with its ID answers replaced by those of another reply (the uncertain, partial and empty reads). */
export function surveyWithIdAnswers(
  idAnswers: Array<Record<string, unknown>>,
  options: SurveyOptions = {},
) {
  const reply = surveyReply(options)
  return {
    ...reply,
    answers: [
      ...idAnswers.filter((a) => String(a.name).startsWith('id_char_')),
      ...reply.answers.filter((a) => !String(a.name).startsWith('id_char_')),
    ],
  }
}

/** A weights read where lb disagrees with kg for max gross (67,900 lb against 30,480 kg), however often it is asked. */
export const CONFLICTING_WEIGHTS: PrintedFigures = {
  ...COYU_WEIGHTS,
  maxGross: { kg: '30,480', lb: '67,900' },
}

export const MARKINGS_SEEN: Pick<SurveyOptions, 'markings' | 'dg'> = {
  markings: {
    marking_high_container: YES(0.8),
    marking_fumigation: YES(0.9),
    marking_overwidth: [['unknown', 0.7]],
  },
  dg: [['class_3', 0.9]],
}

// ---- Damage sets -----------------------------------------------------------------------------------

type Keyed = Record<string, Record<string, unknown>>

const choice = (value: string, p = 0.95) => ({
  type: 'choice',
  name: '',
  choice: value,
  probabilities: [{ value, probability: p }],
})

const severityAt = (level: 0 | 1 | 2 | 3 | 4) => {
  const probabilities = [0.01, 0.01, 0.01, 0.01, 0.01]
  probabilities[level] = 0.96
  return probabilities
}

function list(answers: Keyed) {
  return {
    model: 'gpt-6-luna',
    usage: { input_tokens: 21000, output_tokens: 0 },
    answers: Object.entries(answers).map(([name, a]) => ({ ...a, name })),
  }
}

const predicate = (p: number) => ({ type: 'predicate', probability: p })
const score = (level: 0 | 1 | 2 | 3 | 4) => ({
  type: 'score',
  probabilities: severityAt(level).map((probability, value) => ({ value, probability })),
})

/** A reply that says this face is not in the photo: the set's own coverage answer. */
export const notThisFace = (kind: 'side' | 'door') =>
  list({
    [kind === 'side' ? 'side_panel_coverage' : 'door_end_coverage']: choice('not_inspectable'),
  })

/** The long side: findings at all four severities, one panel zone each, and a rail. Zones are photo-relative. */
export function sideReply() {
  const answers: Keyed = {
    image_quality: choice('good'),
    side_panel_coverage: choice('full'),
    door_end_in_image: choice('image_left'),
    potentially_significant_damage: predicate(0.7),
    bottom_rail_bent: predicate(0.8),
  }
  const zones: Record<string, [probability: number, level: 0 | 1 | 2 | 3 | 4]> = {
    Z1T: [0.85, 1],
    Z2B: [0.9, 3],
    Z3T: [0.8, 2],
    Z4B: [0.88, 4],
  }
  for (const zone of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].flatMap((z) => [`${z}T`, `${z}B`])) {
    const hit = zones[zone]
    answers[`${zone}_visibility`] = choice('clear')
    answers[`${zone}_DT`] = predicate(hit ? hit[0] : 0.03)
    answers[`${zone}_severity`] = score(hit ? hit[1] : 0)
  }
  return list(answers)
}

/** The door end: a dent low on the photo-right leaf, a bent locking bar on the left, a worn gasket. */
export function doorReply() {
  const answers: Keyed = {
    image_quality: choice('good'),
    door_end_coverage: choice('most', 0.9),
    potentially_significant_damage: predicate(0.6),
    left_leaf_locking_bar_bent: predicate(0.8),
    door_gasket_damage: predicate(0.65),
  }
  for (const leaf of [1, 2]) {
    for (const band of ['T', 'M', 'B']) {
      const zone = `D${leaf}${band}`
      const dented = zone === 'D2B'
      answers[`${zone}_visibility`] = choice('clear')
      answers[`${zone}_DT`] = predicate(dented ? 0.9 : 0.03)
      answers[`${zone}_severity`] = score(dented ? 3 : 0)
    }
  }
  return list(answers)
}

// ---- Scripts ---------------------------------------------------------------------------------------

/** Answers each request with its own reply for a rear-door photo. */
export function rearDoorsScript(
  options: SurveyOptions = {},
  overrides: Partial<Record<RequestKind, Reply>> = {},
): Script {
  return (kind) => {
    if (kind in overrides) return overrides[kind]
    if (kind === 'survey' || kind === 'weights' || kind === 'recheck') return surveyReply(options)
    return kind === 'door' ? doorReply() : notThisFace('side')
  }
}

/** A long-side photo: the side set answers, the door set says it cannot see a door end. */
export function longSideScript(options: SurveyOptions = {}): Script {
  return (kind) => {
    if (kind === 'side') return sideReply()
    if (kind === 'door') return notThisFace('door')
    return surveyReply({ ...options, face: 'long_side' })
  }
}

/** A photo of the roof: neither damage set can inspect it. */
export function roofScript(options: SurveyOptions = {}): Script {
  return (kind) => {
    if (kind === 'side') return notThisFace('side')
    if (kind === 'door') return notThisFace('door')
    return surveyReply({ ...options, face: 'roof' })
  }
}
