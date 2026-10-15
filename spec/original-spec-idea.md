# Quay Sight

**App name:** Quay Sight  
**GitHub repository name:** `QuaySight`  
**Product type:** AI-powered container recognition and damage inspection POC  

**Product requirements specification**  
**Version:** 1.5  
**Status:** Multi-provider requirements for a live innovation-event demonstration  
**Initial AI providers:** OpenAI GPT-6 Luna (Decisions API) and TypeSafe Jev (System One API)  
**Additional providers:** Designed to be added later without redesigning inspection features  
**Target experience:** Modern, visually striking Vue 3 static web application

**Naming requirement:** Use **Quay Sight** as the user-facing application name (including page title and primary branding) and **`QuaySight`** as the repository/project name.

## 1. Purpose

Build a polished, interactive proof of concept demonstrating how a structured decision model can inspect photographs of freight containers, identify the equipment and its visible markings, detect and classify visible damage, and selectively revisit uncertain findings.

The presentation should demonstrate more than one-off image recognition. The distinctive feature is **adaptive, evidence-led classification**: combine structured model decisions with established container standards, validate their relationships and run limited, targeted follow-ups when useful. **The application itself performs the reasoning and presents the outcome; users are never required to verify, edit, choose or type answers to complete an inspection.**

The app must be credible about what is *visually observed/classified*, *inferred from standards*, *calculated*, *AI-estimated* and *not established*. It is **not** a certified condition survey, safety inspection, dangerous-goods declaration or automated gate release system.

### 1.1 Innovation-event outcomes

An attendee should be able to see, in one short demonstration:

1. A container photograph is uploaded and analysed using the presenter-selected provider and model (initially Luna or Jev).
2. The app identifies the container and key equipment characteristics where supported by evidence.
3. A photograph with damage produces approximate schematic location markers and clear descriptions of the CEDEX damage types that fit.
4. Uncertain identification can lead to a focused second attempt with constrained, check-digit-valid candidates, using the same selected provider/model unless an explicitly separate run is started. This happens behind the scenes: the audience sees only the outcome, never passes or candidate mechanics.
5. Remaining ambiguity is expressed as likely alternatives and specific limitations; the demo never stops to demand a human answer.
6. Suspected damage is located on an attractive, neutral container schematic, without pretending to render the physical defect.
7. A compact cost monitor shows this container's API cost and the current session total, with expandable request-level detail.
8. The result becomes a readable, interactive inspection record, with transparent certainty, costs and underlying answers.
9. The presenter can switch provider/model for a new run and see the same consistent inspection interface, with clearly attributed results and charges.

The experience must work **without an arrival manifest**. A manifest is optional additional context, not a prerequisite.

## 2. Scope and priorities

Priority labels: **MUST** = core innovation-event POC; **SHOULD** = strongly desirable for the demo; **COULD** = stretch goal. These labels apply to requirements, not delivery phases.

### MUST

- Single-screen or cohesive single-application inspection journey.
- Select an AI provider and supported image-capable model/version, enter that provider's API key and run a live inspection. **OpenAI/Luna and TypeSafe/Jev must both work** for the initial POC.
- Provider/model switch must not change the core equipment/damage presentation, validations or uncertainty semantics.
- Provider-independent inspection questions/findings and a shared, evidence-rich inspection record. Two initial provider integrations; later providers must be addable without rewriting the results experience.
- Provider-specific image request encoding, question-type translation, response parsing and errors, without pretending every provider has identical capabilities.
- Equipment identification and standard characteristics/markings.
- Container-ID recognition **without** a supplied manifest.
- Independent recognition evidence for full/partial ID, prefix, groups, individual characters and check digit.
- ISO 6346 check-digit calculation and cross-validation.
- Automatic, bounded second-pass identification when it is likely to add value.
- Autonomous finalisation after bounded refinement: supported readings, qualified alternatives and unresolved fields, **without manual resolution**.
- Damage classification, location and visible-region coverage, using CEDEX concepts.
- Clear presentation of disagreements, uncertainty and missing evidence.
- Attractive, image-centric results with a neutral container/location diagram and inspectable damage markers, not a raw JSON dump.
- Read-only result presentation with intuitive colour-coded certainty levels and explicit not-observed / not-inspected states.
- A compact always-available cost and usage indicator showing current-container and session totals **across providers/models**, expandable into provider/model-attributed request-level detail.
- Representative recorded sample mode for **each initial provider**, clearly labelled as recorded data; provide offline fallback even if either service is unavailable.
- Downloadable consolidated JSON and the underlying model response.
- Excellent reliability and professional visual/interaction quality suitable for live presentation.

### SHOULD

- Multiple photographs of the **same** container per inspection.
- Model/version picker showing eligible models for the selected provider, with a stable recommended default and warning for moving `latest`/`preview` aliases.
- Optional *compare providers/models* action: run the same photo and inspection goals independently and present differences without merging them or claiming the more confident model is more accurate.
- Experimental provider-specific localisation (e.g. Jev single bounding boxes) when supported, guarded by a separate defect-presence check and clearly labelled as approximate.
- Optional user-supplied expected container numbers or manifest list.
- Focused second-pass damage or markings inspection using crops or alternative choices.
- Interactive photo-relative region highlighting and drill-down, complementing (not replacing) the neutral container schematic.
- Presenter-friendly comparison/evaluation using pre-labelled test fixtures, without prompting demo users to correct results.
- Responsive layout suitable for phone/tablet photo capture as well as desktop presentation.

### COULD

- Reusable small sample gallery showing different strengths and limitations.
- Side-by-side comparison of two prompt versions on the same image, with provider/model and request version recorded.
- Locally exported/imported inspection sessions to support repeated demos.
- More extensive CEDEX component inventory and specialist container types.
- Optional comparative demo mode showing the impact of faster versus more thorough automatic inspection, without making users adjudicate answers.

### Explicit non-goals

- No production TOS integration, booking, gate release, equipment control or container tracking.
- No user accounts, persistent backend database or multi-tenant access management.
- No training or fine-tuning a specialist damage model.
- No guarantee of exact OCR, calibrated probabilities, safe cargo, seaworthiness or repair compliance.
- No need to create vessel-visit records, parse BAPLIE/MOVINS/COPRAR or connect to a real manifest provider.
- No requirement to support arbitrary models that cannot accept photographs or produce interpretable structured classifications. Such models must be labelled unsupported, not forced through an incompatible interface.
- No mandatory live two-model comparison as a prerequisite to presenting one inspection.
- No full design system, screen mock-ups or fixed brand direction in this document.
- Asking an attendee or presenter to decipher characters, select a candidate, enter a missing number or manually confirm the model's results. (The optional manifest retry in §3.2 is the only exception, and it never blocks a result.)
- Generating an apparently photorealistic reconstruction of damage or claiming pixel-precise localisation from region decisions or experimental box estimates.

## 3. Core inspection journey

### 3.1 Start an inspection

**MUST**

