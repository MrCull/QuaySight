## Problem Statement

Quay Sight identifies suspected container damage using CEDEX damage types and approximate schematic zones. Presenters cannot reliably jump from a finding to the particular defect in its source photograph. Small markings and defects may also benefit from better crops, but an earlier native Jev box clipped the COYU container number. Adding more boxes or requests alone is not evidence of improvement.

Existing Jev support already requests, parses and retains native boxes for markings. Numbered regions drive ID and seal crop reads and take precedence in several evidence crops; native boxes remain fallbacks. There is no damage-box request or damage overlay in the photo viewer. Findings retain source-photo references but lack photo-relative localisation observations. Cross-photo merging can combine findings without establishing that they describe the same physical defect, particularly on door regions.

## Solution

Investigate Jev image localisation through extensive, recorded OpenRouter experiments, then add targeted damage localisation as an optional refinement of existing damage assessment. Associate each accepted rectangle with a specific observation, source photograph and finding. Selecting a finding opens the appropriate photograph with an approximate highlight and access to zoom. Unresolved localisation preserves the existing schematic assessment.

Expose an experimental localisation toggle, **enabled by default**, which users can turn off. This preference enables eligible requests; it does not bypass evidence or geometry validation. Preserve numbered-region localisation unless comparative results justify changing it. Treat improved damage detection, better crops and reference-image classification as hypotheses to measure, rather than promised outcomes.

## User Stories

1. As a presenter, I want to select a damage finding and see its source photograph, so that I can explain the visible evidence.
2. As a presenter, I want an approximate rectangle around a located defect, so that I can find it quickly.
3. As a presenter, I want to zoom into the highlighted area, so that small defects are easier to inspect.
4. As a presenter, I want to switch findings within the existing viewer, so that I can compare observations without a separate inspection interface.
5. As a presenter, I want highlights to remain aligned when the image is resized, so that the displayed evidence stays meaningful.
6. As a mobile user, I want overlays to account for fitted image bounds and orientation, so that highlights identify the same area on every screen.
7. As a presenter, I want the original photograph available unchanged, so that annotations do not obscure the underlying evidence permanently.
8. As a presenter, I want the experimental feature enabled initially and an accessible toggle to disable it, so that I can choose whether to use it.
9. As a presenter, I want valid damage findings retained when localisation fails, so that optional refinements do not erase useful results.
10. As a presenter, I want unlocated findings to retain approximate schematic zones, so that uncertainty does not produce fabricated coordinates.
11. As a presenter, I want damage presence and localisation confidence treated separately, so that a confident rectangle does not manufacture damage.
12. As a presenter, I want damage type, severity, certainty and location kept distinct, so that a precise highlight does not imply severe or certain damage.
13. As a presenter, I want each rectangle linked to the correct photograph in a multi-photo inspection, so that evidence is never transferred between images.
14. As a presenter, I want separate photo observations retained under combined findings, so that different views can have different locations or unresolved evidence.
15. As a presenter, I want ambiguous multiple defects left unlocated when necessary, so that one prominent dent is not presented as every defect in a zone.
16. As a presenter, I want findings on zone boundaries handled without inventing extra defects, so that schematic divisions do not distort observations.
17. As a Luna or Jev 1.13 user, I want inspections to continue without unsupported Box questions, so that localisation does not break existing providers.
18. As a presenter, I want localisation charges and latency included in request details, so that I can assess their value.
19. As a presenter, I want essential inspection requests prioritised over localisation, so that optional highlights do not consume the inspection budget first.
20. As a presenter, I want cancellation and provider switching to stop or discard stale localisation work, so that results never mix between inspections.
21. As a demo user, I want recorded observations to replay without a key or live charges, so that the demonstration remains usable offline.
22. As a user exporting an inspection, I want localisation provenance retained without credentials, so that the record remains understandable and safe to share.
23. As a user reading container markings, I want crops to contain the complete target, so that a tighter rectangle does not cut off characters or placards.
24. As a maintainer, I want native boxes compared against numbered regions on the same photos, so that replacements are justified by observed results.
25. As a maintainer, I want the previously clipped COYU ID included in comparisons, so that an established failure cannot disappear from evaluation.
26. As a maintainer, I want full-photo and crop-based localisation compared, so that small-target improvements can be weighed against added work.
27. As a maintainer, I want targeted presence questions tested on apparently undamaged panels, so that false highlights are visible in the evaluation.
28. As a maintainer, I want carefully selected photographic references tested against the existing rubric, so that their effects on false positives and missed damage can be assessed.
29. As a maintainer, I want raw experimental responses, usage and resolved model versions recorded, so that conclusions can be reproduced and model changes identified.
30. As a maintainer, I want provisional visual assessments distinguished from independently labelled ground truth, so that reported accuracy does not exceed the evidence.
31. As a maintainer, I want failed and unsuccessful experiments reported, so that the final choice reflects tradeoffs rather than selected successes.
32. As a presenter, I want accessible, reduced-motion interactions consistent with the existing design system, so that the feature fits the established inspection experience.

