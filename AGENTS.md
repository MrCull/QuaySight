# AGENTS.md

## Project

Quay Sight is a Vue 3 + Vite + TypeScript app that inspects photos of freight containers. The product spec is `spec/original-spec-idea.md`. Read it before changing behaviour.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — type-check, then production build
- `npm run type-check` — `vue-tsc --build`
- `npm run test:unit` — Vitest
- `npm run test:e2e` — Playwright
- `npm run lint` — oxlint and ESLint (both apply `--fix`)
- `npm run format` — oxfmt on `src/`

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
