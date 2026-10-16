# Exploration: #36 What we found, #37 demo recordings, #38 DS parity (spec #27)

Paths relative to /home/user/QuaySight, explored at main 99ac2d3 — re-check against the integration branch.

## #36 What we found
- No component exists. Intended markup: `design-system/components/ResultsScreen/preview.html` ~234–238 (`.rs-summary` > `.rs-k` "What we found", `h1.rs-headline` with `<em>` in damage-fg, `<p>`, `.rs-stats` > `.rs-stat`). CSS only inline in that preview (37–43) with hard-coded px — add a proper DS component (`design-system/components/WhatWeFound/` README + preview, tokens / `.qs-type-*` only) first.
- DS README: the app says "we" ONLY in What we found; fixed status words; caveats first ("two beats": Best interpretation / What remains uncertain).
- Align with `buildSummaryText(record)` in `src/domain/exports.ts` (~310). New pure builder e.g. `src/domain/whatWeFound.ts` + tests.
- Inputs: `record.containerId` with `idResultState()`, `visibleAlternatives()` (`src/domain/certainty.ts`); `record.sizeCode.summary`; weights (toggle units, #34); markings/DG (#32); damage verdict / "not assessed for this view" (#33/#35); partial status (#28; status was running|complete|failed).
- Placement: DS puts it under the photo in left column (`rs-left`, after PhotoPanel) in `src/App.vue` (hotspot); spec says top of result.
- Arrival: wrap in `qs-rise` with `--i`; `.qs-arriving`→`.qs-arrived` driven by `App.vue` `stageClass`; see `src/__tests__/ArrivalChoreography.spec.ts`; respect `qs-reduced-motion`.
- e2e: `e2e/demo.spec.ts`, live mocked specs; harness states in `e2e/screens/capture.spec.ts`.

## #37 Demo recordings + research note
- `src/domain/demoSamples.ts`: `DEMO_SAMPLES` = rear-aphu (luna, gpt-6-luna), side-dented (luna), rear-chsu (openrouter, `~typesafe/jev-latest`). `recordingFor(id)` → `SampleRecording {resolvedVersion, containerId, sizeCode, weights, damage, body, retryFailureMessage}`; `runDemoSample()` wraps as `InspectionRecord` `source:'recorded'`, `rawResponses[{capturedFrom:'recorded-fixture'}]`; `runDemoManifestRetry()`.
  - rear-aphu HAND-MADE (`recordedFixtures.luna`, `src/fixtures/recorded.ts`); side-dented HAND-MADE (`recordedSideDamage`, `src/fixtures/recordedDamage.ts`, no ID); rear-chsu REAL (`mapOpenRouterJevResponse(src/fixtures/live/openrouter-jev-smoke.json)`). COYU is not a demo sample.
- Photos imported as Vite assets (`import aphuPhoto from '../../samples/rear-door-aphu-45g1.jpg'`).
- `src/fixtures/live/` shape `{recordedAt, endpoint, requestedModel, photo, response}` (raw body, no headers/key): `luna-smoke.json` (OpenAI APHU), `openrouter-jev-smoke.json` (CHSU, `typesafe/jev-1.14-20261014`, has `container_box`), `openrouter-luna-smoke.json` (APHU, `openai/gpt-6-luna-decisions-20261006`), `openrouter-probe.json`.
- Live smoke specs `src/services/__tests__/{luna,jev,openrouterJev,openrouterLuna}.live.spec.ts`: `describe.skipIf(!apiKey)`, keys from env (`OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `JEV_API_KEY`, optional `OPENROUTER_JEV_MODEL`); capture raw body via wrapping fetchImpl, `writeFile` fixture, assert no key in it; behind a proxy they install undici `EnvHttpProxyAgent` (see header of `openrouterJev.live.spec.ts`); jsdom env, no canvas — photos sent as-is.
- `src/__tests__/recordedInspection.ts` test-only builder.
- Pitfalls: `luna-smoke.json` is read by `src/stores/__tests__/photoPreparation.spec.ts`, `newInspection.spec.ts`, `e2e/photoPreparation.spec.ts`, `e2e/newInspection.spec.ts`, `e2e/screens/capture.spec.ts` (also `openrouter-luna-smoke.json`); `demoSamples.ts` imports `openrouter-jev-smoke.json`. Live specs overwrite their fixture — write plan recordings to NEW files (e.g. `src/fixtures/live/plan/<sample>-<model>.json`, one entry per request). `SampleRecording` has one body; plan needs one `rawResponses` entry per request. Replay must go through the live mappers. Label "Recorded demonstration: [provider/model]" from `recordedDemonstrationLabel()` (`src/domain/providers.ts`); `DemoSample` has a single provider/model but spec wants both models. `e2e/demo.spec.ts` asserts tile names ('Rear doors with markings', 'Damaged grey side', 'Clean grey rear doors') and the side sample's manifest offer finding no match; `src/domain/__tests__/demoSamples.spec.ts`, `unidentifiedSample.spec.ts`.
- Research note `docs/research/live-api-findings-2026-10-16.md` (sections: browser reach, OpenRouter request/response, model ids, live smoke runs ~76, Jev image limits, cost, errors). Add question-design findings (with check date); link from `docs/research/README.md`.
- `npm run check:secrets` (`scripts/check-secrets.mjs`); `KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g` in `src/domain/providerErrors.ts`.

## #38 Design-system parity
- `design-system/README.md` embeds two huge base64 JPEGs on lines 9 and 13 (~145 KB) — read with offsets / skip long lines. Lines 92–102: token build, import `tokens.css` + `components/bundle.css` once in `src/main.ts`, `.qs-root`.
- `design-system/components/<Name>/{README.md,preview.html}`; preview starts `<!-- @dsCard group=… height=… subtitle=… -->`, links `../../tokens.css` + `../bundle.css`, `body class="qs-root"`. Components: AnalysingScreen, Button, CertaintyChip, ContainerId, ContainerSchematic, CostIndicator, Cover, DemoBanner, FieldRow, FindingCard, ManifestRetry, MarkingBadge, NewInspection, Notice, PhotoDrop, ProvenanceTag, ProviderSelect, ResultsScreen, RunChip, SettingsChip, SettingsDrawer, SetupCard, SeverityBadge, StageProgress.
- `bundle.css` (~503 lines) all `qs-*` CSS + glyph masks (`qs-glyph--{confident,likely,uncertain,unknown,unseen,hazard,error,photo,recorded,list,check,cross,chevron,eye,upload}`).
- `design-system/tokens.json` source → `tokens.css` via `design-system/scripts/build-tokens.py`. Families: color (dark/light), type (`.qs-type-*`), spacing `space-1..8`, radius, shadow, size (`control-sm/md/lg`, `marker`), duration.
- `ResultsScreen/README.md` "In the app today" lists deliberate gaps (What we found, thumbnail strip, photo areas, Markings, Export placement) — update as gaps close.
- `StageProgress/README.md`: `qs-stage--done|active`/pending; DS stage copy *Reading markings*, *Looking for damage*, *Checking the details*, *Putting the results together*; app copy in `src/domain/analysingStages.ts` (`ANALYSING_STAGES`) + `src/components/AnalysingStages.vue`. Reconcile with spec stage names; DS bans machinery words.

## Token ratchet
- `scripts/check-tokens.mjs` scans `src/**/*.{vue,ts,css}` only: hex, rgb()/hsl(), px font-size, px `font:`, px padding/margin/gap. Baseline `scripts/token-baseline.json` = `{"src/styles/damage.css": 3, "src/styles/results.css": 9}`; new file with any violation fails. `--list`, `--write-baseline` (ratchet down only). Tests `scripts/check-tokens.test.mjs`. Line-based (a hex in a .ts string counts). Inline `style="--i: 1"` fine.

## Screenshot harness
- `npm run screenshots` → `e2e/screens/run-screenshots.mjs` (build-only, Playwright `CI=1 QS_SCREENSHOTS=1`, preview 4173); `e2e/screens/capture.spec.ts` `CAPTURES: Capture[] {state, screen, steps, motion, viewports?, reducedMotion?, liveBody?, run(page)}`; viewports 1440×900, 1366×768, 390×844; output `screenshots/` + `index.json` (git-ignored).
- Pitfall: `guardNetwork()` answers EVERY Decisions POST with one `liveBody`; with parallel requests route by request body (question names). Same for `e2e/liveErrors.spec.ts`, `newInspection.spec.ts`, `photoPreparation.spec.ts`.
- Other e2e: `layout.spec.ts` (no horizontal scroll), `setup.spec.ts`, `demo.spec.ts`, `vue.spec.ts`.

## Gaps tickets will hit
- No segmented toggle DS component (`.qs-seg` only a focus selector) — Metric/Imperial.
- No `sev-cosmetic` token.
- No DS classes for What we found (preview-only CSS).
