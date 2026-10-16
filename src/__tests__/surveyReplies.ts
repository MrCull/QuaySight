// Test support: provider replies to the survey request (src/plan/requests/survey.ts), in the response
// shapes seen live on 16 Oct 2026, for store tests that stub fetch at the network edge. Hand-written.

/** One choice answer: the chosen value first, then any others with their probabilities. */
export type SurveyChoice = [value: string, probability: number][]

export interface SurveyReplyOptions {
  /** Detail answers by question name, e.g. { size_type_code: [['22G1', 0.95]] }. */
  details?: Record<string, SurveyChoice>
  model?: string
  inputTokens?: number
}

/** The ID answers: each character read at 0.97; a '?' is answered too weakly to read (unread). */
export function idChoices(id: string): Record<string, SurveyChoice> {
  const answers: Record<string, SurveyChoice> = {}
  id.split('').forEach((ch, i) => {
    const name = `id_char_${String(i + 1).padStart(2, '0')}`
    const filler = i < 4 ? ['A', 'B'] : ['0', '1']
    answers[name] =
      ch === '?'
        ? [
            [filler[0]!, 0.2],
            [filler[1]!, 0.18],
          ]
        : [[ch, 0.97]]
  })
  return answers
}

/** An OpenAI Decisions reply: a list of named choice answers with a probabilities list. */
export function openAiSurveyReply(id: string, options: SurveyReplyOptions = {}) {
  const answers = { ...idChoices(id), ...options.details }
  return {
    model: options.model ?? 'gpt-6-luna',
    usage: { input_tokens: options.inputTokens ?? 6200, output_tokens: 0 },
    answers: Object.entries(answers).map(([name, choices]) => ({
      type: 'choice',
      name,
      choice: choices[0]![0],
      probabilities: choices.map(([value, probability]) => ({ value, probability })),
    })),
  }
}

/** An OpenRouter Decisions reply: answers keyed by name, probabilities as a map. */
export function openRouterSurveyReply(
  id: string,
  options: SurveyReplyOptions & { box?: boolean; cost?: number } = {},
) {
  const keyed: Record<string, unknown> = {}
  for (const [name, choices] of Object.entries({ ...idChoices(id), ...options.details })) {
    keyed[name] = {
      type: 'choice',
      choice: choices[0]![0],
      probabilities: Object.fromEntries(choices),
      confidence: choices[0]![1],
    }
  }
  if (options.box) {
    keyed.container_box = {
      type: 'box',
      box: { top: 0.21, bottom: 0.27, left: 0.6, right: 0.73 },
      confidence: 0.79,
    }
  }
  return {
    model: options.model ?? 'typesafe/jev-1.14-20261014',
    answers: keyed,
    usage: {
      input_tokens: options.inputTokens ?? 2400,
      output_tokens: 90,
      cost: options.cost ?? 0.0003,
    },
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