## Implementation Decisions

- Extend the existing provider catalogue, question translation, inspection plan, damage evidence, crop utilities, viewer and recording mechanisms. Avoid a parallel inspection pipeline or unnecessary dependencies.
- Keep provider-independent geometry and damage observations in pure domain logic; keep provider wire details and image operations in their existing service boundaries.
- Continue using OpenRouter Decisions for Jev, consistent with the accepted routing ADR. No native TypeSafe routing or backend relay is introduced.
- Audit actual requests and response contracts before implementation. Re-check current official documentation for Box capability, image assets, image dimensions, orientation, payload and expanded-context limits. Correct the documented 256-pixel Jev minimum if current provider requirements confirm 280 pixels, with preparation compatibility checks.
- Native Box is capability-gated. Jev 1.13, Luna and unknown unsupported models must never receive Box questions. Record the exact resolved model as well as the requested model or alias.
- Use the existing CEDEX assessment to select targeted localisation candidates. Pair each target with appropriate presence evidence and validate localisation confidence and finite, ordered, nonzero geometry within image bounds. Calibrate thresholds empirically; do not copy example thresholds or treat confidence as ground truth.
- Box is additional location evidence and cannot independently create a damage finding, increase its severity or establish that damage exists. A failed, absent, malformed, contradictory or low-confidence localisation leaves the valid assessment intact.
- Initially permit at most one additional localisation request per eligible photograph, batching targeted questions where appropriate. This bounds application overhead at five additional requests per inspection. Essential reads take priority, and the existing 50-request/$0.50 inspection limits still apply. No automatic paid retries are added.
- Experimental research is separate from that application limit. The user explicitly authorised numerous paid, direct OpenRouter experiments using the sample images, without a fixed experimental request count. Keep actual experimental spend, requests and latency observable.
- Preserve individual observations and source-photo identity when combining findings. Each rectangle identifies its observation, photograph, target and evidence. Do not collapse distinct defects solely because they share a zone or assign one photo's coordinates to another view. Do not expand this into a general physical-defect matching system.
- Maintain separate meanings for CEDEX damage type, approximate section, image-relative rectangle, presence evidence, localisation confidence and apparent severity.
- Use the upright original image as the canonical coordinate space. Retain actual crop geometry and any preparation transformation necessary to map crop-relative edges back to the original. Distinguish raw localisation rectangles from padded analysis crops.
- Extend the existing photo viewer and crop interactions with finding selection, an optional overlay layer and zoom. Align overlays to rendered image bounds, including letterboxing, resizing and supported zoom or pan transforms. Support one focused observation initially; viewing all accepted rectangles is optional if it remains clear.
- Provide an experimental switch that defaults on and allows users to turn localisation off. Do not expose passes, retries, refinement mechanics or internal candidates in attendee-facing flows. Follow existing design tokens, certainty vocabulary, accessibility and motion rules.
- Compare numbered regions, native boxes, padded boxes and a hybrid for markings. Keep the existing numbered-region path unless measured results justify a replacement. Account for the fact that regions locate several targets in one request.
- Investigate original-resolution suspicious-region crops for small defects. Additional cropped localisation requests remain research-only unless a later measured optimisation fits the agreed application request limit.
- Run a small reference-image experiment against the unchanged CEDEX rubric using trustworthy, relevant examples. Record label provenance and uncertainty. Do not permanently introduce reference-image classification without evidence of benefit.
- Preserve request scheduling, cancellation, raw-response recording, old recording compatibility, cost and token reporting, exports, key isolation and offline demo behaviour. Missing legacy localisation data means unlocated, not malformed or fabricated evidence. Never overwrite historical responses to simulate new model results.
- Keep credentials transient and exclude them from source, issue content, logs, saved requests, recordings and exports. This issue deliberately contains no supplied credential.

## Testing Decisions