- Select a **provider** (OpenAI Decisions or TypeSafe Jev initially) and a compatible **model/version** before analysis. Provide a clear recommended default while keeping the selection unobtrusive for the presenter.
- Enter the relevant provider's API key at runtime. Label the key field for the chosen provider; allow editing, reveal/hide and clearing it. Never silently send one provider's key to another.
- Selecting a provider changes only the relevant setup capabilities and advanced technical detail, not the main inspection workflow.
- Preserve the selected provider and model with every inspection and with every request in that inspection; switching provider starts a distinct run, not a silent mid-inspection fallback.
- Add a photograph of a container from the device. Drag/drop, file selection and straightforward replacement must work.
- Display the actual selected photo, its orientation and whether it is suitable for inspection.
- Do not require the user to know or supply the container ID, length, face, orientation, equipment type or any other classification.
- Infer photographic face/orientation only where defensible, otherwise leave it unknown and use image-relative positions. No mandatory classification questions to the user.
- Start analysis explicitly, with visible progress through understandable stages; use provider-neutral terms in the main flow and specific provider/model labels in detail.

**SHOULD**

- Accept multiple pictures assigned to one inspection, including rear doors, left/right side, front and close-ups.
- Automatically classify the visible face when supported; otherwise display 'face unknown' and preserve image-relative regions.
- Detect apparent mixed-container photographs and show a nonblocking notice instead of merging their evidence into a misleading single inspection.
- Support common formats including JPEG, PNG and WebP; preserve sufficient resolution for small printed markings.
- Provide image zoom, pan and rotation/orientation correction for review.

### 3.2 Optional expected-ID list

**MUST**

- **No manifest is required** for identification or any other analysis.
- When no manifest is supplied, do not send a fictitious manifest or a pre-seeded correct ID to the live model.

**SHOULD**

- Let the user paste a list of possible container IDs (or choose a simple file) as optional additional evidence.
- Explain that the list is used to narrow candidates and that 'none of these' is always a possible outcome.
- Preserve the distinction between 'visually read from image' and 'matched against supplied candidates'.
- Handle list sizes above the practical per-question choice limit by narrowing or chunking candidates without pretending all were considered in a single question.

**Manifest retry (when the container ID is not identified)**

- If the first attempt cannot identify the container ID, offer the presenter an optional paste box for a manifest list. This is never required, and the first result stays viewable while the offer is open.
- Accept CSV, tab-separated and space-separated IDs, as well as one ID per line. Pasted entries are not validated against ISO 6346 or check digits; they are used as supplied.
- Limit one paste to about 500 containers for this POC.
- Run the retry on the same provider and model as the first attempt, as a separate chargeable run (§8.5).
- When the retry finishes, the first attempt's container-ID result is replaced by the new attempt's result. Other findings from the first attempt (damage, properties, markings) are kept, since they don't depend on the manifest.

## 4. First-pass equipment identification

### 4.1 Container number

**MUST**

Use multiple complementary structured questions through the **selected provider** rather than one all-or-nothing OCR guess:

- Is an ISO 6346-style ID visible, and how legible is it?
- Four-character prefix as a whole, where a useful choice set can be formed.
- Three owner-code letters and equipment-category letter as separate choices.
- Six serial digits individually, with alternative probabilities retained.
- Serial digits in logical groups (first three and last three), with an explicit 'other / unreadable' outcome.
- Visible check digit, assessed independently.
- Optional full-ID choice **only when genuine candidate IDs have been supplied or generated from evidence**.

Group and digit questions are complementary; neither is assumed authoritative. The first pass must retain full probability distributions **where the provider supplies them**, not only the top choice. Missing capabilities/metrics remain explicitly unavailable, never fabricated.

When the exact text cannot be represented by a finite choice list, the app should reconstruct *candidate IDs* from observed letter/digit distributions and mark them as candidates, not as a direct verbatim extraction. This respects the Decisions API's fixed-choice design.

**MUST** handle partially obscured, cropped, absent and nonstandard container numbers. 'Unknown' is acceptable and must not prevent the remainder of the inspection. No full-ID choice should imply certainty merely because the right answer was inserted as a candidate.

**MUST** retain the distinction between a number **visibly recognised**, a **generated candidate** constrained by the check digit, and a **manifest match**. A candidate winning a limited choice set does not turn it into observed text.

### 4.2 ISO 6346 check digit: both model context and deterministic validation

**MUST** include a concise, accurate description of the check digit in the relevant identification request instructions:

> A standard container number has three owner-code letters, one equipment-category letter, six serial digits and one check digit. To calculate the check digit, assign numeric values to letters starting at A=10 and skipping multiples of 11 (for example B=12, K=21, L=23, U=32). Digits retain their numeric value. Multiply the first ten values by 1, 2, 4, 8, 16, 32, 64, 128, 256 and 512; sum and take the remainder modulo 11. Remainder 10 is displayed as 0. Use this as a consistency constraint when comparing visually plausible numbers, but do not invent or change clearly visible characters just to satisfy it.

**MUST** calculate and validate check digits independently of the model's answer. Requirements:

- Preserve the separately *observed* check digit and the *calculated* check digit.
- Check every complete candidate ID for correct format and check digit.
- A matching digit is supporting evidence, **not proof** of correct identification; many IDs share a check digit.
- If the visible check digit is confidently recognised, prefer candidates compatible with it while retaining an escape route if the reading could be wrong.
- If the visible check digit is uncertain, do not over-filter the candidate pool using a weak observation.
- Support the remainder-10-to-0 convention and the less discriminating nature of a displayed zero.
- Never silently 'correct' a number to make it pass validation without showing what changed.
- Allow an observed ID with an invalid check digit to remain in the report, explicitly flagged as such.

### 4.3 Container properties

**MUST** recognise or infer, when supported by the photo:

| Field | Required treatment |
| --- | --- |
| ISO 6346 size/type code | Whole-code classification from common ISO codes, plus `other`, `unreadable`, `not visible`. |
| Length | Standard industry categories, respecting the ISO size code. |
| Height / High Cube | Prefer consistent decoding of known ISO code over estimation from perspective. |
| Width | Standard vs pallet-wide/other; do not infer unusual width without evidence. |
| Equipment type | General purpose, reefer, open top, tank, flat rack, platform, insulated, ventilated, bulk, special/unknown. |
| Maximum gross | Exact printed value if among options; otherwise a range or `other`, with clear uncertainty. |
| Tare | Exact printed value or plausible range, if visible. |
| Maximum payload / NET | Exact printed value or range, if visible; cross-check gross minus tare. |
| Cubic capacity | Printed value when recognisable; otherwise `unknown`. |
| Reefer / open top / tank / flat rack | Separate useful yes/no/unknown classifications. |
| Visible rear doors | Evidence relevant to orientation and further inspection. |
| Special operational markings | Separate checks, not one ambiguous 'multiple warnings' answer. |
| DG placards | Visible symbol/class only; actual hazardous cargo status is unknown without declaration. |

**MUST** distinguish maximum authorised gross mass, tare, maximum payload and **actual current loaded weight**. Never present a maximum as a measured load or VGM.

