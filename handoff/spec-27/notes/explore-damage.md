# Exploration: #33 long-side damage, #35 door-end damage (spec #27)

Paths relative to /home/user/QuaySight, explored at main 99ac2d3 — re-check against the integration branch; read notes/request-plan.md and notes/question-format.md first.

## Current model: `src/domain/damage.ts` (pure)
- `DamageFace` = rear|front|left|right|roof|long-side ('long-side' = long but which unknown).
- `Severity` = minor|moderate|major (3 levels → #33 makes 5: none, cosmetic, minor, moderate, major; none = no finding).
- `FindingCertainty` = Confident|Likely|Uncertain. `FindingZone {u0,u1,v0,v1}` free fractions (u along length/width, v down from top) — map Z1T…Z5B and door regions onto it.
- `DamageType {code, name, probability|null}`; `DamageFinding {id, face, zone, location, title, description, bestInterpretation, uncertainty, types[], severity, certainty, caveats[]}` — no component, visibility or severity distribution yet.
- `DamageAssessment {source, photos: PhotoCoverage[{photo, face}], findings}` — no image quality/coverage/"potentially significant" yet.
- `VIEWS` (rear-right, front-left), `faceStatus()` (photographed|side-unknown|not-seen), `viewHasPhotos()`, `findingsInView()`, `imageRelativeFindings()`, `sortFindings()` via `SEVERITY_RANK` (extend to 5).
- Tests: `src/domain/__tests__/damage.spec.ts`, `src/components/damage/__tests__/DamageView.spec.ts`.

## Rendering
- `src/components/damage/DamageView.vue`: "Damage view"; "N suspected finding(s)" / "No suspected damage in the photographed faces"; null assessment → "Damage not assessed in this inspection". Need a distinct "Damage not assessed for this view" + reason. `v-model:selected`; imports `src/styles/damage.css`.
- `DamageSchematic.vue`: two fixed views + "Long side, image-relative" figure when a photo face is 'long-side'; coverage strip `qs-coverage`.
- `SchematicFigure.vue`: SVG, `sidePt(u,v)` (40 ft side), `endPt(u,v)` (8 ft end); `regionPoints()` → `.qs-region--{severity}`; `pinClass()` → `qs-marker--{severity}` + `qs-pin--likely|uncertain`; hatching for not-seen; `end` may be null (image-relative). No door-leaf/component/grid overlays (DS mentions a 10×2 `schem-grid`, `qs-schem--show-grid`, not rendered).
- `DamageFindings.vue`: FindingCard buttons with SeverityBadge, CertaintyChip, per-type probability bars ("Probability unavailable"), caveats.
- `SeverityBadge.vue`: `LABEL: Record<Severity,string>`, 3 bars — needs cosmetic, must exclude none.
- `src/styles/damage.css`: in token baseline with 3 violations; may not add more.
- DS: `SeverityBadge/` (1–3 magenta bars), `FindingCard/README.md` (disc fill per severity, outline per certainty), `ContainerSchematic/` ("40 ft sides 10 sections, 20 ft 5"; unknown orientation → one face labelled *Image-relative view*; faces and regions only). `bundle.css`: `.qs-sev*` (64–71, 3 bars hard-wired), `.qs-region--*` (199–201), `.qs-marker--*` (211–213), `.qs-finding__n--*` (255–256).
- Tokens: only `sev-minor/moderate/major`, `damage-fg/bg`, `schem-*`, `schem-grid`. NO `sev-cosmetic` — add in `design-system/tokens.json` (lightest, magenta family, never green), regenerate: `python3 design-system/scripts/build-tokens.py design-system/tokens.json > design-system/tokens.css`. Never hand-edit tokens.css.
- Exports `src/domain/exports.ts`: `ExportFindingLink {findingId, title, face, severity, certainty, types, region{location, zone}, photo, sourcePass}`; `damage.faces` statuses from `faceStatus` + 'not-assessed'; `buildSummaryText` damage lines ~363–380.
- Recorded damage `src/fixtures/recordedDamage.ts` `recordedSideDamage` — hand-written for `samples/side-dented-grey.jpg` (one long-side finding, u .27–.70, v .62–.78, DT, minor, Likely). Used by `recorded.ts`, `demoSamples.ts`, `src/__tests__/recordedInspection.ts`, damage/exports/DamageView specs. #37 retires it; changing `Severity` breaks these first.

## `docs/research/question-sets/side-damage-v2.json` (84 KB)
- `{model:'gpt-6-luna', input:[{role:'user', content:[input_text, input_image]}], questions:[...]}`. Image part `{"type":"input_image","image_url":"data:image/jpeg;base64,{{imageBase64}}","detail":"original"}` — drop `detail` for OpenRouter; mime must match sent blob.
- `input_text` = long TASK/GRID/CEDEX rubric; sole "20-foot" occurrence: "EXTERIOR long side of a 20-foot general-purpose shipping container" → generalise to container length.
- 132 questions: 99 predicate, 23 choice, 10 score; keys name/type/instructions + choices|levels.
  - Global: `image_quality` (good|limited|poor), `side_panel_coverage` (full|most|partial|not_inspectable — the set's own coverage check), `door_end_in_image` (image_left|image_right|not_identifiable), `any_visible_defect`, `potentially_significant_damage`.
  - Per zone Z1T,Z1B…Z5T,Z5B (10×12=120): `{Z}_visibility` (clear|partial|not_visible), `{Z}_deformation_shape` (none|local_dent|sharp_bend|broad_bow|mixed|uncertain), 9 predicates `{Z}_{DT,BT,BW,HO,CK,CW,CO,CH,BR}`, `{Z}_severity` score levels [{label, description}] none|cosmetic|minor|moderate|major.
  - Components (7 predicates): `bottom_rail_bent`, `bottom_rail_corrosion`, `bottom_rail_broken`, `top_rail_bent`, `left_end_corner_post_damage`, `right_end_corner_post_damage`, `corner_casting_damage`.
- 13 choice questions have choices with `value` only (no `description`). OpenRouter criteria map tolerates null values; check whether OpenAI requires `description`.
- Grid: five equal columns from PHOTO LEFT; T/B at sheet vertical midpoint; side sheet only. Z-codes are photo-relative, NOT CEDEX location codes. Mapping: `u0=(n-1)/5, u1=n/5`, v 0–.5 (T) / .5–1 (B), face 'long-side' (image-relative figure).
- `docs/research/question-sets/README.md` — add the door set row (#35).
- Live 16 Oct: Luna Z2B/Z3B (DT≈.92, sev≈2.5/4), 31.5k input tokens, ≈$0.003, 0.9 s; Jev latest same zones (DT≈.63), $0.0007.

## Answer shapes (`docs/research/live-api-findings-2026-10-16.md`)
- OpenRouter: noul `{type:'noul', noul:.96}`; choice `{type:'choice', choice, probabilities:{opt:p}, confidence}`; score `{type:'score', score:1.34, legend:{"0":"None",...}, probabilities:{"0":p}, confidence}`; box `{type:'box', box:{top,bottom,left,right}, confidence}`.
- OpenAI direct: array of `{name, type, choice, probabilities:[{value, probability}]}`; `toOpenAiShape()` in `src/domain/openrouter.ts`. Predicate on OpenAI vs noul on OpenRouter — #29's shared translation covers this.

## Face selection
- Survey (A) asks face: rear doors, long side, front end, roof, close-up, unknown. Pick findings from matching set; a set whose coverage says not inspectable contributes nothing; roof/close-up/unknown → "Damage not assessed for this view" + reason.
- Put the pure face→set rule in a domain module (e.g. `src/domain/damageSets.ts`) with tests.
- Rear doors → `DamageFace` 'rear'; door regions (left/right leaf × top/middle/bottom) → `FindingZone` on the end face (`endPt` u=width, v=height), rear-right view.
- Door end's position only when the photo shows it directly.

## #35 door-end set
- Data beside the side set. Note: `docs/` isn't bundled unless imported — choose one location for both sets (spec: stored as data, not scattered in code).
- Two leaves × top/middle/bottom; components: locking bars & cams, hinges, gaskets, header, sill, rear corner posts, castings. Same rubric, CEDEX predicates, five-level severity. ≤200 questions (6×12=72 + globals + components).
- Tune live on `samples/rear-door-aphu-45g1.jpg` (2048×1536 — over Jev 1568, resize; Node has no canvas), `rear-door-chsu-22g1.jpg` (1312×984), `rear-door-coyu-22g1.jpg` (1079×1080). Expect no false major findings.

## Pitfalls
- Three separate axes; nothing green; cosmetic visually lightest. No CEDEX location codes.
- "Potentially significant damage, closer inspection advised" — never a repair verdict ("Apparent moderate dent", never "Repair required").
- Unseen zone → "Not seen", never clean ("Absence is not a result").
- Failed damage request leaves ID/details intact (#28 plan).
- Token ratchet `scripts/check-tokens.mjs` scans `src/` only (hex, rgb/hsl, px font-size/font, px padding/margin/gap); new files must have 0 violations.
- `App.vue` mounts `<DamageView :assessment="store.record.damage">` (hotspot).
