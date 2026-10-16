import type { InspectionRecord, PhotoRef } from '../domain/inspection'
import { LUNA_ENDPOINT_ID } from '../domain/luna'
import { OPENROUTER_ENDPOINT_ID } from '../domain/openrouter'
import { findModel, labelsFor } from '../domain/providers'
import { readReplyMeta } from '../domain/replyMeta'
import { draftRecord } from './draftRecord'
import { planRequests } from './registry'
import type { PlanRequest, PlanView, RunRoute, SettledRequest } from './requestPlan'
import { foldSettled } from './requestPlan'
import type { PlanRecording } from './recording'

/**
 * Replays a recording as the record the live run gave (demo mode). Each recorded response is read by its
 * request's own answer mapper (`PlanRequest.replay`, the mapper `send` uses) and folded into the record in
 * the order the requests landed, exactly as a live run folds them. Nothing is sent: no network, no key.
 * The raw bodies are kept on the record marked `recorded-fixture`.
 */
export function replayRecording(
  recording: PlanRecording,
  options: { id: string; photo: PhotoRef | null },
): InspectionRecord {
  const entry = findModel(recording.provider, recording.model)
  if (!entry) throw new Error(`No catalogue entry for ${recording.model}.`)
  const route: RunRoute = {
    provider: recording.provider,
    model: recording.model,
    entry,
    // The ledger's endpoint family; a replay makes no ledger line.
    endpoint:
      entry.wireFormat === 'openrouter-decisions' ? OPENROUTER_ENDPOINT_ID : LUNA_ENDPOINT_ID,
    describe: {
      name: labelsFor(recording.provider, recording.model).model,
      maxSide: entry.photoLimits.maxSide,
    },
  }
  const answers = new Map<PlanRequest, unknown>()
  const plan: PlanView = {
    route,
    answer: <B>(request: PlanRequest<B>) => answers.get(request as PlanRequest) as B | undefined,
  }
  const requests = planRequests()

  let record = draftRecord({
    id: options.id,
    provider: recording.provider,
    model: recording.model,
    source: 'recorded',
    photo: options.photo,
  })
  for (const recorded of recording.entries) {
    const request = requests.find((r) => r.id === recorded.request)
    if (!request?.replay) {
      throw new Error(`The recorded request "${recorded.request}" cannot be replayed.`)
    }
    const answer = request.replay(recorded.response, plan, {
      crop: recorded.crop,
      asked: recorded.asked,
    })
    answers.set(request, answer)
    const meta = readReplyMeta(recorded.response, recording.model)
    const settled: SettledRequest = {
      request,
      outcome: { status: 'answered', answer, resolvedModel: meta.resolvedModel },
      reply: {
        answer,
        resolvedModel: meta.resolvedModel,
        usage: meta.usage,
        latencyMs: recorded.latencyMs ?? 0,
        reportedCostUsd: meta.reportedCostUsd,
        raw: recorded.response,
      },
      passId: `${options.id}-${request.id}`,
      plan,
    }
    record = foldSettled(record, settled)
  }
  return {
    ...record,
    status: 'complete',
    rawResponses: record.rawResponses.map((raw) => ({ ...raw, capturedFrom: 'recorded-fixture' })),
  }
}