**MUST** distinguish *printed* values from *decoded/inferred* properties and *calculated* quantities. The ISO code `45G1` means a standard-width 40-foot High Cube general-purpose container, not a 45-foot container.

**MUST** include `other`, `not visible` and `unreadable` where appropriate. Do not force an incorrect common answer.

### 4.4 Weights, warnings and ambiguity

**MUST**

- Treat **MAX GROSS**, **TARE** and **NET/PAYLOAD** as separate printed rows and avoid reading the lb value as the kg value.
- Independently calculate `maximum payload = maximum gross - tare` when both inputs are available and clearly label it as calculated.
- Flag disagreements between the model's printed-value choice, its band choice and any arithmetic-derived value.
- Separate 'SUPER HEAVY', high-container caution stripes/signage, overwidth markings, fumigation and marine-pollutant labels. A high-container warning must not be reported as an overwidth warning.
- Report 'no hazardous-goods placard visible' rather than 'cargo is non-hazardous'.

**SHOULD** allow a focused follow-up for conflicting weight or ISO-code readings, using only the relevant region of the image, provided the next question still includes `other`/`unreadable` options.

## 5. Adaptive identification and refinement

### 5.1 Decide whether to refine

**MUST** consider a second pass when the first pass is insufficiently supported, including:

- No sufficiently convincing full ID or usable partial ID.
- Independently identified characters, groups and check digit disagree.
- The leading candidate fails ISO check-digit validation.
- Several visually plausible candidate IDs remain close in likelihood.
- No candidate matches optional supplied IDs.
- Exact gross/tare/payload readings conflict, or an important marking is ambiguous.

Thresholds must be explicit, adjustable during evaluation and treated as POC heuristics, not empirically validated confidence levels. A high probability by itself must not suppress obvious contradictions.

### 5.2 Generate candidates without a manifest

**MUST**

- Build candidate IDs from the most plausible character and group alternatives, keeping characters with strong visual evidence stable by default.
- Consider common visual confusions (e.g. 0/O, 1/I, 5/S, 6/8) where the character position permits them.
- Validate ISO format and compute check digits for candidates.
- Use the observed check digit as a filter or ranking factor **only in proportion to its reliability**. If the evidence is weak, preserve plausible candidates with other check digits.
- Rank complete numbers using a combination of independent character/group evidence, check-digit validity and any genuine manifest information; do not treat the model's percent as a mathematically calibrated posterior.
- Retain a diverse, bounded set of plausible candidates rather than exhaustively enumerating every combination.
- Never fabricate a manifest or claim that generated IDs are expected cargo.
- Always include `other_not_listed` and `unreadable` in a second-pass choice question.
- Record why each candidate was considered (which observed characters/groups/check-digit rule supported it).

**SHOULD** be able to use optional genuine manifest IDs to prioritise or add candidates without preventing an unexpected ID from being recognised.

### 5.3 Targeted follow-up request

**MUST**

- Reuse the same original photographic evidence, or a faithful crop of the relevant marking with enough context.
- Ask a focused choice between a limited number of *plausible* complete IDs, instead of rerunning the entire initial battery unchanged.
- Preserve first-pass and second-pass outputs in the consolidated JSON and raw provider responses for technical evaluation. They are **not** shown in the user interface (see §8.2 and §9).
- Avoid presenting second-pass probability as directly comparable to first-pass probability when the choice sets differ.
- Compare second-pass results with observed groups and calculated check digits before promoting a candidate.
- Default to **no more than one automatic refinement per unresolved field/region**, with a configurable overall per-inspection request and estimated-spend cap. Stop automatically when the limit is reached; do **not** ask for permission to keep guessing.
- Allow cancellation and show that a partial inspection is usable even if a refinement call fails.

### 5.4 Autonomous finalisation when still uncertain

**MUST**

- **Never interrupt the POC inspection to demand a human decision.** No manual number entry (except the optional manifest retry in §3.2, which never blocks the result), candidate picker, correction form, approve/reject control or confirmation gate.
- Present the strongest supported complete ID if sufficiently corroborated; otherwise show a *likely* ID or *unable to establish* with the most plausible alternatives and their uncertainty.
- If only a prefix or a subset of digits is supportable, display the known partial pattern and clearly mark missing/uncertain positions rather than filling them in as fact.
- Use the certainty labels defined in §8.4: **Confident**, **Likely**, **Uncertain**, **Can't tell** and **Not seen**. A successful mathematical check alone must not upgrade a visually weak reading to Confident.
- Present an optional, nonblocking suggestion such as *A closer photo of the top-left door markings may help*. The existing inspection stays complete and viewable even if no further photo is provided.
- Stop after the automated refinement limit and preserve an evidence trail of all attempted candidates, observed characters and disagreements.
- Apply the same autonomous approach to weights, warnings and damage: do what can be justified, explain the rest, and do not keep iterating until an arbitrarily confident answer appears.

The results are **read-only observations and estimates** for this POC, not data-entry tasks. The only optional user actions are providing photos, providing an optional manifest, exploring results and starting a separate new inspection.

## 6. Visible damage and CEDEX inspection

### 6.1 Detection scope

**MUST** support provider-independent classification of visible defects on photographed container faces, using Luna and Jev initially, including as relevant:

- Dents (`DT`), bends (`BT`), bows (`BW`).
- Holes (`HO`), cracks (`CK`), cracked welds (`CW`).
- Corrosion/rust (`CO`), corrosion with perforation (`CH`).
- Broken/split components (`BR`).
- Additional common CEDEX categories where genuinely visually recognisable (e.g. cut, burn or forklift impact), without promising exhaustive inspection coverage.

Definitions must explicitly distinguish **local dents in corrugated panels**, **sharp bends**, and **gradual bowing**. Normal corrugations, shadows, dirt, decals, paint variation, forklift pockets and standard fittings are not defects.

**MUST** allow multiple suspected damage types in the same region and distinguish primary defects from alternate ways of describing one deformation.

### 6.2 Location, face and components

**MUST**

- Associate each photographed view with an identified or unknown face: rear doors, front, left, right, roof, or close-up/unknown.
- Record regions in an **image-relative** grid when face orientation is unknown. Never label a position as `RT3N` solely because it is third from the left of a photograph.
- Use ISO 9897 / CEDEX **four-character location codes** only when face, door-end orientation, nominal length and affected zone can be established reliably.
- Distinguish panels, rails, corner posts, corner castings, doors, door gear and other visible components, with CEDEX component codes when supported.
- For long sides, use length-appropriate sections: 5 longitudinal sections for 20-foot and 10 for 40-foot, with appropriate upper/lower partitioning and edge components. For other sizes use the appropriate standard or mark mapping unavailable.
- Adapt the inspection zones and damage/component questions to the **visible face**: a rear-door photograph requires door/locking-gear regions, not the long-side corrugation grid; a side photograph requires panels/rails/corner posts, not fabricated rear-door assessments.
- Keep separate the broad decision grid used for the POC and any later official CEDEX location code, and show the mapping assumptions only when those are justified.
- Support damage spanning neighbouring sections, without turning it into multiple confirmed defects simply because it crosses grid lines.
- Track visual coverage independently of absence of detected damage. Unseen, obstructed or low-resolution regions are **not seen**, not 'clear'.

