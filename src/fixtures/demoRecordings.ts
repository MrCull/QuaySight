import jevSmoke from './live/openrouter-jev-smoke.json'
import lunaSmoke from './live/luna-smoke.json'
import { parsePlanRecording, preSurveyRecording, type PlanRecording } from '../plan/recording'

/**
 * Every recording demo mode can replay (spec #27, ticket #37). All of them are real: what a model answered
 * on the photo named in the recording, taken from a live run with no key or headers.
 *
 * - The full-plan recordings are the JSON files in ./live/plan/, written by the opt-in recording spec
 *   (src/services/__tests__/planRecording.live.spec.ts). Dropping one there is all it takes to use it.
 * - Two earlier live smoke runs, made before the survey existed, asked only the container ID: Luna on the
 *   APHU photo and Jev latest on the CHSU photo. They stand in until those photos are recorded again with
 *   the whole plan, and they fill the ID and nothing else.
 *
 * Nothing in here is hand-written. The hand-written examples the walking skeleton used are test data now
 * (src/__tests__/handWrittenRecord.ts) and are never shown as a recording.
 */
const planFiles = import.meta.glob<unknown>('./live/plan/*.json', {
  eager: true,
  import: 'default',
})

export const SHIPPED_RECORDINGS: readonly PlanRecording[] = [
  ...Object.values(planFiles).map((file) => parsePlanRecording(file)),
  preSurveyRecording(lunaSmoke),
  preSurveyRecording(jevSmoke),
]
