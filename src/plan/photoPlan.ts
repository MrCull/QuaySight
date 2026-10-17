import { DOOR_DAMAGE_REQUEST, SIDE_DAMAGE_REQUEST } from '../domain/damageFamilies'
import { UNREAD } from '../domain/certainty'
import type { PhotoFace } from '../domain/photoFace'
import { planFor, type PlanRequest, type PlanView, type RunRoute } from './requestPlan'
import { survey } from './requests/survey'

// Planning the requests across several photos of one container (ticket #70). Every photo is surveyed, and
// the survey says which face it shows. What else is sent for a photo follows from that, so the container
// does not get a full run per photo:
// - a photo that is not a container gets nothing more;
// - the ID re-check and the crop read run only for a photo in which the survey read some of the ID;
// - the weight check runs only for a photo whose weights the survey read and found in disagreement;
// - each photo gets the damage set for its own face (door end or long side) and no other.
// One photo keeps the whole plan as it was: every request, in parallel with the survey.

const faceOf = (plan: PlanView): PhotoFace | null =>
  plan.answer(survey)?.findings.face?.face ?? null

/** Whether the survey read any character of the container ID in this photo. */
const showsId = (plan: PlanView): boolean =>
  [...(plan.answer(survey)?.containerId.value ?? '')].some((c) => c !== UNREAD)

/** What a request needs of the photo beyond its own `needed`, by request id. */
const GATES: Record<string, (plan: PlanView) => boolean> = {
  recheck: showsId,
  crop: showsId,
  [SIDE_DAMAGE_REQUEST]: (plan) => faceOf(plan) === 'long-side',
  [DOOR_DAMAGE_REQUEST]: (plan) => faceOf(plan) === 'rear-doors',
}

/** The request as one of several photos' plan has it: after the survey, and only where the photo calls for it. */
function gated(request: PlanRequest): PlanRequest {
  const gate = GATES[request.id] ?? (() => true)
  return {
    ...request,
    after: [...new Set([...(request.after ?? []), survey as PlanRequest])],
    needed: (plan) =>
      faceOf(plan) !== 'not-container' && gate(plan) && (request.needed?.(plan) ?? true),
  }
}

/** The requests one photo makes. `several`: this photo is one of more than one in the inspection. */
export function planForPhoto(
  requests: readonly PlanRequest[],
  route: RunRoute,
  several: boolean,
): PlanRequest[] {
  if (!several) return planFor(requests, route)
  return planFor(
    requests.map((r) => (r === survey ? r : gated(r))),
    route,
  )
}
