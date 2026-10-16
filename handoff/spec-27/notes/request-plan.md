# Request plan: how a later ticket adds a request (#28)

Branch: `worktree-agent-a1ba82ba5a33a48c1`. Code: `src/plan/` (plus `src/domain/runStages.ts`,
`src/services/askDecisions.ts`). Once this is merged, you do not touch `src/stores/inspection.ts`
run logic or `src/domain/inspection.ts` to add a request.

## The model

- A live run = every request in `src/plan/registry.ts` whose `appliesTo(route)` is true (and whose
  `after` prerequisites are also in the plan). `RunRoute` = `{ provider, model, entry (catalogue
  ModelOption), endpoint, describe }`.
- Each request: own `AbortController`, own ledger line (`<inspectionId>-<request.id>`, purpose =
  `request.purpose`), own raw response (same passId), counts towards `request.stages`.
- Requests with no `after` start together. A request with `after: [x]` starts when x **answered**;
  if x failed/blocked/cancelled it is never sent (state `skipped`). `needed(plan)` is checked at that
  moment; false → `not-needed` (no call, no ledger line).
- The cost cap (6 requests / $0.05 per inspection) already spans the run: in-flight calls count.
  A blocked request gets outcome `blocked`. NB: A+B+C+D+E+F+manifest = 7 > 6, so whoever adds the
  later requests must revisit `spendCaps.maxRequestsPerInspection` in `src/domain/rates.ts`.
- `optional: true` = a refinement of a usable answer (Luna's re-check): its failure leaves the stage
  `done` and the record `complete`.

## Add a request (e.g. #31 survey, #33/#34 damage)

1. **Domain module** (pure): question builder + answer mapper, e.g. `src/domain/survey.ts`.
2. **Request module** `src/plan/requests/<name>.ts` exporting a `PlanRequest<Answer>`:

```ts
import { askDecisions } from '../../services/askDecisions'
import type { PlanRequest } from '../requestPlan'

declare module '../../domain/inspection' {
  interface InspectionRecord {
    details?: ContainerDetails | null   // ALWAYS optional: demo samples and old records lack it
  }
}

export const survey: PlanRequest<SurveyAnswer> = {
  id: 'survey',                       // unique; ledger/raw id suffix
  purpose: 'Reading the details',     // ledger line wording (plain words, no "pass"/"retry")
  stages: ['id', 'details'],          // StageId: 'id' | 'details' | 'damage'
  // after: [readId], needed: (plan) => …, appliesTo: (route) => route.entry.box, optional: true
  send: (ctx) => askDecisions(ctx, {
    build: ({ route, imageDataUrl }) => buildSurveyBody(route.entry.wireFormat, route.model, imageDataUrl),
    map: (raw, route) => mapSurvey(raw),
  }),
  apply: (record, outcome, plan) =>
    outcome.status === 'answered' ? { ...record, details: outcome.answer.details } : record,
}
```

   - `askDecisions(ctx, { build, map })` posts to the route's own endpoint (OpenAI or OpenRouter),
     key only in Authorization, OpenRouter attribution headers, the route's error wording, the
     request's abort signal; it reads resolvedModel/usage/usage.cost from the reply itself.
     `build` must return the full wire body for `route.entry.wireFormat` (use #29/#30's
     question-format translation there). If you need a bespoke call, write `send` yourself: return
     `RequestReply<A>` and pass `ctx.signal` to the service (all services now accept `signal`).
   - `ctx.answer(otherRequest)` gives a prerequisite's typed answer (for D crop read, E weight
     re-read, F re-check). `plan.answer(...)` is the same in `apply`/`needed`.
   - `apply` is called once for every request that was **started**, with outcome
     `answered | failed | blocked | cancelled`, in settle order. Return the record unchanged when there
     is nothing to add; record what did not happen if the export needs it (see `idRecheck.ts`).
     Never set `status`, `rawResponses` or `resolvedVersion`: `foldSettled` does that.
3. **Register it**: one line in the `registered` array in `src/plan/registry.ts`. That is the only
   shared file you touch (expect trivial merge conflicts there, keep one entry per line).

## Stages, landing and UI

- Stage states (`src/domain/runStages.ts`): `not-in-run` (no request for it: "Not part of this run"),
  `active`, `done`, `failed` (a non-optional request failed/blocked/skipped), `cancelled`. Done
  stages show the measured time. Titles: *Reading the ID*, *Reading container details*, *Checking for damage*.
- The store publishes `store.record` as soon as anything answers (status `running` until the plan
  settles). UI parts are gated with `store.landed(stage)`: true once that stage settled, or once the
  run is over. Already gated: ID card (`'id'`), `ContainerDetails` (`'details'`), `DamageView`
  (`'damage'`, in App.vue). Exports and the manifest offer wait for the run to end.
- A part landing mid-run adds `qs-arrived` to its own card (see ResultsPanel `arrivedEarly`) so it
  animates in inside the still-`qs-arriving` screen. New UI parts (What we found, etc.) should do the same.
- New stage? Add it to `StageId` and `RUN_STAGES` in `runStages.ts` and a part label in
  ResultsPanel's `PART`/`FAILED_TITLE` maps.

## Run end

- Nothing answered → `status 'failed'` with the first failure's message (cap message when blocked),
  or `status 'cancelled'` after Cancel ("Inspection cancelled before any result arrived.").
- Something answered → `status 'complete'`; `record.status = 'partial'` if cancelled or any stage
  failed, else `'complete'`. ResultsPanel shows `qs-notice--partial` (Cancel, names unfinished parts)
  or a `qs-notice--error` per failed stage.
- Ledger: `LedgerEntry.status` gains `'cancelled'` (cost null, `costState: 'unavailable'`, shown as
  "Cost unknown"). `runChargeable` takes `signal` and settles at once on abort.

## Testing a new request

Store seam with fetch stubbed: see `src/stores/__tests__/requestPlan.spec.ts` (`networkEdge()`
routes fetches by body content, holds/releases them, honours abort). Register test-only requests with
`registerRequest()` (returns the undo). Registered production requests appear in every run, so
existing store specs that count fetches/ledger lines will need their counts updated when you add one.