### 6.3 Per-finding information

**MUST** produce a consolidated suspected-damage record with:

- Photo reference and face, including known/unknown orientation.
- Image-relative region, and CEDEX location if defensible.
- Affected component and component code if defensible.
- Candidate CEDEX damage type(s), predicate probabilities and any competing descriptions.
- Apparent visual severity / severity distribution, never a formal repair verdict.
- Whether the region was adequately visible and whether closer inspection is advisable.
- Source pass(es), certainty/evidence status and any unresolved conflict; no user correction field is required.

**MUST** include a **neutral visual container representation** as the default location view:

- An illustrative, generic container diagram or simplified 2D/3D schematic that clearly separates relevant faces (for example side, rear, front and roof where available).
- Draw the container as **two fixed 3D views**, stacked one above the other (side by side only on wide screens), each showing one end, one long side and the roof: *rear doors and right side*, and *front end and left side*. Together they cover every face. The roof appears in both views but is always **greyed out**, so it never competes with the photographed faces. Each finding is drawn in the view that holds its face; a view with no photographed faces says so.
- Place discrete **pointers, markers or highlighted zones** on the schematic to indicate approximate suspected damage locations; selecting a marker reveals its CEDEX candidate(s), plain-English description, visual severity, probability, evidence photograph and inspection-coverage caveats.
- Indicate the correct face/relative area only where orientation is supported. If orientation is unknown, show an explicitly labelled *image-relative* face or strip instead of inventing which side of the real container is damaged.
- Use visual treatments that distinguish **location**, **damage concern/severity** and **certainty**. Do not paint a fictional dent, hole, crack or rust patch onto the neutral representation.
- Never suggest that marker placement is pixel-precise, measurement-grade or a certified CEDEX location when the source only gives broad regions.
- Show multiple findings in a region accessibly (for example grouped markers) and indicate unseen/unassessed surfaces.

**SHOULD** additionally offer an optional corresponding region highlight on the **original photograph**, with drill-down and a clear *approximate area* label. Where the provider supports bounding boxes (e.g. Jev 1.14 experimental `box`), retain the source box and map it to the same shared region/face record. A photograph overlay complements the neutral schematic but is not required to depict the defect's physical appearance. Luna Decisions does not natively return object-detection bounding boxes. Providers that do supply a box still require a separate presence/classification judgment; do not assume the box corresponds to real damage.

### 6.4 Damage refinement

**SHOULD**

- Ask focused follow-up questions for uncertain, consequential or conflicting region findings.
- Inspect a faithful crop with overlap/context where useful, rather than automatically submitting every region at high detail.
- Include occasional predefined overlap checks for small defects that the first pass could miss.
- Compare the refined damage type and severity with the first pass; keep unresolved disagreements in the record and show them to the user only as certainty (e.g. **Uncertain** with alternatives), never as a pass comparison.
- Avoid counting the same dent twice across overlapping images or zones.

**MUST** avoid silently ruling out serious defects solely because the full-image first pass gave low probabilities. Closer pictures may be needed; the app must be able to say 'insufficient evidence'.

## 7. Multiple-photo behaviour

**SHOULD**

- Allow one or several photos for one container; the single-photo path remains effortless.
- Clearly show which photo supports which reading or suspected damage.
- Reconcile duplicate container IDs, weights and overlapping damage without assuming independent photos are different containers.
- Highlight contradictions between images (e.g. differing container IDs) and avoid silently combining contradictory readings. Do not require the user to reconcile them.
- Use a clear inspection-coverage summary, showing photographed, adequately assessed, partially visible and not photographed surfaces.
- When appropriate, **suggest** a specific optional additional photograph (e.g. closer ID, small print of tare, detail of a suspected hole). The user is never required to act, and no inspection result is blocked.

## 8. Results and interaction requirements

### 8.1 Summary

**MUST** present an instantly understandable overview comprising:

- Container ID and its evidence/certainty status, including a partial reading if that is all the evidence supports.
- ISO code and human-readable size/type, length, height, width and High Cube/reefer indicators.
- Maximum gross, tare, maximum payload and capacity, with source/provenance labels.
- Visible special markings and DG placard status, with cargo-status caveat.
- Visible damage overview: count of *suspected findings or affected regions*, main categories and whether the evidence is convincing, inconclusive or insufficient.
- Coverage limitations and any fields that could not be established.
- Estimated usage cost for **this container** and elapsed time. Request counts and tokens belong in the expandable cost detail (§8.5), not the summary.
- The current **session-wide** estimated API cost, request count and inspected-container count, visible in a compact unobtrusive summary throughout the demo.
- A short, plain-English *What we found* summary that never overstates uncertainty or declares an unphotographed area clear.

### 8.2 Explore detail

**MUST**

- Give the image a central role: zoom/pan and switch between supplied photos.
- Make the neutral container diagram's damage markers and photo-relative regions selectable so their types, probabilities, locations and apparent severity are inspectable.
- Make uncertain results and failed checks prominent **without turning every low probability into an alarming error**.
- Provide a clean view of the **selected provider's raw answers** and all available alternatives for technical attendees; retain provider-specific diagnostics rather than dropping them during normalisation.
- Differentiate model probability, consistency validation, inferred/derived fields and actual benchmark accuracy metrics; label confidence-like fields according to their provider-specific meaning.
- Do **not** show first-pass/second-pass results, refinement steps, candidate lists or question-level mechanics in the user interface. Show the final reading, its certainty label and, where useful, one or two plausible alternatives in plain words (e.g. *Also possible: …, the fifth digit could be a 7*). Pass-level evidence stays in the exports.
- Keep the result view **read-only**: provide suggested alternatives and evidential caveats rather than controls requiring users to validate or correct fields.
- Expose *why* a consistency warning exists: invalid check digit, gross/tare/payload mismatch, contradictory classifications, missing face/orientation, etc.

### 8.3 Exports

**MUST** provide:

1. A consolidated inspection JSON for the POC, including resolved values, provenance and uncertainty.
2. The full raw **provider** response(s), including question names, available probabilities, usage and relevant model/endpoint details.

**SHOULD** additionally provide a shareable or easily copied summary for discussion, clearly labelled POC / non-certified.

The consolidated record must retain distinctions between printed/visually classified, derived, model-selected, generated-candidate and unresolved fields. Every suspected defect must retain a link to its photo/region and source pass.

### 8.4 Certainty presentation and suggested follow-ups

**MUST**

- Give each significant reading a **clear certainty category** with consistent, colour-coded visual treatment and an everyday label. Use exactly these labels, which a non-specialist reads the same way:

  | Label | Meaning shown to the user |
  | --- | --- |
  | **Confident** | Clearly visible, and everything checks out. |
  | **Likely** | Probably right, but not certain. |
  | **Uncertain** | Could be one of a few things; alternatives are shown. |
  | **Can't tell** | In the photo, but not clear enough to say. |
  | **Not seen** | Not in any photo, so nothing can be said about it. Never 'clear'. |

  Avoid evidence jargon such as *supported* or *not established* in the interface.
