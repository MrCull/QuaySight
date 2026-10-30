# Marking crops: numbered regions versus native Box — ticket #121

Checked 30 October 2026. Starting branch `ticket/121-marking-research`, integration baseline `46ab4f6`. Research only; the application's numbered-region pipeline is retained.

## Method and provenance

The [ticket #116 baseline](jev-box-baseline-2026-10-30.md) supplies the current API contract, preparation rules, historical replay scores and pre-existing test failures. This experiment uses the same direct OpenRouter Decisions endpoint, requested model `typesafe/jev-1.14`, sequential calls with no paid retries, transient credentials and existing browser preparation. The key remains in Node memory, never enters the browser and is excluded from artifacts. Existing historical recordings are untouched.

The isolated [runner](../../scripts/jev-marking-experiment.mjs) compares seven matched photographs, three repeats per photograph. Each repeat first asks the unchanged application numbered-region question set on its marked image, then a single batched native Box request on the same prepared unmarked photograph. The latter pairs presence and Box questions for ID, ISO code, weights panel, seal, first DG placard and door end. Presence ≥ .50, Box confidence ≥ .50 and finite ordered nonzero in-bounds edges determine research crop availability. These are working guards, not calibrated probabilities or proof of correctness. Both approaches multiplex several targets; no per-target localisation request is charged in this matrix.

Four strategies use the same public `cropForRead` boundary and original upright source pixels:

- **Regions:** returned numbered region, application ID margin .25.
- **Native:** returned native rectangle, margin 0. Model minimum-side fitting can still widen this crop; it is not necessarily the raw rectangle.
- **Padded:** native rectangle, existing native crop margin .35 of its pixel long side on every side.
- **Hybrid:** union of available numbered-region and native rectangles, followed by margin .25. If only one source is available it is used. This explicitly conservative research strategy is fixed before scoring; it is not the production fallback policy.

ID, ISO, weights and seal crops receive identical application question sets across strategies, translated and parsed by the existing question-set boundary. All eleven ID characters use the application's certainty rules; missing characters stay `?`. ISO uses the existing first container-detail question. Weights asks max gross, tare and payload in both units; the outcome comparison counts all three printed kg figures correct together. Seal uses the existing seal family. Door-end crops and absent DG targets have geometry review only; no new door-damage classification or placard-reader accuracy experiment is claimed.

Every paid response is immutable JSON containing prompts, image reference, raw response, requested/resolved model, usage, provider cost and request latency. The manifest retains source/prepared image hashes, upright original dimensions, exact crop geometry, output dimensions and saved prepared/marked/crop JPEGs. Fractional coordinates are on the upright full photo; `region` is the actual crop in upright original pixels. Preparation is existing EXIF-upright decoding, aspect-preserving fit and JPEG re-encoding at quality .9. Reconstruct requests by substituting each referenced saved JPEG's data URL. No response is rewritten to simulate a different strategy.

```text
node scripts/jev-marking-experiment.mjs --repeats 1 --output .scratch/markings-dry
node scripts/jev-marking-experiment.mjs --live --key-stdin --repeats 3 --output docs/research/evidence/jev-markings-2026-10-30
node scripts/jev-marking-review.mjs docs/research/evidence/jev-markings-2026-10-30
```

`--key-stdin` reads until EOF; alternatively supply `OPENROUTER_API_KEY` transiently and omit that flag. Run the browser outside the Windows sandbox if teardown hangs. Dry mode makes no provider requests. Evidence output must be new; existing run files cannot be overwritten. Offline review never calls a provider.

For an interrupted run, add `--resume` with the same mode, output and repeat count. Saved request descriptions and regenerated image hashes must match, and a manifest entry without its response stops the run. New live calls create a pending marker before sending: if a process stops before saving a response, inspect billing and the marker before deciding how to proceed; the runner will not automatically repeat it. Existing evidence predates these markers, so its interruption must be understood separately. `--live --resume --verify-resume` replays saved responses without a key or network calls and stops at the first missing request. Run that check on a copy of the evidence because it can recover missing manifest entries and readings.

On a different operating system, annotated JPEGs can differ because the numbered overlay uses a system font. For the committed historical evidence, `--reuse-saved-marked` permits reuse of the exact saved annotated JPEG only after comparing it byte-for-byte with the corresponding committed file at `HEAD`. The normal checks still validate source and prepared images, generated crops and recorded requests. Newly generated annotated images retain the normal regeneration check. This option requires `--resume`; use it with `--verify-resume` on a copy before any live continuation. The cloud environment verified the 57 saved responses this way and stopped at `rear-door-chsu-22g1-2-id-native`, before any provider request. No live continuation was performed in that check.

The original run was interrupted after 57 successful responses. Credential-free verification on a copy reprocessed them and reached the first missing request, `rear-door-chsu-22g1-2-id-native`; the preceding ID reading was `CHSU???????`, with an unknown check digit. The study was subsequently resumed using the committed historical marked images and completed with 217 additional successful responses. No saved response was repeated.

## Provisional labels and corpus limits

The author inspected all seven original photos before reading this experiment's answers and recorded [approximate rectangles](jev-marking-provisional-labels-2026-10-30.json). They are provisional author assessments, not independently labelled ground truth. Full containment means the actual crop contains the entire approximate target rectangle. Coverage measures overlap divided by that rectangle's area; irrelevant area is the fraction of crop area outside it. This includes empty space between printed characters and can penalise safe context. Borderline clipping around a rounded label edge remains uncertain. No precision/recall, independent validation or exact character-count clipping claim follows from these rectangles.

COYU's established clipped native-ID example is included, with CHSU, APHU and three JDLU views. The last JDLU photo contains a narrow vertical ID near the side/door boundary. The other corner view is blurred and has the door end partly outside the source photograph; no crop can recover source-clipped structure. The seal close-up contains two copies of `0154620`; the device and first number have separate provisional extents. Labels score six IDs, six ISO codes, five weight panels, one seal device and five visible door-end extents. Weight/ID/ISO reading expectations use the existing regression values, with the visible side JDLU ID assigned the same known container string.

No true diamond-shaped dangerous-goods placard is visible in these seven photographs. The yellow SUPER HEAVY triangles and HIGH CONTAINER labels are different marking types. Thus the comparison can expose false placard crops but cannot estimate positive placard containment or class reading. The corpus covers only four containers and one seal; repeated calls and several JDLU views are correlated observations, not independent examples. It lacks independently labelled obscured markings and varied seal designs. Neither high confidence nor a valid check digit establishes an exact reading.

## Request ordering and decision

Numbered regions and survey already run in parallel in the application; current ID/seal reads wait for the region response. A native alternative might share the survey request, but this experiment isolates a batched native request and does not measure such a rewritten schedule. Its timings are provider round trips, excluding preparation, browser startup and review. The hybrid waits for both localisation results and cannot be called faster merely because a rectangle is tighter. Crop reads add one request per available target per strategy; four-strategy research spending is not an application request proposal. The application still uses one model and existing caps/fallbacks.

Retain numbered regions. A small correlated sample and additional native dependency do not justify replacing the current pipeline. The hybrid improved provisional ID containment and exact readings in this sample, but waits for both localisation results and produced larger contextual crops; it also did not improve weight reads. The results are insufficient to justify a production change.

## Completed results

All 274 requests succeeded and resolved to `typesafe/jev-1.14-20261014`: 21 numbered-region requests, 21 batched native requests and 232 crop-reading requests. Provider-reported total cost was $0.11491137, with 2,735,985 input tokens and 558,755 output tokens. Summed provider latency was 113.068 seconds; the median request was 391 ms. This is the whole research matrix, not the cost or latency of a single production inspection. The first 57 responses cost $0.021777546; the 217 new responses cost $0.093133824.

The table counts complete containment of the provisional target rectangle and exact expected reads. Denominators include unavailable crops as failures where a target is labelled. Repeats from the same photograph are correlated; the labels are author estimates, not independently validated character boundaries.

| Target | Strategy | Complete target | Exact read |
| --- | --- | ---: | ---: |
| ID | Regions / native / padded / hybrid | 16 / 0 / 13 / 18 of 18 | 10 / 8 / 8 / 12 of 18 |
| ISO | Regions / native / padded / hybrid | 18 / 0 / 18 / 18 of 18 | 18 / 17 / 18 / 18 of 18 |
| Weights | Regions / native / padded / hybrid | 15 / 0 / 9 / 15 of 15 | 0 / 2 / 5 / 0 of 15 |
| Seal | Regions / native / padded / hybrid | 0 / 0 / 3 / 3 of 3 | 0 / 0 / 0 / 0 of 3 |

For COYU, the native ID crop failed provisional full containment in both repeats where it was available; the third native crop was unavailable. Regions and hybrid contained the provisional ID in all three repeats. An exact read can still occur from a partially clipped crop and does not prove its geometry is complete. Against five provisional door-end labels over three repeats, regions, native, padded and hybrid contained 11, 0, 6 and 13 of 15 respectively. None of the selected photographs contains a true dangerous-goods placard, so false placard crop availability is observable but positive placard coverage is not measured.

The region and native localisation requests each cover multiple targets. Their median provider latencies were 483 ms and 371 ms respectively; these are separate research calls and exclude preparation. Hybrid depends on both answers, so those figures do not establish its end-to-end speed. Full per-run accounting, crop geometry, reads, coverage, unavailability and provisional labels are in the [offline summary](evidence/jev-markings-2026-10-30/review/summary.json); review sheets show the first repeat of each photo. Further independent photos and labels are needed before claiming a general accuracy improvement.

## Verification

- Credential-free dry run: seven photographs prepared and marked, 14 planned localisation requests, zero provider calls.
- Existing public geometry, numbered-region and plan replay tests: three files / 39 tests passed. No production behavior changed, so no new synthetic fixture was introduced to pretend these live outcomes were predetermined; TDD skill seams remain the approved crop geometry and plan/replay boundaries.
- Focused runner ESLint and oxlint passed before final formatting.
