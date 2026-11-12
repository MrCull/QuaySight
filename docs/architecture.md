# Architecture

Quay Sight is a Vue 3 + Vite + TypeScript single-page app. It has no backend.

## Layout

| Path | Role |
| --- | --- |
| `src/domain/` | Pure logic. No Vue and no I/O. Providers catalogue, question sets, ISO 6346, owner codes, certainty, combining photos, CEDEX damage, ledger and caps, key facts, exports |
| `src/services/` | Provider calls and image work: Decisions requests, photo preparation, scaling and cropping, downloads |
| `src/plan/` | The request plan: one module per request, a registry, a replay of recordings, the record being drafted |
| `src/stores/` | Pinia stores. `inspection.ts` runs the stages (`store.start()`); `ledger.ts` tracks cost; `setup.ts` holds provider, model and keys |
| `src/components/` | UI built from the design system's `qs-*` components. `damage/` holds the schematic and findings |
| `src/composables/` | Shared Vue logic: theme, units, loupe, reduced motion |
| `src/regression/` | Scores recorded runs against `expected.json` |
| `src/fixtures/` | Recorded demo runs and live smoke responses |
| `design-system/` | Tokens, component READMEs and previews |
| `samples/` | Bundled sample photos |
| `e2e/` | Playwright tests; `e2e/screens/` is the screenshot harness |
| `docs/`, `spec/` | These docs and the product spec |

Shared hot spots that parallel work should not edit together: `src/App.vue`, `src/styles/results.css`, `src/domain/inspection.ts`, `src/stores/inspection.ts`.

## Data flow

1. `SetupCard` and `SettingsDrawer` write the provider, model and key into the setup store.
2. Choosing photos calls `store.start()`. The store prepares the photos and builds the request plan for the selected model.
3. Each request's reply is mapped by its own module into fields of a draft `InspectionRecord`. The store updates the record as answers land, so the screen fills in part by part.
4. Every chargeable call goes through the ledger, which enforces the caps and records usage and cost.
5. `domain/` functions combine per-photo readings, validate against standards and derive the key facts the tiles show.
6. Exports are built from the same record.

## Providers

The catalogue is in `src/domain/providers.ts`. A model entry says who makes it, how it is reached, which wire format it speaks, its photo limits and whether it accepts box questions. Wire formats are `openai-decisions` and `openrouter-decisions`. The direct TypeSafe adapter is kept in the code but removed from the selector (see ADR 0001). To add a provider, add a catalogue entry and a wire adapter. The results experience doesn't change.

## Design system rules

- Build UI from `qs-*` markup in `design-system/components/<Name>/preview.html`.
- Style with tokens only (`var(--…)`). No hard-coded colours, sizes or spacing.
- Status words are fixed. Never show passes, refinement, candidates or retries.
- Results arrive with the `.qs-arriving` to `.qs-arrived` choreography, and respect reduced motion.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check, then production build |
| `npm run type-check` | `vue-tsc --build` |
| `npm run test:unit` | Vitest (jsdom) |
| `npm run test:e2e` | Playwright |
| `npm run lint` / `npm run format` | oxlint and ESLint with fixes / oxfmt |
| `npm run check` | The CI gate: lint, token ratchet, docs image check, type-check, build |
| `npm run check:tests` | Unit and e2e tests |
| `npm run screenshots` | Builds, then captures the screenshot set into `screenshots/` |

The package manager is pnpm. Tests named `*.live.spec.ts` call real APIs and are skipped unless `OPENAI_API_KEY` or `OPENROUTER_API_KEY` is set.

## Related reading

- `spec/original-spec-idea.md`: full requirements and change log.
- `docs/adr/0001-openrouter-no-typesafe-direct-no-relay.md`: why Jev goes through OpenRouter and there is no relay.
- `docs/research/README.md`: checked facts about the live APIs.
- `docs/agents/`: notes for AI agents working on the repo.