- Use colour **plus** labels/icons/patterns so projected displays, colour-vision differences and accessibility settings don't make statuses ambiguous.
- Base certainty categories on appropriate evidence: available choice/predicate distributions, margin between alternatives, consistency between related questions, deterministic standards checks, visibility/coverage and agreement or disagreement between passes. Missing probability/confidence must not be silently converted to 0 or 100%.
- Treat these as **POC evidence/support levels**, not empirically calibrated probabilities of correctness. Present raw model probabilities separately in detail when useful.
- Never use the same visual scale for **certainty** and **damage severity**. A high-confidence minor dent is different from a low-confidence potentially serious crack; both axes must remain understandable.
- Avoid classifying an absence of evidence (e.g. rear doors not visible) as a high-confidence negative finding.
- Give unresolved items a concise *Best interpretation* and *What remains uncertain* explanation. Suggestions such as *a closer photo could help* are informational, not a request to finish the task.
- Sort the result so the most useful confident findings appear first, then important caveats, with lower-priority model detail available on expansion.

### 8.5 Per-container and session cost visibility

**MUST**

- Show an **always-available, small and unobtrusive cost indicator** in the inspection experience. It displays both **this container's estimated API cost** and **the current session's cumulative estimated API cost** without taking attention away from the image and findings.
- Make the cost indicator clickable/tappable to **expand** into a more detailed usage panel. It must be easy to collapse again; the location/interaction treatment can be decided during design.
- The expanded view itemises each API call with a plain-language purpose, e.g. reading markings, looking for damage, closer look at the ID, closer look at a dented area (no pass numbering). Show purpose, **provider, exact model/version**, request status, timestamp/sequence, usage units/tokens when available, estimated USD cost and latency.
- Show totals for the current container, all containers inspected during the current page session, request counts, total tokens and overall elapsed API time. Do not count the same request twice because it contributes to both a container and the session ledger.
- Clearly distinguish **estimated API usage cost** from an actual provider invoice, and **live calls** from recorded sample results. Sample mode must show *no live API charge* even when recorded usage metadata is demonstrated.
- Display tiny sub-cent costs with enough precision to be meaningful (e.g. `$0.0016`, not `$0.00`); handle zero, unknown and incomplete usage separately.
- Include automatic refinements and any chargeable retries in totals. Where usage is missing or a provider's billing basis is unknown, mark the estimate as incomplete rather than silently assuming the request was free.
- A manifest retry (§3.2) is a live call on the same provider and model. It counts toward the per-inspection request/spend cap and appears as its own line in the ledger.
- Source usage from **each provider's actual response fields** and use configurable, timestamped, provider/model/endpoint-specific price schedules. Support distinct input/output/image/request billing where applicable; never apply Luna token pricing to Jev.
- Show usage in-session only by default; no billing account integration or persistent server-side tracking is required. Totals across providers are estimates in a common display currency, not a consolidated invoice.

**SHOULD**

- Optionally display estimated spend **before** an additional refinement and skip nonessential refinement when it exceeds the configured per-inspection request/spend limit.
- Include a small explanatory note about why some images, providers/models and focused rechecks cost more, without overwhelming the presentation.

## 9. Presentation-quality UX and visual requirements

**These are requirements, not a design specification. Final colour palette, layout and branding are deliberately deferred.**

### Visual polish: MUST

- Feel like a **premium, current-generation product demonstration**, not a standard admin dashboard, basic form or developer debug screen.
- Have a coherent visual language, strong typographic hierarchy, careful spacing, polished iconography and consistent components.
- Use the actual uploaded photograph as the visual hero, paired with a visually compelling but **clearly illustrative neutral container diagram** for damage location. Neither should pretend to simulate actual damage geometry.
- Present classifications, certainty levels, damage-location markers, alternative readings and validation outcomes in ways understandable at a glance from a projected screen.
- Use restrained but high-quality micro-interactions, meaningful transitions and smooth changes between inspection states.
- Include attractive, carefully designed empty, loading, in-progress, supported-result, uncertain-result, insufficient-evidence and error states.
- Support a useful responsive layout; desktop presentation must be particularly strong.
- Be professionally finished: no placeholder content, broken controls, awkward overflow, walls of unformatted JSON or unexpected jumps.
- Maintain accessible contrast, keyboard interaction and a reduced-motion option.
- Make key interactions obvious without a walkthrough: select provider/model, enter relevant key, select photos, inspect, view visual damage locations, expand certainty or cost details, and export. No editor-like workflow.

### Demo experience: MUST

- Be ready for a **short live innovation-event presentation**, with a simple obvious main action and no setup maze.
- Show real analysis progress honestly; do not display fake percentages implying API-level progress that is unavailable.
- Run any automatic refinement silently within the normal progress. Progress uses a few plain stages (e.g. *Reading markings*, *Looking for damage*, *Checking the details*) and never mentions passes, refinement, candidates or retries. The app continues automatically and shows only outcomes, without asking the presenter to decide.
- Offer **clearly labelled recorded sample results** so the presenter can still demonstrate a complete inspection if connectivity, credentials or the beta API fail.
- Never masquerade recorded/simulated output as a live response from any provider.
- Make it easy to reset and switch between a clean container, a damaged container and a markings-rich container. Clearly show which provider/model produced the example.
- Keep technical depth available on demand without forcing the audience through it. Provider and model selection must feel like a purposeful demo choice, not a complicated setup form.

### Demo experience: SHOULD

- Add optional photo-relative highlighting in addition to the required neutral schematic with selectable location markers.
- Provide subtle, high-quality motion for location marker discovery and for the cost panel expanding from its compact indicator.
- Avoid modal-heavy UX and excessive technical jargon in the primary experience.

## 10. Confidence, validation and decisions

**MUST**

- Do not equate a reported 1.0 probability with guaranteed correctness.
- Never combine unrelated predicates into a fake single 'inspection accuracy' percentage.
- Distinguish **a model's top-choice probability** from provider-specific `confidence`, score or other metrics; do not assume every provider supplies the same fields or that any of them are empirically measured reliability.
- Treat certainty thresholds as adjustable POC heuristics and present **Confident**, **Likely**, **Uncertain**, **Can't tell** or **Not seen** (§8.4), not `supported`, `not established`, `user review required`, `confirmed`, `certified` or `safe`.
- Preserve alternative answers and conflicts, particularly when separate questions disagree or differ after refinement.
- Perform independent deterministic checks for ISO code-to-dimensions mappings, ISO 6346 check digits and gross/tare/payload arithmetic.
- **Do not** provide user overrides, manual corrections or confirmations in the POC; preserve competing interpretations transparently.
- Do not claim hazardous cargo is absent based solely on missing placards.
- Do not claim a component or face is undamaged because it was not photographed.
- Do not map a low-probability visible defect to a green *safe/undamaged* badge without adequate image coverage and appropriate qualifications.
- Do not let stylistic colour conventions confuse hazardous/safety warnings with mere classification uncertainty.

