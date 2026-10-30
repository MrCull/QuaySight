# Jev damage localisation baseline — ticket #116

Checked: 30 October 2026. Integration baseline: `f23abdc` (`try-box`). This report separates historical replay, synthetic browser checks and newly paid research. It does not establish expert ground truth or a production localisation strategy.

## Repository audit and historical baseline

- `src/domain/idQuestions.ts` already asks `container_box` on Box-capable models. Survey question families also retain marking boxes (weights, seal, placards). `src/domain/providers.ts` gates Box to Jev latest and 1.14; Jev 1.13, Luna and unknown models are excluded.
- `src/plan/requests/idCropRead.ts` and `sealZoom.ts` use numbered regions; `weightCheck.ts` prefers numbered regions, falling back to a native marking box. Existing ID crop reads do not use native boxes. The prior clipped COYU example must remain in marking comparisons.
- `src/plan/registry.ts`, `sideDamage.ts` and `doorDamage.ts` contain assessment requests, with no damage Box execution path. This ticket adds none. Existing valid damage findings, routing, ledger, cancellation, exports and replay mapping are unchanged.
- `samples/` contains ten photos: three standalone rear doors, a dented grey side, a torn CAI corner, a COYU seal close-up and four JDLU views. `src/regression/expected.json` describes six inspections. Damage expectations are coarse `none`/present labels, with no independent defect rectangles or physical-defect correspondence labels.
- Before behaviour changes: full nonlive baseline at unchanged `f23abdc`, run by the integration agent: 129 test files passed, 8 failed; 1,216 tests passed, 21 failed (235.29 s). Failures occur in ManifestRetry, doorDamage, PhotoCrop, App, newInspection, luna, demoMode and demoSamples. Unrelated live suites remained disabled. These are pre-existing failures, not evidence about Box quality.
- Focused replay/score baseline: `src/plan/__tests__/replay.spec.ts` and `src/regression/__tests__/scoreRecordings.spec.ts`: 2 files / 10 tests passed. Historical recordings were not rewritten. Original score fields: Luna 38/48, Jev 42/48; all fields: Luna 64/84, Jev 75/84. Those are field-level replay scores, not new model calls or localisation accuracy. Both models read the labelled door IDs; grey-side ID is missing. Jev COYU tare/payload and COYU seal remain misses; Luna CHSU/APHU weights remain unread. Damage presence scores hit all six coarse inspection labels on each route.

## Official contract recheck

Sources accessed 30 October 2026:

