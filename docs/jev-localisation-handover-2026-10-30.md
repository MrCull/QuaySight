# Jev localisation implementation handover — 30 October 2026

Work is **incomplete**. Resume the approved spec; do not restart research or claim unfinished tickets are complete. The update below supersedes the historical checkpoint details that follow it.

## Latest update — consolidated `try-box`

- At this update the integration branch is `try-box`, at `59ee447` before this handover commit, pushed to `origin/try-box`. The user requested a single working branch: all five extra worktrees were removed, and the #118, #120 and #121 checkpoint branches were merged into `try-box` in `88a64ca`. Do not remerge or reset them. Check Git status and remote state before resuming.
- #116 and #117 were completed and closed. #118–#123 remain unfinished; confirm current GitHub issue state before closing anything. Work on #118, #119, #120 and #121 is already present on `try-box`; #122 and #123 still need investigation/final validation. The earlier references below to unmerged worktrees, a single-target implementation and an unfixed marking runner are historical.
- Damage localisation is optional, default-on, and gated by the provider catalogue to Jev 1.14 and the supported latest alias. Jev 1.13 and Luna do not receive Box questions. One optional request per eligible photo batches separate presence and Box questions for distinct assessed findings; a rejected or missing location leaves the finding intact. Present locations as approximate focal highlights, never as proof of damage or complete defect boundaries. Numbered-region marking crops remain in use.
- `d279c2a` added batching. `a885fcb` fixed a cancellation hang when an optional request waited for other photos: cancellation now settles it without a charge. Tests cover independent rejected batch answers, no Box questions for unsupported models, caps, replay, export and cancellation. `18578ad` adds a browser test opening each of two observations and checking its highlight disappears when viewing the other photo.
- `7be844d` adds results to the #120 crop report. The 81-call experiment found no evidence for adding a second crop localisation request on these samples; originals were already small enough to fit the provider. This does not settle whether cropping helps larger photos.
- `85aec69` fixes the #121 runner crash for incomplete IDs. `29f4181` adds resume with saved-request and image checks, plus pending markers for new live calls to prevent silent repeats after interruption. Credential-free verification on a copy replayed the 57 saved responses and stopped at the first missing request, `rear-door-chsu-22g1-2-id-native`; the prior ID was `CHSU???????` with unknown check digit. Existing evidence predates pending markers. The remaining live comparison is incomplete. See the marking report for resume instructions; do not overwrite original evidence or repeat paid responses.
- Validation after consolidation: `npm run check` passed after `a885fcb` (existing lint and bundle warnings); 63 focused unit tests passed. Photo viewer: 8 browser tests passed. Multi-photo: 6 existing browser tests and the new two-direction highlight test passed. A clean full unit run at `a885fcb` had 22 failures: 21 matching the original baseline plus a stale Jev question-order assertion. `59ee447` corrected that assertion and its 25-test suite passed; the whole suite has not been rerun since. Logs are local scratch only (`.scratch/current-unit.log`, `.scratch-baseline.log`) and may not survive. The project gate does not run tests.
- After handover commit `c95c0d4`, recorded replay, regression scoring and damage-localisation suites passed together: 3 files, 34 tests. These are offline/recorded tests, not additional live model results.
- A Chromium browser test also checked a synthetic Box overlay on a JPEG with EXIF orientation 6: the displayed image was upright and the overlay aligned to its displayed bounds. It does not establish model accuracy or cover every orientation/browser combination.
- Next: review the implementation and remaining ticket acceptance criteria, validate full unit/e2e and screenshots as appropriate, finish or clearly report the marking and reference-image experiments, verify unsupported-provider compatibility and multi-photo/replay/cost/cancellation behaviour, then complete the final review and close issues only when justified. Live research was authorised earlier, but no key is stored in the repository or persistent environment. Keep credentials out of source, logs, recordings and exports.
- The user asked to keep pushing completed work to `try-box` and to avoid permission prompts. Follow the current session's actual sandbox policy; do not rely on historical environment claims below.