**SHOULD** establish initial trial thresholds using several differently labelled photos and report them as provisional, not scientific calibration.

## 11. Provider architecture, API constraints, security and reliability

### 11.1 Providers and model selection

**MUST** support **OpenAI Decisions (Luna)** and **TypeSafe System One (Jev)** as the first two genuinely working integrations. Neither is to be simulated behind a live-provider selector. The main UI, question intent, result view and validation logic must be shared.

**MUST**

- Let users choose the provider and an **image-capable, supported model/version**. Show a recommended stable choice per provider; select versions from a maintained supported-model catalogue rather than hardcoding options throughout the UI.
- Separate **provider**, **endpoint/API family**, **model identifier**, **display name**, **capability profile**, **experimental opt-ins**, **limits** and **pricing/version metadata**. Model identifiers are not interchangeable with provider names.
- Prefer reproducible pinned versions for innovation-event demonstrations. If a moving alias such as `jev-latest` or `jev-preview` is offered, visibly label it as a moving target and record the actual requested identifier and any resolved version reported by the API.
- Mark models that lack image input or required structured-decision support as unavailable for this inspection; unsupported modes must never appear to work by pretending they supplied evidence.
- Make it easy to add another version of an existing provider, or another provider altogether, without editing all the results components, certainty rules or container-domain logic.
- Keep provider/model identity attached to each inspection, source answer, damage finding, refinement, recorded fixture and cost entry. No silent fallbacks between vendors or cross-provider merging.
- Surface a provider/model's **experimental** capabilities and constraints without burying the presenter in warnings on the main screen.

**SHOULD** offer a provider/model comparison view as a separate, deliberate action that analyses the same photo/inspection goals independently. Show output differences, time, spend, unavailable capabilities and unresolved findings. **Never equate higher reported probability with higher ground-truth accuracy.** This is not required for the first polished release.

### 11.2 Provider-independent inspection contract

**MUST** define one versioned set of *semantic inspection questions and output concepts* covering:

- Identification and manifest-independent number reconstruction, including ISO 6346 rules.
- Equipment ISO code/dimensions, mass markings, capacity, DG placards and warnings.
- Visible damage types, affected components, image-relative regions, optional CEDEX mappings and coverage.
- Follow-up/refinement intent, alternatives, provenance, certainty/limitations and cost/usage evidence.

**MUST** translate this contract into the provider's request schema and normalise valid responses into a **shared inspection-result model**. The shared record must preserve:

- Candidate/selected answer, alternative choices, probabilities or scores **when genuinely supplied**, source question ID, request/pass ID, photograph reference, and original provider field meanings.
- Raw provider response (separately accessible), error/warning metadata, model/version and capability provenance.
- The distinction between **visible observation**, **standard-derived value**, **deterministic calculation**, **generated candidate** and **unresolved** finding.
- Image-relative locations with optional provider-supplied box coordinates; a box is supporting localisation, never proof that damage exists.
- Not-supported/not-assessed/not-visible states as different outcomes.

Provider adapters are responsible for authentication headers, supported image payloads, question-schema translation, request chunking/limits, response mapping, usage/cost extraction and error translation. Common domain rules, automatic refinement decisions, ISO check digits, mass arithmetic and the visual report must **not** need provider-specific rewrites.

Do not assume future providers are all Decisions-style models: an image-capable model returning validated structured JSON could be integrated later, provided the adapter can meet the inspection contract. A model that cannot support a particular feature must disclose that limitation and continue with the fields it can support.

### 11.3 Capability-aware inspection and refinement

**MUST** define per-model capability flags, at minimum: image input, choice/yes-no/score types or their equivalents, alternative probabilities, bounding boxes, multi-image support, supported image formats, per-question/request limits, usage reporting, cancellation and experimental requirements.

- Ask semantically equivalent questions across providers where possible, but **allow carefully tuned provider-specific prompt phrasing and choice construction**. Merely renaming Luna's JSON fields to Jev's would not establish equivalent performance.
- Apply independent deterministic ISO and weight validation after response normalisation, regardless of provider.
- Use the selected provider/model for bounded automatic second passes. Incompatible features should degrade gracefully, not cause a hidden provider switch or false result.
- Use a visible-defect predicate/classification before accepting a `box`. If Jev returns one box but several defects are suspected, do not present it as a complete multi-defect inventory.
- Preserve differences in confidence semantics; shared certainty labels are **heuristic evidence-support categories**, not equivalent calibrated model probabilities.
- The schematic damage-location view must work using **region classifications alone**. Bounding-box support is an optional enhancement; its absence must not break core damage presentation.

### 11.4 Initial provider specifics and versioning

**OpenAI Decisions / Luna**

- Use `POST https://api.openai.com/v1/decisions` and `gpt-6-luna` for initial image questions.
- Uses `input` text/image evidence and named `questions` (`predicate`, `choice`, `score`); answers arrive in an array. It does **not** supply arbitrary free-text extraction or bounding boxes from this endpoint.
- Respect documented per-request/per-choice limits and actual supported image formats. Never send WebP bytes falsely labelled as JPEG.
- Treat `luna_container_markings_classification_v3.json` and the earlier damage request as **Luna-specific reference assets**, to generalise and adapt rather than reuse blindly.
- Retain request/prompt version IDs. Do not include the synthetic 100-ID test manifest or pre-seed values known only from the demonstration image in general live requests.

**TypeSafe System One / Jev**

- Use the supported TypeSafe System One API, currently `POST https://api.typesafe.ai/v1/systemone`; image payloads go through the provider's supported `assets` mechanism and experimental image opt-in where required.
- Uses a `state` and a named question map; Jev's `choice`, `score` and `noul` types must be mapped by **meaning** to the shared inspection contract, not assumed to have the same wire format as Luna's questions.
- Image capability is experimental as of Jev 1.14's October 2026 release. The new experimental `box` capability is offered by `jev-1.14.0`; Jev `jev-1.13.0` can accept images under the experimental opt-in but must not be promised `box` support.
- Offer a suitable image-enabled pinned model/version, subject to live verification. Optional moving `jev-latest`/`jev-preview` aliases may be offered with an explicit warning that they can change.
- Validate Jev's actual image behaviour, answer formats, request limits and browser connectivity with **live smoke tests** before calling this integration complete. Jev prompt/question definitions and recorded example results need their own calibration rather than simply copying Luna's example outcomes.

**Future models/providers**

- Extending the app should chiefly require an adapter, capability/price/model catalogue entries, and provider-specific prompt/fixture definitions, **not a new UI flow or separate results schema**.
- Support a provider adding new question types, new model versions or altered pricing without invalidating older exported records.
- Explicitly label unsupported or experimental functions rather than fabricating standardised answers. Version the adapter and normalised-result schema to avoid misinterpreting historical output.