- [TypeSafe Box](https://docs.typesafe.ai/primitives/box): Jev 1.14 supports one rectangle per Box question. Answers have fractional `top`, `bottom`, `left`, `right` and a separate confidence. Box has no absent-target answer: pair a presence question and disregard unsupported boxes. The documentation gives no recommended confidence threshold. Several indistinguishable defects need ambiguity handling, not an invented union.
- [TypeSafe Images](https://docs.typesafe.ai/images): PNG/JPEG, 16 MiB decoded file limit, 280–1,568 pixels each side, 78,400–2,458,624 total pixels. Body, processed images and expanded request each have a 32 MiB limit; repeated references count again in expanded input. EXIF is stripped without rotation, so pixels must be upright before upload. Asset base64 uses standard padded encoding without a data-URL prefix. Direct image requests need the experimental image header.
- [TypeSafe Models](https://docs.typesafe.ai/models): direct IDs `jev-1.14.0` and `jev-1.13.0`; both direct aliases now resolve to 1.14.0. Direct default context is 64k/request and 32k/question; the long-context header raises both to 262k. Published input price remains $0.042/Mtoken, output free. These are direct-provider facts, not substitute evidence for OpenRouter alias resolution or billing.
- [OpenRouter Multimodal Decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions): `POST /api/alpha/decisions`, JSON `state` array with plain instruction string and `image_url` data URL; Jev only accepts PNG/JPEG. Assets/reference encoding is also supported; multipart `part` is not. Jev Box models are `typesafe/jev-1.14` and `~typesafe/jev-latest`; 1.13 lacks Box. Image requests use TypeSafe long-context mode. The page still says 256-pixel minimum, conflicting with TypeSafe's 280; this ticket adopts the stricter upstream 280 to avoid avoidable rejections. Other limits are consistent with upstream.

The production change is only `JEV_LIMITS.minSide: 256 → 280`, with date updated. The app's existing browser codec already rotates upright, fits without enlarging full photos and re-encodes JPEG at quality 0.9. A 270 × 600 image previously passed preparation despite enough total pixels; the new browser test failed first, then checks that it is refused before any provider request. Existing orientation and large-photo tests cover preparation compatibility. No model capability or route changed.

## Reusable full-photo experiment

Run from the repository root:

```text
node scripts/jev-box-experiment.mjs --repeats 1 --output .scratch/box-dry
node scripts/jev-box-experiment.mjs --live --key-stdin --output docs/research/evidence/jev-box-baseline-2026-10-30
```

The first command is free and credential-free. The second reads a credential from stdin until EOF; alternatively omit `--key-stdin` and supply `OPENROUTER_API_KEY` transiently. Never place the key in command arguments, checked-in files or saved shell history. This runner does not enable any live test suite. It starts its own temporary Vite server and headless Chromium to call the existing `preparePhoto`/`imageCodec` implementation, and closes both when finished. The key stays in Node memory and is never supplied to Chromium. `PW_CHROMIUM_PATH` can choose an existing browser.

Default matrix: five photos × three target descriptions × three repeats = **45 sequential calls**, each with one Noul presence question and one Box question. Variants are brief, shape-specific (exclude normal ribs/shadows/paint/dirt), and instance-specific (largest distinguishable target, exclude union). `--photo <basename>`, `--repeats 1..20`, and `--model typesafe/jev-1.14|~typesafe/jev-latest` support controlled comparisons. There are no automatic retries; a transport timeout or authentication, credit or rate-limit failure stops execution and records the outcome. The 120-second timeout may leave billing unknown. Experimental request counts are distinct from the app's five-request optional localisation ceiling.

Each immutable run JSON contains the precise prompts, photo path, requested/resolved model, HTTP status, raw response, returned usage/cost, fallback estimated cost and measured latency. `manifest.json` checkpoints completed runs and stores original/prepared SHA-256 hashes, actual upright/sent dimensions, full-photo transform and preparation description. The exact prepared JPEG is retained once per photo. Requests can be reconstructed by replacing the manifest's image reference with that JPEG's data URL; headers and credentials are never recorded. A unique output folder prevents accidentally overwriting evidence. Reported costs and fallback estimates are separate; unavailable reported cost stays null.

## Provisional visual corpus review

The five source photos were visually inspected before reviewing new answers. These notes are provisional author assessments, not independent expert annotations:

| Photo | Visible target / reason for selection | Limitations |
| --- | --- | --- |
| `side-dented-grey.jpg` | Clear irregular horizontal crease through the middle/lower side panel; nearby smaller scuffs | One extended defect can span several schematic zones; shadows and corrugations complicate its full bounds |
| `rear-door-chsu-22g1.jpg` | Apparently clean dark rear doors with regular ribs and locking gear | Negative control for manufactured geometry; cannot certify absence of small defects |
| `corner-torn-door-cai-20ft.jpg` | Large torn, folded lower-right door and an additional damaged upper seam | Multiple defects; a vague target could select the upper tear instead or union both |
| `jdlu-200690-4-long-side.jpg` | Mostly regular blue panels in a receding view | Apparent lighting/deformation ambiguity; small distant targets; several views exist but no physical-defect labels |
| `rear-door-coyu-22g1.jpg` | Mostly regular rear-door sheet; established edge-positioned ID example | Negative/ambiguous damage control, plus required marking regression photo; no mark-crop claim from these experiments |

The corpus lacks independently labelled small defects, poor/obscured photos and multiple known dents on one panel. CAI covers multiple visible damage areas and grey covers an extended boundary-crossing crease, but neither provides a per-defect truth set. CHSU/COYU/JDLU are provisional negative/ambiguous controls, not certified undamaged panels. No validated precision/recall or IoU accuracy is claimed.

## Live observations and recommendation

The integration agent executed the default matrix using a transient credential; runner exited successfully. [Manifest and raw evidence](evidence/jev-box-baseline-2026-10-30/manifest.json) retain all **45/45 HTTP 200** responses, all resolved to **`typesafe/jev-1.14-20261014`** from requested `typesafe/jev-1.14`. Total provider-reported cost **$0.005861688**; 139,564 input tokens and 1,710 output tokens. Costs are available for every call. Median latency **321 ms**, range **243–719 ms**; summed request latency **17.121 s** (excluding preparation/startup/review). No paid retries, failures or alternate-model calls occurred. The dry run additionally verified browser preparation with zero live calls.

The [offline summary](evidence/jev-box-baseline-2026-10-30/review/summary.json) and five contact sheets show **all** answers, including absent/low-presence boxes. Generate them again, with no credential or provider calls:

```text
node scripts/jev-box-review.mjs docs/research/evidence/jev-box-baseline-2026-10-30 .scratch/box-review
```

| Photo (9 calls each) | Presence range | Box confidence range | Finite ordered nonzero in-bounds | Provisional visual assessment |
| --- | --- | --- | --- | --- |
| [Grey side](evidence/jev-box-baseline-2026-10-30/review/side-dented-grey.jpg.png) | .92–.99 | .47–.68 | 9/9 | All nine overlap the obvious horizontal crease, but capture only its left/middle focal portion. None establishes the complete extent of the long deformation. Instance-specific wording increases confidence while often narrowing the already incomplete rectangle. |
| [Torn CAI door](evidence/jev-box-baseline-2026-10-30/review/corner-torn-door-cai-20ft.jpg.png) | .90–.98 | .61–.70 | 9/9 | All nine locate the conspicuous lower-right torn/folded door. The upper seam damage stays outside these rectangles. Results are useful approximate focal highlights, not guaranteed complete defect crops. |
| [CHSU doors](evidence/jev-box-baseline-2026-10-30/review/rear-door-chsu-22g1.jpg.png) | .27–.36 | .06–.16 | 7/9 | Normal door ribs, handle region or arbitrary sheet area selected; `brief-1` is a point and `shape-1` has zero width. No rectangle should be displayed as damage. |
| [JDLU side](evidence/jev-box-baseline-2026-10-30/review/jdlu-200690-4-long-side.jpg.png) | .36–.45 | .15–.26 | 9/9 | Rectangles drift vertically across a distant corrugated panel and sometimes include the rail/trailer. The photographed area is ambiguous, not an independently confirmed defect. |
| [COYU doors](evidence/jev-box-baseline-2026-10-30/review/rear-door-coyu-22g1.jpg.png) | .32–.37 | .04–.06 | 9/9 | Hardware, door seam and narrow vertical strips selected, with large repeat-to-repeat extent changes. No convincing new dent evidence from these highlights. |

Thus raw geometry availability is 43/45; approximately useful focal location is provisionally observed on 18/18 repeated clear-target calls from **two photographs**. The other 27 calls from three negative/ambiguous photographs produce unsupported highlights; two are also geometrically invalid. These are repeated observations on five tuning photos, not 45 independently labelled examples. No variants improve complete target coverage on the grey crease. No boxes are accepted merely because their coordinates are valid.

For a downstream **experimental approximate highlight**, the initial research guard can be presence **≥ .80** and Box confidence **≥ .50**, after geometry validation and association with an already valid, specific assessment observation. On this matrix it retains 17/18 clear-target repeats and excludes 27/27 negative/ambiguous repeats; the excluded positive is `side-dented-grey-shape-1` (Box .47). Raising Box confidence to .60 retains 12/18 and loses six of nine grey-side repeats. The data exhibit a wide separation between clear targets and controls, so .80/.50 are conservative working guards inside that observed gap, **not calibrated thresholds or independently validated operating points**. Selection/ambiguity and completeness still need their own checks.

No trustworthy strategy for complete damage crops is established: higher confidence does not resolve clipped extent. Use a rectangle only as an approximate focal highlight with the original photograph available, not a precise defect boundary. Keep numbered-region marking localisation; these experiments do not compare or justify replacing it. Prefer specific assessed targets to a generic request for all damage, batch presence-plus-box once per eligible photo downstream, suppress ambiguous targets and retain all valid existing findings when localisation is absent or rejected. Never let Box create a finding, raise severity, or treat high confidence as damage truth. Source-photo/observation ownership remains mandatory. Cross-photo matching, small-defect benefits, reference-image benefits and improved damage detection remain unverified.

## Verification log

- Red: new Jev 270 × 600 browser case failed on the 256-pixel catalogue.
- Green: all three photo-preparation browser tests passed outside the sandbox in 7.1 s, covering the new minimum-side rejection, EXIF rotation and large-photo fitting. The unchanged baseline viewer/preparation cases also passed outside the sandbox (4 tests, 9.5 s, integration agent). Initial sandbox runs completed assertions but hung in preview-server teardown; verified preview-server process was stopped, then host execution resolved the environmental cleanup issue.
- Focused unit checks: provider catalogue and photo-fit specs, 2 files / 29 tests passed. Earlier baseline replay/score: 2 files / 10 tests passed.
- Final integration merge: `git merge try-box`, already up to date at `f23abdc`. `npm run check` passed (lint, token ratchet, doc-image check, type-check, production build), with existing lint/bundle-size warnings. The additional offline review script received focused ESLint/oxlint checks after creation. Secret scan was clean before evidence staging; staged evidence is scanned again before commit.
- No new product screen, production damage request, historical response rewrite or localisation accuracy claim. Evidence supports approximate focal location for the two clear photographed targets and shows why absent-target/presence/geometry rejection is required; it does not establish a general improvement over the current inspection.
