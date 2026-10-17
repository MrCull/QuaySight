# AGENTS.md

## Project

Quay Sight is a Vue 3 + Vite + TypeScript app that inspects photos of freight containers. The product spec is `spec/original-spec-idea.md`. Read it before changing behaviour.

## Scope and tech

A static, browser-only app (no backend, no relay). The presenter enters a provider key, which is kept in memory only. They then pick 1–4 photos of one container, and the inspection starts as soon as the photos are chosen. A recorded demo mode with bundled samples needs no key.

- **Output:** container ID (ISO 6346 check digit, owner-code list), size/type code, length, weights, seal, placards, and damage on a flat schematic. Each value has a certainty. It is not a certified survey.
- **Providers:** OpenAI GPT-6 Luna (Decisions API) and Jev, reached through OpenRouter (`docs/adr/0001-*`). One model at a time. Catalogue in `src/domain/providers.ts`.
- **Spend cap:** 30 requests and $0.50 per container inspection. The cost indicator shows the container and session totals.
- **Layout:** `src/domain/` is pure logic, with no Vue and no I/O. `src/services/` does provider calls and image work. `src/stores/inspection.ts` is the Pinia store that runs the stages (`store.start()`). `src/plan/` is the request plan. `src/components/` is the UI. `src/regression/` scores recorded runs.
- **Stack:** Vue 3, Pinia, vue-router, Vite, Vitest with jsdom, Playwright, oxlint, ESLint and oxfmt. The package manager is pnpm.
- **Tests:** `*.live.spec.ts` hit real APIs and are skipped unless `OPENAI_API_KEY` or `OPENROUTER_API_KEY` is set. Some unit tests currently fail on `main` (`PhotoCrop`, `ManifestRetry`, one `App` test), so compare against a stash before blaming a change.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — type-check, then production build
- `npm run type-check` — `vue-tsc --build`
- `npm run test:unit` — Vitest
- `npm run test:e2e` — Playwright
- `npm run lint` — oxlint and ESLint (both apply `--fix`)
- `npm run format` — oxfmt on `src/`
- `npm run check` — the gate CI runs: lint:check, token ratchet, type-check, build. Tests are off for now; `npm run check:tests` runs unit and e2e, `npm run check:all` runs everything. Pre-commit hooks live in `.githooks/`, enabled by `pnpm install`.
- Running agents cheaply and quickly: `docs/agents/fast-and-cheap.md`.

## Shared hotspots

Parallel tickets should not both edit `src/App.vue`, `src/styles/results.css`, `src/domain/inspection.ts` or `src/stores/inspection.ts`.

## Live-API facts

Facts about the live provider APIs are in `docs/research/` (see its README). Each note carries its check date; re-check before relying on one.

## Design system

All UI work follows `design-system/`. Read `design-system/README.md` before building or changing any screen.

- Build Vue components from the `qs-*` markup in `design-system/components/<Name>/preview.html`, following that component's `README.md`. `ResultsScreen` shows the main screen assembled.
- Style with tokens only (`var(--…)` from `design-system/tokens.css`). No hard-coded colours, font sizes or spacing, and don't re-colour `qs-*` components locally.
- Certainty, damage severity and hazard markings are three separate visual axes; never mix their colours. Nothing is green.
- Status words are fixed: **Confident**, **Likely**, **Uncertain**, **Can't tell**, **Not seen**. Never use "supported", "verified", "safe" and similar.
- Never show passes, refinement, candidates or retries in the UI. Show the best value, its certainty and any plausible alternative.
- Results arrive with the `.qs-arriving` → `.qs-arrived` choreography; respect reduced motion.
- To change a token, edit `design-system/tokens.json` and regenerate `tokens.css` (see the design-system README).

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on MrCull/QuaySight, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
