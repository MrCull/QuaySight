// Test support: provider replies to the damage question sets, in the response shapes seen live on
// 16 Oct 2026, for specs that need a plan recording or a stubbed run. Hand-written test data: never shipped,
// never shown as a recording.

/** An OpenRouter reply to a question set: each answer keyed by its question name (no box). */
export function keyedReply(answers: Record<string, unknown>) {
  return {
    model: 'typesafe/jev-1.14-20261014',
    answers,
    usage: { input_tokens: 21000, output_tokens: 0, cost: 0.0005 },
  }
}

const CLEAN_SEVERITY = { '0': 0.94, '1': 0.04, '2': 0.01, '3': 0.005, '4': 0.005 }
const DENTED_SEVERITY = { '0': 0.03, '1': 0.07, '2': 0.6, '3': 0.25, '4': 0.05 }

const choice = (value: string, p = 0.95) => ({
  type: 'choice',
  choice: value,
  probabilities: { [value]: p },
})

/** The door set's answers on OpenRouter: a dented photo-right leaf, bottom third. */
export function doorReply() {
  const answers: Record<string, unknown> = {
    image_quality: choice('good'),
    door_end_coverage: choice('most', 0.9),
    potentially_significant_damage: { type: 'noul', noul: 0.6 },
  }
  for (const leaf of [1, 2]) {
    for (const band of ['T', 'M', 'B']) {
      const zone = `D${leaf}${band}`
      const dented = zone === 'D2B'
      answers[`${zone}_visibility`] = choice('clear')
      answers[`${zone}_DT`] = { type: 'noul', noul: dented ? 0.9 : 0.03 }
      answers[`${zone}_severity`] = {
        type: 'score',
        probabilities: dented ? DENTED_SEVERITY : CLEAN_SEVERITY,
      }
    }
  }
  return keyedReply(answers)
}

/** The side set's reply for a photo that is no long side: its own coverage says not inspectable. */
export function notASideReply() {
  return keyedReply({ side_panel_coverage: choice('not_inspectable') })
}

/** The side set's reply for a long side with a dent in the lower middle (zone Z2B). */
export function dentedSideReply() {
  return keyedReply({
    side_panel_coverage: choice('full'),
    image_quality: choice('good'),
    Z2B_visibility: choice('clear'),
    Z2B_DT: { type: 'noul', noul: 0.9 },
    Z2B_severity: { type: 'score', probabilities: DENTED_SEVERITY },
  })
}

/** The same answers in OpenAI's own shape: a list, with predicates and score levels spelt out. */
export function openAiShape(reply: ReturnType<typeof keyedReply>) {
  type Keyed = {
    type: string
    noul?: number
    choice?: string
    probabilities?: Record<string, number>
  }
  return {
    model: 'gpt-6-luna',
    usage: { input_tokens: 21000, output_tokens: 0 },
    answers: Object.entries(reply.answers as Record<string, Keyed>).map(([name, a]) => {
      if (a.type === 'noul') return { type: 'predicate', name, probability: a.noul }
      const probabilities = Object.entries(a.probabilities ?? {}).map(([value, probability]) => ({
        value: a.type === 'score' ? Number(value) : value,
        probability,
      }))
      return a.type === 'score'
        ? { type: 'score', name, probabilities }
        : { type: 'choice', name, choice: a.choice, probabilities }
    }),
  }
}