## Historical checkpoint — superseded branch state

- Repository: MrCull/QuaySight. Integration branch: `try-box`, completed implementation tip `46ab4f6` before this handover commit.
- Spec: [GitHub #115](https://github.com/MrCull/QuaySight/issues/115), local [approved specification](jev-box-localisation-spec.md). Read AGENTS.md, the original product spec, design-system guidance and docs/agents/fast-and-cheap.md.
- Completed, merged, pushed and closed: **#116** research baseline and **#117** individual damage observations/source-photo viewer links. Both passed their final `npm run check`.
- All unfinished work is checkpointed on separate branches, intentionally **not merged** into integration. WIP checkpoint commits passed staged secret scans; expensive commit hooks/final gates were deferred explicitly for handover. These commits are not ready-for-review claims.

| Ticket | Branch / checkpoint | Existing worktree under `.claude/worktrees/` | State |
| --- | --- | --- | --- |
| #118 | `ticket/118-damage-localisation` / `4029456` | `damage-localisation` | Core implementation saved; final checks/review pending |
| #120 | `ticket/120-crop-research` / `2a39384` | `crop-research` | 81 live calls complete; report finalisation/checks pending |
| #121 | `ticket/121-marking-research` / `d2e0e7c` | `marking-research` | 57 live calls saved; harness failure and partial report pending |

All three branches start at integration `46ab4f6`. Worktrees are retained for continuation, with dependency junctions where agents created them. Earlier completed-ticket worktrees also remain. Do not delete worktrees until work has been reviewed/integrated. Check actual Git status before further changes.

## Historical task graph and constraints

Native GitHub subissues/dependencies of #115 are authoritative:

- #116 and #117 completed.
- #118 depends on both: finish and merge this next.
- #119 batching/multi-photo depends on #118; not started.
- #120 crop comparison, #121 marking comparison, #122 photographic references depend on #116. #122 is not started.
- #123 final verification/report depends on #119/#120/#121/#122; not started.

User approved extensive paid direct OpenRouter experiments, provisional visual assessment without human annotations, one optional localisation request per eligible photo, and a **default-on user toggle**. Preserve 50-request/$0.50 application caps, essential-read priority, cancellation, provider compatibility, raw replay/export and transient credentials. A box cannot create damage or raise severity. Preserve numbered-region ID crops unless comparative evidence supports a change.

The implement-spec workflow calls for fresh implementer agents in isolated worktrees, TDD at already approved plan/replay and browser seams, merger agents for integration, then code-review on the whole integration branch and a fresh agent fixing findings. Do not request the same scope/testing approvals again. The user asked to proceed without permission prompts. Latest environment is unrestricted with approval policy `never`; omit `sandbox_permissions`. Earlier agents had sandbox credential/index restrictions that may not apply to a new session.

## Completed baseline and actual live spend

Total saved paid responses: **183**, all HTTP 200, provider-reported cost **$0.039883620**:

| Study | Saved responses | Reported cost | Outcome |
| --- | --- | --- | --- |
| #116 full-photo baseline | 45 | $0.005861688 | Complete, reviewed and merged |
| #120 full/raw/padded damage | 81 | $0.012244386 | Complete, reviewed; unmerged |
| #121 markings | 57 | $0.021777546 | Partial; harness stopped on ID decoding error |

These are provider-reported research costs, not app inspection ledger entries. No automatic paid retries occurred. No paid reference-image experiment has run. Credentials are absent from branches, recordings and this handover; there is no configured OPENROUTER_API_KEY in the persistent environment. Obtain it through a secure transient mechanism for future calls. Never copy a supplied credential into source, issues, shell history, saved requests or exports.

Baseline report on integration: `docs/research/jev-box-baseline-2026-10-30.md`, with raw evidence, prepared images, SHA hashes, transforms, exact prompts/model/usage/cost/latency and all contact sheets. All 45 resolved to `typesafe/jev-1.14-20261014`; median latency321ms. Provisional presence >=.80 and box confidence >=.50 retained17/18 obvious-target repeats and rejected27/27 negative/ambiguous repeats. This is tuning on five photos, **not independent calibration**. Grey-side boxes clip the long crease; rectangles are approximate focal highlights, not complete defect boundaries.

Official docs conflict on minimum side (TypeSafe280 vs OpenRouter256); integration now uses stricter280 and has browser preparation coverage. OpenRouter Decisions remains the route.

## #118 implementation checkpoint

Main files: `src/plan/requests/damageLocalisation.ts`, its registry entry, `src/plan/requestPlan.ts`, `src/stores/inspection.ts`, `src/domain/damage.ts`, `src/components/{ProviderSelect,PhotoViewer}.vue`, `src/components/damage/DamageEvidence.vue`, design-system viewer/control docs, preview and bundle CSS. Tests: new `src/plan/__tests__/damageLocalisation.spec.ts`, modified `e2e/photoViewer.spec.ts`.

Implements one conservative existing observation, strict raw presence/confidence/finite ordered in-bounds geometry guards, optional request/replay/export, default-on setting, correct source association including duplicate-name protection, fitted-original overlay, zoom and original view. A global deferred-read barrier prevents localisation charges until every photo's essential reads settle. Eligibility currently requires exactly one clear high-probability single-type non-surface observation; cropped door assessments deliberately remain unlocated. #119 must extend batching and multi-photo selection without transferring coordinates across observations/photos or inventing defect identity.

Agent-reported validation:16 new plan tests passed; earlier47-test compatibility run passed; type-check and build-only passed; synthetic highlight browser test passed using unique port5288. **Latest five browser fallback cases were saved but not run**; focused lint was interrupted. Still required: inspect latest browser helper, final integration merge, focused/full appropriate checks, screenshot verification, final gate and code review. Do not claim #118 complete or merge blindly.

## #120 completed experiment, unfinished report

Files on its branch: `scripts/jev-crop-{experiment,review}.mjs`, `src/domain/cropCoordinates.ts` and tests, `docs/research/jev-crop-2026-10-30.md`, research index and evidence directory `docs/research/evidence/jev-crop-2026-10-30/` (81 responses and18 review sheets).

Matrix: grey side, torn CAI door, ambiguous JDLU side; three exact baseline prompt variants; three repeats; fresh full-photo, raw seed crop and .35 padded seed crop. Seed is fixed baseline specific-1. Actual original-resolution cropPhoto geometry maps back to upright original coordinates. All81 responses resolve to `typesafe/jev-1.14-20261014`;291533 input/3078 outputtokens; summed latency28.252s.

Agent reviewed actual boxes: full-photo clear targets pass provisional guards18/18; raw/padded clear targets0/36; JDLU0/27. Raw CAI selects a placard; padded CAI approximates the torn flap but confidence .27–.39. Grey raw shrinks the focal region (confidence .08–.15), padded .13–.48. All geometry valid. Original samples already fit the provider, so crops enlarge rather than recover hidden original detail. **No supported crop advantage**; keep extra crop localisation research-only.

Reported per-condition9-call totals (presence/confidence ranges; cost; median):

- CAI full .89–.98/.58–.69; $0.000651336;274ms. Raw .62–.76/.14–.22; $0.001904154;349ms. Padded .81–.94/.27–.39; $0.002158464;401ms.
- Grey full .91–.99/.53–.67; $0.000723324;319ms. Raw .35–.50/.08–.15; $0.000809046;248ms. Padded .84–.94/.13–.48; $0.001529052;275ms.
- JDLU full .33–.46/.15–.22; $0.001707342;340ms. Raw .35–.43/.04–.06; $0.001063314;314ms. Padded .28–.42/.04–.16; $0.001698354;417ms.

23 geometry/crop tests across2 files passed; focused lint passed; dry preparation27conditions and offline render passed. **Draft report still needs these final results and limitations incorporated**, followed by merge/check/review. No final npmcheck was run.

## #121 partial marking experiment and known harness bug

Files: `scripts/jev-marking-{experiment,review}.mjs`, `docs/research/jev-marking-provisional-labels-2026-10-30.json`, draft `docs/research/jev-markings-2026-10-30.md`, research index and `docs/research/evidence/jev-markings-2026-10-30/`.

Planned matrix:7 photos x3 repeats, multiplexed native presence/boxes vs numbered regions, then native/padded/hybrid/region crops and app ID/ISO/weight/seal read questions. There are no true DG diamond placards in selected samples; yellow SUPER HEAVY triangles are not DG placards. Provisional target labels were visually chosen before live answers, not expert ground truth.

**Actual stop reason:** after saving57 HTTP200 responses, the runner exited1 because `checkDigitMatches` throws on incomplete ID strings:

```text
page.evaluate: Error: ISO 6346 check digit needs four letters followed by six digits
... scripts/jev-marking-experiment.mjs ... bridge ...
```

Last saved response: `rear-door-chsu-22g1-2-id-regions`. COYU all3 repeats and CHSU first repeat are present; CHSU repeat2 is partial. The failed decode happened **after** the paid response was saved. Preserve and decode that response offline; do not pay for it again. Fix incomplete/invalid-ID handling as an observable unread outcome. Free dry run tested complete COYU IDs and missed this case.

Runner does **not** currently resume completed calls: saved files use exclusive writes, so rerunning same output path fails. Implement deliberate checkpoint/resume or select only missing work in a new evidence folder, with correct denominators and distinct run provenance. Never overwrite raw data. No conclusion about all7photos is supported yet. Draft report is a method scaffold, and its retain-regions statement is conservative, not a completed measured comparison. Existing production regions remain unchanged.

39 focused region/crop/replay tests passed; all7photo free bridge exercised question imports/maps/crops, with complete COYU checkdigit; offline dry review passed; earlier focused lint passed. Last metadata/review edits formatted but not finally checked. No final merge/npmcheck/report/review.

## Validation baseline and continuation

Unchanged `f23abdc` full nonlive unit baseline:8 failing files/21 failing tests;129 files/1216 tests passed (1237 total). Existing failures: ManifestRetry2, doorDamage1, PhotoCrop1, App1, newInspection3, luna1, demoMode2, demoSamples10. Root ignored `.scratch-baseline.log` has exact failures if retained. Do not confuse these with new regressions. Live suites were excluded.

Historical replay+score baseline:10 tests passed; original fields Luna38/48, Jev42/48; all fields Luna64/84, Jev75/84. No historical recordings rewritten. Completed #117:62 focused tests,3 browser tests,2 screenshot checks and npmcheck passed. Completed #116:29 focused provider/fit tests,3 browser preparation tests and postmerge npmcheck passed. Root baseline viewer/preparation4 browser cases passed9.5s.

Windows sandbox browser runs initially hung on preview-server teardown; host execution and unique ports fixed it. Avoid stale5173 preview servers. Temporary external-server config under root `.scratch/` is optional local scratch, not a committed project interface. Required screenshot runner has targeted state options; use only touched states. No background API experiments or agent jobs should be left running at this handover; root stopped its external4186server, and ticket agents reported no jobs.

Resume by inspecting branches/worktrees and this document, finishing #118, finalising #120, fixing/resuming #121, then #119/#122/#123 according to GitHub dependencies. Merge completed branches into try-box using fresh merger agents; research README edits may conflict. Close tickets only after acceptance checks. Run the final code-review skill and address findings, then final verification and push. Do not mark #115 complete before the remaining work is actually finished.
