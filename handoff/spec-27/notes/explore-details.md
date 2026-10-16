# Exploration: #31 crop read, #32 container details, #34 weights/units (spec #27)

Paths relative to /home/user/QuaySight, explored at main 99ac2d3 (before #28/#29/#30 merged — re-check against the integration branch; read notes/request-plan.md and notes/question-format.md first).

## Shared
- Hotspots: `src/App.vue`, `src/styles/results.css`, `src/domain/inspection.ts`, `src/stores/inspection.ts`. #31–#34 all need record fields; use #28's plan seam.
- Pre-#28 store: `startLive()` prepares photo via `preparePhoto`, keeps `this.sentPhoto` (markRaw Blob), one `ledger.run({purpose:'Reading markings', call})`. The Jev `box` was mapped but dropped (never on the record).
- `src/stores/setup.ts` has the guarded `storage()` localStorage helper (only localStorage user).
- No root `CONTEXT.md`; one ADR `docs/adr/0001-openrouter-no-typesafe-direct-no-relay.md`.

## #31 Jev crop read
- `src/domain/jev.ts`: `jevQuestions({image, box})` adds `container_box`; `readBox()` validates (edges in [0,1] + confidence); `JevBox {top,bottom,left,right,confidence}`; `mapJevResponse()` → `JevMapping {containerId, resolvedModel, usage, reportedCostUsd, box}`.
- `src/domain/openrouter.ts`: `buildOpenRouterJevRequest(model, dataUrl, {box})`, `mapOpenRouterJevResponse()`. `src/services/openrouter.ts`: `callOpenRouterJev(...)` is the live Jev route. `src/services/jev.ts` (TypeSafe direct) is not in the catalogue — ignore.
- `src/domain/providers.ts`: `supportsBox(provider, model)`, `findModel()`. box true for `~typesafe/jev-latest`, `typesafe/jev-1.14`; false for jev-1.13 (400 on box) and both Luna entries. `JEV_LIMITS` 256–1568 px/side, 78,400–2,458,624 px total; `LUNA_LIMITS` max side 2048.
- `src/domain/photoFit.ts`: `fitPhoto` is pure and NEVER enlarges — add a separate pure "upscale within limits" function for the crop.
- `src/services/preparePhoto.ts` (decode/fit/encode JPEG, throws `PhotoPreparationError`); `src/services/imageCodec.ts` `decodePhoto()` → `{width,height,toJpeg(w,h),close()}` draws whole image only — add e.g. `toJpegRegion(sx,sy,sw,sh,w,h)` (drawImage 9-arg).
- `src/services/__mocks__/imageCodec.ts`: fake photo blob text `"WxH"`, `toJpeg` → `"jpeg WxH"`; extend similarly (e.g. `"jpeg-crop ..."`) so store tests can assert the crop reached request D.
- Reuse: `src/domain/recheck.ts` `mergeRecheck` (fills unread only — prior art; crop needs "more confident wins + note disagreement"); `src/domain/luna.ts` `ChoiceReading {value, certainty, runnerUp}` + `assembleLunaReading(readings)`; `src/domain/certainty.ts` `CERTAINTY_LABELS`, `applyMargin`, `certaintyOfProbability`.
- Fixtures with a real box: `src/fixtures/live/openrouter-jev-smoke.json` (CHSU, `container_box` {top .21,bottom .27,left .6,right .73}, conf .79); `src/fixtures/live/openrouter-probe.json` (`jevScoreAndBox`, `boxOnJev113` 400).
- Prior-art tests: `src/stores/__tests__/liveOpenRouter.spec.ts`, `photoPreparation.spec.ts`; `src/domain/__tests__/photoFit.spec.ts`, `jev.spec.ts`; `src/services/__tests__/openrouterJev.live.spec.ts`.
- Pitfalls:
  - `mapJevResponse` hides per-position readings (only `positionCertainty`); expose them (as `mapLunaResponse` does via `readings`) or use #29's mapper.
  - `ChoiceReading` has no raw probability; "more confident" can only compare labels unless added.
  - Jev `readChoice` turns "Can't tell" into null value — one-side-missing is common.
  - `calculateCheckDigit` (`src/domain/iso6346.ts`) THROWS unless `[A-Z]{4}\d{6}`; guard as `assembleLunaReading` does.
  - Box fractions are of the prepared/sent photo (`sentPhoto`); crop from it. COYU is 1079×1080; keep crop ≤1568/side, ≤2,458,624 total, ≥256 short side (add margin/pad).
  - Node live specs have no canvas (Jev smoke sends CHSU unresized; APHU 2048×1536 is refused "Invalid image dimensions"). For a COYU crop smoke: crop via Playwright/browser, or pre-crop and commit a sample.
  - Luna never gets a crop; Jev 1.13 never gets D.
  - Ledger: `useLedgerStore().run({id, inspectionId, purpose, provider, endpoint, model, call})` wrapping `runChargeable` (`src/domain/ledger.ts`); purposes are outcome-worded (e.g. `RECHECK_PURPOSE = 'Closer look at the ID'`).

## #32 Container details
- `src/domain/inspection.ts` (hotspot): `InspectionRecord` (schemaVersion 1): `containerId`, `damage`, `sizeCode: DecodedSizeCode|null`, `weights: WeightChecks|null`, `rechecks?`. `Provenance` = printed|decoded|calculated|candidate|manifest|unresolved.
- `src/domain/isoSizeCode.ts`: `decodeSizeCode(code, certainty)` → `DecodedSizeCode {code, certainty, length{feet,label}, height{highCube,label}, width{label}, type{label}, summary}` or null. Tables tiny: length '2'→20ft, '4'→40ft; height '2'→8'6", '5'→9'6" HC; type G,R only; width hard-coded 8 ft; type keyed on 3rd char only. Needs 22G1, 42R1, 45G1 (=40ft HC), U open top, T tank, P flat rack, unknown codes. Tests: `src/domain/__tests__/isoSizeCode.spec.ts`.
- `src/components/ContainerDetails.vue`: rows ISO CODE (Printed), LENGTH/HEIGHT/WIDTH (Decoded from ISO), MAX GROSS, TARE (Printed), PAYLOAD (Calculated, `qs-prov--calculated`). Shows "Not assessed in this inspection: this run read the container ID only…" when sizeCode and weights both null (`assessed` computed) — must change. Labels are uppercase strings asserted in `src/components/__tests__/ContainerDetails.spec.ts`, `ResultsPanel.states.spec.ts`.
- `src/components/ResultsPanel.vue`: ID card, `ManifestRetry`, `<ContainerDetails v-if="record">`, `ExportActions`. No markings/equipment card exists.
- DS: `design-system/components/MarkingBadge/` (`qs-marking`, `qs-marking--hazard` diamond only for DG/safety: SUPER HEAVY, overwidth, marine pollutant, fumigation; neutral for high-container stripes and "No DG placard visible"; `qs-marking__caveat`). `FieldRow/README.md` ("Not assessed" rule), `ProvenanceTag/README.md` (Printed, Decoded from ISO, Calculated, Alternative, Model-selected `qs-prov--model` — fits whole-code choice answers). `ResultsScreen/preview.html` ~252–260 shows intended Equipment and Markings cards (`.rs-marks` CSS only inline in that preview).
- `src/domain/exports.ts`: `buildInspectionExport()` pushes sizeCode values (~165–188); `buildSummaryText()` prints "Size code (decoded)". Both need new fields.
- Request shapes: `src/domain/luna.ts` `LunaChoiceQuestion`; `src/domain/openrouter.ts` `choiceQuestions()`. Build the survey on #29's format.
- Recorded data: `src/fixtures/recorded.ts` `recordedFixtures.luna` (45G1, maxGross 32500, tare 3870, printedNet 28630 — hand-made) → `src/domain/demoSamples.ts` via `decodeSizeCode`/`checkWeights`. Keep working until #37.
- Pitfalls: certainty/hazard/severity separate; hazard colours only inside `qs-marking--hazard`. Copy: "No DG placard visible", never "Non-hazardous"; high-container ≠ overwidth; "Not seen" = in no photo, "Not assessed" = not asked. OpenAI 200 q/request, 255 choices/question, object choices (`MANIFEST_OPTIONS_PER_QUESTION = 255` in `src/domain/manifest.ts`). Size code = whole-code choice incl. other/unreadable/not_visible.

## #34 Weights kg/lb + units toggle
- `src/domain/weights.ts`: `WeightRow {valueKg, provenance, certainty}`, `WeightInputs {maxGrossKg, tareKg, printedNetKg, certainty}`, `WeightChecks {maxGross, tare, payload, conflict}`; `checkWeights()` payload = gross − tare, exact-equality mismatch → conflict + payload ≤ Uncertain. kg only. Private `weaker()` reusable. Tests `src/domain/__tests__/weights.spec.ts`.
- `ContainerDetails.vue` formats `toLocaleString('en-GB') + " kg"`; MAX GROSS note "A maximum rating, not the cargo weight." — keep.
- `src/domain/exports.ts`: `ExportValue.unit?: 'kg'` (line 22) kg-only — extend for lb, m³, cu ft; `formatKg`, `buildSummaryText` (~290–360) kg-only. Exports always both units.
- Storage pattern: `src/domain/rememberedSelection.ts` (pure, key `quay-sight.selection`, validating reader) + `src/stores/setup.ts` guarded `storage()`; tests `rememberedSelection.spec.ts`, `src/stores/__tests__/setup.spec.ts`. Suggest key `quay-sight.units`, default metric, display only.
- DS: `bundle.css` line 28 lists `.qs-seg__opt:focus-visible` but NO `.qs-seg` styles/component exist — add a DS segmented-toggle component (preview + README). `FieldRow/README.md`: "`32,500 kg`, never the lb value in the kg slot; keep MAX GROSS, TARE, PAYLOAD separate rows".
- COYU expected (ticket): 30,480 kg / 67,200 lb; 2,180 / 4,810; 28,300 / 62,390; 33.2 m³ / 1,173 cu ft.
- Pitfalls: 1 kg = 2.20462 lb, ±0.5%; printed-vs-calculated payload uses the same tolerance (today exact). E is exactly one plan request with its own ledger line, on a crop when a weights box exists — share #31's crop helper. Certainty ordering duplicated in `weights.ts` (`ORDER`), `jev.ts`, `luna.ts` (`worstOf`) — could centralise in `certainty.ts` (not a hotspot). Put new styles in DS bundle or a new stylesheet, not `results.css`.
