import type { PlanRequest } from './requestPlan'
import { idRecheck } from './requests/idRecheck'
import { readId } from './requests/readId'
import { sideDamage } from './requests/sideDamage'

/**
 * Every request a live run can make, in the order they are listed in the ledger when they start
 * together. A new request is one more entry here, defined in its own module; whether a run includes
 * it is the request's own appliesTo and needed.
 */
const registered: PlanRequest[] = [readId, idRecheck, sideDamage]

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

/**
 * Test seam: later runs make only these of the registered requests (a spec about one part of the run
 * keeps the other parts' requests out of its fetch counts and ledger). Returns the restore.
 */
export function onlyRequests(...keep: PlanRequest[]): () => void {
  const saved = [...registered]
  registered.splice(0, registered.length, ...saved.filter((r) => keep.includes(r)))
  return () => {
    registered.splice(0, registered.length, ...saved)
  }
}