- **Proposed primary seam: existing inspection-plan execution and recorded replay.** Exercise complete observable outcomes through the established plan/store and provider transport boundary. Verify which requests are sent, resulting findings and photo observations, preserved classifications, cancellation, caps, usage and replay compatibility. Prefer this over mocks of private helpers or a new public testing interface.
- **Necessary presentation seam: existing browser photo-viewer tests.** Select a finding through the UI and assert the selected photo, focus, toggle behaviour, overlay bounds and zoom behaviour. Cover portrait and landscape images, fitted image letterboxing, resizing, multi-photo selection and reduced motion. These browser assertions verify layout behaviour that replay alone cannot establish.
- Prior art includes recorded single- and multi-photo replay tests, inspection-plan/store tests, viewer and photo-preparation browser tests, crop component tests and opt-in live OpenRouter smoke tests.
- Add focused geometry tests only where needed to substantiate actual crop/preparation transformations, including original-to-crop round trips, edge targets and invalid rectangles. Avoid tests that simply mirror implementation.
- Establish a baseline before changes. Run unit tests without unintentionally enabling unrelated live suites, plus type checks, production build and relevant browser tests. Compare known baseline failures against an unchanged checkout or safe equivalent; do not overwrite user work to establish the baseline.
- Cover a clear dent, apparently undamaged corrugations, multiple defects on one panel, boundary-crossing damage, small defects, poor or obscured images, an edge-positioned ID and several photographs of one container. Where the sample corpus lacks a scenario, use synthetic tests for mechanics and explicitly state that model performance for that scenario is unverified.
- Cover missing, failed, malformed, out-of-range, degenerate and low-confidence boxes; absent-target boxes; conflicting presence evidence; unsupported models; disabled experimentation; exhausted budget; cancellation; stale results; old demos and exports.
- Include Jev 1.13 and Luna compatibility tests for any shared question, wire or response changes. Keep mocked, historical recorded and newly live results clearly distinguished.
- For live experiments, record photo identity, prompt variant, preparation/crop transform, requested and resolved model, raw response, usage, cost and latency. Compare repeated runs and avoid concurrent uncontrolled changes to prompts, preparation and selection thresholds.
- Measure localisation availability, visually assessed correctness, crop completeness, irrelevant crop area, reading outcomes, exact ID/check-digit outcomes, false highlights, ambiguity, requests, tokens, cost and latency. Report denominators, corpus limitations and failures.
- Existing damage labels are only coarse damage/no-damage expectations. There are no independent per-defect rectangles or matching labels. Use the best available visual review and clearly identified provisional annotations; do not describe them as expert ground truth or claim validated detection precision/recall. IoU and target-coverage metrics may be reported against provisional rectangles with that limitation stated explicitly.
- Evaluate reference examples separately from evaluation photos where possible; disclose overlap and avoid presenting results on tuning examples as independent validation. Do not replace CEDEX evidence with photographic similarity.
- Acceptance requires retained existing valid findings, correct source-photo association, aligned overlays, unsupported-model exclusion, observable overhead and compatibility. Document any demonstrated benefit with actual results. A negative or inconclusive model experiment is a valid result and must not be described as an accuracy gain.

## Out of Scope

- A certified survey, physical damage measurements, exact contours or segmentation masks.
- Reliable enumeration of arbitrary numbers of defects from one Box answer.
- A backend, relay, provider ensemble or general replacement of the current request architecture.
- Automatic paid retries, unbounded application requests or exceeding existing inspection caps.
- Replacing numbered-region localisation based solely on cleaner API output.
- Default use of unmeasured photographic references across all questions.
- Mandatory human annotations or attendee correction workflows for this iteration.
- Claims of general accuracy improvement without appropriate evidence.
- Permanent modification of original photographs; exporting annotated copies can be considered separately.
- A broad redesign of cross-photo physical-defect identity or unrelated damage classification.

## Further Notes

Priority order: targeted damage localisation; evidence overlays and zoom; native-box versus numbered-region comparisons; reference-image classification experiments. Early research can stop an unsuccessful approach from becoming a misleading default-on feature: the switch may be enabled while individual untrustworthy rectangles remain undisplayed.

The initial repository audit found existing native marking boxes, numbered-region precedence, no damage-box execution path, insufficient observation geometry and only coarse damage regression labels. These facts must be reconfirmed against the implementation branch before making changes.

The user approved the overall direction, extensive paid sample-image experiments, provisional evaluation without human annotation, per-photo observation ownership, bounded application overhead and a **default-on, user-toggleable** experimental feature. The user also approved the proposed testing seams and authorised publication with `ready-for-agent`.

Official API references to re-check during implementation:

- [TypeSafe Box](https://docs.typesafe.ai/primitives/box)
- [TypeSafe Images](https://docs.typesafe.ai/images)
- [TypeSafe Models](https://docs.typesafe.ai/models)
- [OpenRouter Multimodal Decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions)

Final implementation reporting must state what changed, what deliberately remained unchanged, which checks and live experiments actually ran, their costs and outcomes, and whether the evidence supports an improvement over the previous experience.