The exact supported version catalogue, model limits and prices should be verified immediately before implementation/demo. They are fast-changing service capabilities, not immutable product assumptions.

### 11.5 Static web app and provider API keys

**MUST** target Vue 3 with **static hosting** as the default POC deployment. No conventional application backend should be needed for the product model; external API feasibility still needs testing.

**MUST**

- Check **CORS/direct browser connectivity independently for both** initial provider endpoints before assuming a fully client-only implementation is possible.
- Use **bring-your-own-key** credentials specific to the selected provider. Clearly label whose endpoint receives the image and key. Never send an OpenAI key to TypeSafe, a TypeSafe key to OpenAI, or either key to unrelated services.
- Recognise that BYOK credentials held in browser JavaScript are accessible to code running in the page. A static frontend cannot promise server-grade secret protection.
- Never bake a key into static assets, source, URLs, analytics, logs, exception messages or exported inspection files; keep it in memory only and make clearing it simple. Do not use localStorage for credentials.
- Avoid third-party scripts/analytics that could observe runtime credentials or uploaded photographs.
- If browser-to-provider calls are technically blocked or unacceptably risky, permit a **minimal trusted serverless relay** as a documented deployment fallback. This is a deviation from *strictly static* and must be made explicit; keys must remain transient and must not be logged or persisted by the relay.
- Preserve usable partial analysis when a provider fails, becomes unavailable or rejects an unsupported model/feature; show provider-specific errors clearly and allow deliberate retries without unlimited chargeable loops.
- Prevent repeated clicks, retries or provider switches from duplicating charges or mixing stale results.

### 11.6 Provider-specific usage and cost accounting

**MUST** implement Section 8.5 with a single session ledger across multiple providers and models.

- Each line item identifies provider, endpoint, exact model/version, inspection, purpose, attempt, latency, status, returned usage and estimated USD cost.
- Price each call using the **correct provider/model/endpoint-specific effective-date rate and billing units**. If a provider bills input/output/image tokens, requests or another metric, calculate from the reported usage where supported. Never reuse another provider's pricing formula.
- For OpenAI **Decisions** currently, the documented `gpt-6-luna` baseline is **US$0.10 per 1,000,000 input tokens**, with no output/cache read/cache write charges at that endpoint (before any applicable processing or long-context adjustments). A 15,780-input-token standard request is approximately **$0.001578**. This is an example, not a permanent rate or a claim about other endpoints.
- For Jev, keep the current TypeSafe rate as a **separately maintained, timestamped configuration** verified against provider billing/pricing documentation. Do not assume it matches Luna, or that the response exposes identical usage fields.
- If the cost of a call cannot be estimated reliably, show **cost unavailable/partial estimate**, while retaining its request count and any known usage. Do not report unknown costs as zero.
- Show current inspection total and mixed-provider session total in the collapsed display, with expandable per-provider/model breakdown and a clear estimated-not-invoiced disclaimer.
- Recorded demos must never add pretend live charges or usage to the session ledger.

