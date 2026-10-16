import type { PlanRequest } from './requestPlan'
import { idCropRead } from './requests/idCropRead'
import { idRecheck } from './requests/idRecheck'
import { survey } from './requests/survey'

/**
 * Every request a live run can make, in the order they are listed in the ledger when they start
 * together. A new request is one more entry here, defined in its own module; whether a run includes
 * it is the request's own appliesTo and needed.
 */
const registered: PlanRequest[] = [survey, idRecheck, idCropRead]

export function planRequests(): readonly PlanRequest[] {
  return registered
}

/** Adds a request to every later run. Returns its removal (tests add test-only requests this way). */
export function registerRequest(request: PlanRequest): () => void {
  if (registered.some((r) => r.id === request.id)) {
    throw new Error(`A request with id ${request.id} is already registered`)
  }
  registered.push(request)
  return () => {
    const at = registered.indexOf(request)
    if (at >= 0) registered.splice(at, 1)
  }
}
