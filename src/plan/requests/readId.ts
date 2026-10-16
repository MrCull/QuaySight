import { withPhotoFace } from '../../domain/damageSets'
import type { ContainerIdReading } from '../../domain/inspection'
import type { ChoiceReading } from '../../domain/luna'
import { readPhotoFace, type FaceReading } from '../../domain/photoFace'
import { questionSetOf } from '../../domain/providers'
import { callLuna } from '../../services/luna'
import { callOpenRouterJev, callOpenRouterLuna } from '../../services/openrouter'
import type { PlanRequest, RequestContext, RequestReply } from '../requestPlan'

/** The container ID as read from the whole photo. */
export interface IdAnswer {
  containerId: ContainerIdReading
  /** Per-position readings, for the Luna question set's re-check; null for Jev's. */
  readings: ChoiceReading[] | null
  /** Which face the photo shows (the survey's face question), or null when unanswered. */
  face: FaceReading | null
}

/**
 * The Luna question set on the run's route: OpenAI direct, or OpenRouter (ticket #23). With positions,
 * only those are asked and read (the re-check).
 */
export async function readLuna(
  ctx: RequestContext,
  positions?: number[],
): Promise<RequestReply<IdAnswer>> {
  const { route, apiKey, photo, signal } = ctx
  const call =
    route.entry.wireFormat === 'openrouter-decisions'
      ? await callOpenRouterLuna({
          apiKey,
          photo,
          model: route.model,
          positions,
          describe: route.describe,
          signal,
        })
      : { ...(await callLuna({ apiKey, photo, positions, signal })), reportedCostUsd: null }
  return {
    answer: {
      containerId: call.containerId,
      readings: call.readings,
      face: readPhotoFace(
        route.entry.wireFormat === 'openrouter-decisions' ? 'openrouter-decisions' : 'openai-decisions',
        call.raw,
      ),
    },
    resolvedModel: call.resolvedModel,
    usage: call.usage,
    latencyMs: call.latencyMs,
    reportedCostUsd: call.reportedCostUsd,
    raw: call.raw,
  }
}

/**
 * Reads the container ID from the whole photo, with the question set the model's maker gets: Luna's
 * (either route) or Jev's (OpenRouter, with the box question where the catalogue says the model has it).
 */
export const readId: PlanRequest<IdAnswer> = {
  id: 'read',
  purpose: 'Reading markings',
  stages: ['id'],
  async send(ctx) {
    const { route } = ctx
    if (questionSetOf(route.entry) === 'luna') return readLuna(ctx)
    if (route.entry.wireFormat !== 'openrouter-decisions') {
      throw new Error(`No live adapter for ${route.model}`)
    }
    const call = await callOpenRouterJev({
      apiKey: ctx.apiKey,
      photo: ctx.photo,
      model: route.model,
      box: route.entry.box,
      describe: route.describe,
      signal: ctx.signal,
    })
    return {
      answer: {
        containerId: call.containerId,
        readings: null,
        face: readPhotoFace('openrouter-decisions', call.raw),
      },
      resolvedModel: call.resolvedModel,
      usage: call.usage,
      latencyMs: call.latencyMs,
      reportedCostUsd: call.reportedCostUsd,
      raw: call.raw,
    }
  },
  apply: (record, outcome) =>
    outcome.status === 'answered'
      ? withPhotoFace({ ...record, containerId: outcome.answer.containerId }, outcome.answer.face)
      : record,
}