Initial source references: [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions), [TypeSafe Jev 1.14 announcement](https://typesafe.ai/blog/jev-1-14), and the official [TypeSafe docs](https://docs.typesafe.ai/).

## 12. Evaluation and acceptance

This is a *demonstration and learning POC*. The goal is to demonstrate the potential, measure limits transparently and support a convincing innovation session, **not to claim production-grade inspection accuracy**.

### 12.1 Required example scenarios

| Scenario | Expected observable behaviour |
| --- | --- |
| Clear rear-door image, no manifest | Complete or strongly supported ID; ISO code, dimensions and markings shown without requiring a supplied list. |
| Rear-door image with uncertain digits | Independent group/digit evidence; bounded candidate generation; check-digit validation; focused second request when appropriate. |
| ID still uncertain after refinement | App finishes automatically, displays confidently read partial characters and a shortlist of plausible alternatives as suggestions, explicitly labels the full ID unresolved and optionally suggests a closer photograph. No manual input. |
| Correct ID absent from an optional manifest | May select `other_not_listed`; never silently substitute a near-match. |
| Obvious dented side | Neutral container schematic displays approximate affected region markers and plausible `DT`/related damage classes; marker selection explains the finding without recreating the dent. |
| Apparently clean side | Low damage indicators, clear visibility/coverage state, no fabricated confirmed damage. |
| Rear-door-only photo | Door markings and door-region damage can be assessed; long-side and roof surfaces remain uninspected. |
| Partially obscured/distant image | Explicit 'uncertain' or 'not seen' findings; request closer evidence where valuable. |
| Printed weights disagree between questions | Arithmetic validation highlights conflict and labels calculated values separately. |
| High Cube / Super Heavy markings | Distinguishes height, width and weight signage; does not infer dangerous cargo from Super Heavy. |
| Live API unavailable | Usable, clearly recorded sample demonstration and actionable error state; sample costs are not added to live session charges. |
| Model confident about wrong character or weight | App surfaces incompatible evidence or validation failures instead of silently certifying the value. |
| Unseen side or roof | Schematic marks it uninspected, not undamaged, in whichever of the two views holds that face; the roof stays greyed out. |
| Automatic re-check runs | Cost indicator and expanded ledger include that additional call; the UI shows only the outcome and its certainty, with no pass wording. |
| Multiple containers inspected | Session cost accumulates across the full current browsing session; per-container costs remain individually inspectable. |
| Jev live inspection | Experimental image opt-in applied, Jev schema correctly interpreted, equipment/damage results rendered using the same inspection screens as Luna. |
| Jev experimental `box` unavailable or wrong | Preserve region-based damage assessment; don't invent or display a verified damage location merely because a box was returned. |
| Switch provider after a run | Prior result stays attributed to its originating provider/model; next run uses the newly selected credentials and request format. |
| Switch model version | Supported/versioned model selection applies to new requests, while recorded reports retain their original model identifier. |
| Add a future provider | Requires adding an adapter/capability/pricing/fixture configuration without rewriting shared identification, damage or results presentation. |
| Mixed-model demo session | Costs add up by call while expanded detail attributes each charge to the correct provider/model and marks missing estimates. |

### 12.2 POC acceptance criteria

- [ ] A presenter can open the app, choose Luna or Jev and an appropriate model/version, supply the matching key, choose one photo and start inspection with minimal explanation.
- [ ] Luna and Jev perform **real** image-based classification through their own supported APIs; the same user-facing result model and neutral damage schematic work for both.
- [ ] Changing provider/model starts a separate clearly attributed run without reusing incompatible responses, prompts or credentials.
- [ ] Model catalogue flags prevent unsupported model/capability choices and allow additional provider integrations without changes to the main results presentation.
- [ ] The demo works with **no manifest** and supports an optional genuine manifest without requiring one, with both initial providers.
- [ ] First-pass identification preserves character, grouped and check-digit evidence.
- [ ] A deliberately ambiguous ID triggers an automatic, silent re-check (subject to the request limit); the result shows the final reading, its certainty label and plausible alternatives, with no pass or candidate wording.
- [ ] Generated IDs are ISO-format/check-digit validated; unresolved results remain unresolved, with optional nonblocking suggestions and **no manual resolution controls**.
- [ ] ISO code and dimensions are decoded consistently, and printed vs derived weights are separated.
- [ ] At least one obvious damaged and one apparently clean container produce readable damage assessments, a neutral schematic with meaningful location markers, and appropriate uncertainty/coverage states.
- [ ] Actual CEDEX location coding is not asserted when photo face/orientation is unknown.
- [ ] Contradictions, missing evidence and insufficient photographic coverage are shown rather than suppressed.
- [ ] Users can inspect alternatives/raw answers and export a consolidated record; the main inspection can be completed without manually classifying anything.
- [ ] All main UI states look finished and work at desktop presentation size.
- [ ] Separate sample fixtures for Luna and Jev are clearly distinguished from live calls; the recorded-demo flow works without an API connection.
- [ ] User-supplied provider-specific API keys are never crossed, persisted in browser storage or placed in exported inspection files.
- [ ] Important readings have accessible colour-coded certainty categories; low certainty and severe damage have distinct visual semantics.
- [ ] A compact cost display always shows current-container and cumulative-session estimates **across all providers/models**; expanding it reveals each actual live API request, provider, model, reported usage and provider-specific estimated cost.
- [ ] Recorded demo examples do not create or imply real API expenditure, and the rate/usage assumptions are transparent.
- [ ] The app can recover cleanly from a failed API call and return to an inspectable state.

### 12.3 Evaluation data

**SHOULD** use a small, pre-prepared set of independently labelled inspection examples with known fields and visible-damage labels. These labels are maintained outside the attendee-facing inspection flow; **demo users are never asked to annotate or correct model results**. Assess:

- Exact full-ID accuracy, including unseen IDs and manifest-absent cases.
- Check-digit-valid incorrect matches (to avoid treating a passing check digit as accuracy).
- Top-1 vs alternatives for group/character/full-ID questions.
- First-pass vs refined-pass accuracy, including cases where refinement makes results worse.
- Accuracy of ISO code, length, height, type and warning recognition.
- Exact gross/tare/payload readings and consistency.
- Damage detection recall and false alarms, by visible class and region.
- Coverage and uncertainty reporting quality.
- Median/per-inspection latency, request count, token usage and cost, including adaptive second-pass overhead, segmented by provider/model.
- Provider-specific missing capabilities, response mapping correctness, recorded fixture fidelity and changes between pinned model versions.
- For the **same labelled photos**, compare model answers and first/second-pass changes, but report observed ground-truth accuracy separately from reported probabilities.
- Correct treatment of uncertainty and the rate at which autonomous refinement truly improves final results.

Include examples that are **not** tailored to the prompt's choices. Prompt changes should be evaluated across multiple images and **per supported provider**, not judged only by improved results on the original APHU photo.

## 13. Demo resilience, trust and practical safeguards

**MUST**

- Provide at least three pre-validated, visually distinct demo scenarios **for the initial providers**: legible rear doors with markings, obvious side damage, and an apparently clean/low-defect view. Ideally also include a deliberately ambiguous container number to demonstrate how uncertainty and alternatives are shown.
- Keep sample observations and responses labelled **Recorded demonstration: [provider/model]** and never merge their token/cost records into the live usage ledger.
- Let the presenter run consecutive inspections with the same provider without re-entering its key during the current page session; keep each provider's credential transient and provide clear/reset actions.
- Show high-value findings progressively when calls complete, without claiming that queued steps have already finished; partial failures should leave the successful findings visible.
- Avoid duplicate costly submissions caused by repeated clicks or accidental retries; handle cancellation and stale results when switching photos.
- Warn when a photograph clearly contains multiple containers and avoid transferring the markings/damage of one container to another.
- Treat text printed on containers or embedded in uploaded photographs as **visual evidence only**, never as instructions that override the app's questions or the user's request.
- Use no fabricated completion percentage, fake live token meter or synthetic confidence value. Motion and timing should make a real demo engaging without misrepresenting the backend.
- Use an evidence model that can explain every displayed field and every schematic marker in terms of specific image(s), question name(s), candidate/validation logic and request pass.
- Keep UI certainty stable and interpretable as asynchronous results arrive; clearly indicate when an answer is provisional and may change after a queued follow-up.

**SHOULD**

- Support an easily accessible presentation-safe sample fallback, helpful when network/API access is temporarily unavailable, with no dependence on entering a key.
- Include a compact *Why this model suggested this* disclosure for technically curious attendees, with top alternatives, provider/model attribution and deterministic checks, without forcing it on the primary result screen.
- Make very small cost values legible and visually satisfying without implying dramatic monetary savings from a tiny sample.

## 14. Dependencies and starting reference assets

Use the existing **Luna-tested** artefacts as starting material, not immutable specifications or proof that Jev has been evaluated:

- `luna_container_markings_classification_v3.json`: equipment markings, 100-ID test manifest, serial group/digit comparisons, exact-value choices and warnings.
- `luna_decisions_container_classification_v2.json`: side-damage CEDEX definitions and regional inspection approach.
- **Jev provider reference:** TypeSafe's [October 2026 Jev 1.14 release](https://typesafe.ai/blog/jev-1-14) documents experimental images and single-box questions. Jev requires its own suitable image requests, calibration and captured live example responses before the demo.
- Previously tested photographs: rear-door `front-45g1.jpg`; dented side `container-dent.jpeg`; apparently clean side `container-side.jpg`; and earlier weathered container image.

**Important correction for generalisation:** The V3 JSON currently contains *synthetic* 100-ID test choices and some value lists constructed around the APHU sample. Do **not** ship that synthetic manifest as if it were real expected cargo. Replace it with optional user-provided candidates or evidence-generated candidates, and retain `other`/`unreadable` outcomes. Likewise, exact weight lists must not bias the app towards the demonstration container.

Relevant public references:

- [OpenAI Decisions API guide](https://developers.openai.com/api/docs/guides/decisions)
- [OpenAI Decisions create reference](https://developers.openai.com/api/reference/resources/decisions/methods/create)
- [BIC ISO 6346 check-digit calculator](https://www.bic-code.org/check-digit-calculator/)
- [ISO 9897 general-purpose CEDEX component, damage and location reference](https://www.iicl.org/iiclforms/assets/File/public/cedex/ISO_9897_General_Purpose_Container_Standard.pdf)

## 15. Definition of success

The POC is successful when an audience can **select a provider/model** and see it recognise a container and its markings, **explore** suspected damage on a neutral container/location visual, **see** the app reach sensible, clearly labelled conclusions (re-checking doubtful readings behind the scenes using domain rules), and **see** provider-aware estimated cost per container and session, while understanding what is and is not proven. The user is not required to interpret, correct or confirm any model output.

It should feel impressive, fast, polished and technically credible, while treating Luna and Jev as the first two replaceable integrations rather than permanent UI assumptions. An unresolved result that is explained well is more valuable than a confidently wrong one. **Intelligent restraint and transparent uncertainty are part of the demonstration, not failures to hide.**
