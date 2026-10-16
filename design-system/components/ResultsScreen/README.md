# ResultsScreen

The results screen is the main inspection screen once photos are uploaded and results are back. It shows the photo as hero, the readings beside it, and the damage view below. It also defines how results arrive; use *Replay result arrival* in the preview to watch it again. The `AnalysingScreen` card shows the same screen while the analysis is still running.

## Layout (desktop, 1440)
- **Top bar** (`surface`, 64px): the name in `display`, the crumb (*Container inspection*), the `SettingsChip` (live) or, in demo mode, the chip naming who answered the recording, the quiet `CostIndicator` (`qs-cost--quiet`), *Export* and *New inspection* (`NewInspection`). A live run needs no separate run chip: changing provider or model blanks the screen, so the settings chip always names what produced the result on screen.
- **Left**: the photo stage (`surface-sunken`, `radius-lg`) with image-relative areas drawn on the photo, the face pill and the stand-in or zoom controls; the thumbnail strip with an *Add photo* tile; then **What we found**, with a `display-lg` headline, a plain-English paragraph and a stat row.
- **Right** (540px): `ContainerId` with any plausible alternative ("Also possible …"). If the ID was not identified, the optional `ManifestRetry` panel sits directly under it. Then Equipment `FieldRow`s, Markings, and an optional suggestion `Notice`.
- **Full width**: the damage view. The `ContainerSchematic`'s two views (rear and right side, front and left side) are stacked one above the other, with a column of `FindingCard`s beside them. On wide screens (viewport 1800px and up) the views sit side by side and the cards form a row beneath. Selecting a pin, a card or a photo area selects all three.
- **Phone**: the same order stacked, the photo first.

## Arrival choreography
1. **Analysing** (`.qs-arriving`): the photo is shown at once. A soft brand sweep passes over it, a `StageProgress` card lists plain stages (*Reading markings*, *Looking for damage*, *Checking the details*) with their measured times, and the right column shows `qs-skeleton` shimmer. Nothing shows a percentage.
2. **Landing** (`.qs-arrived`, triggered when the response is parsed):
   - The stage card lifts away.
   - Photo areas draw their dashed outlines one by one, about 180ms apart.
   - ID characters settle into place left to right (45ms stagger), and their certainty underlines draw in after them.
   - Readings rise in (`qs-rise`, 70ms stagger).
   - Probability bars grow from zero.
   - On the drawing, zones fade in and pins drop with one ripple each.
   - The quiet cost line changes once, to the real figure. It never ticks up and does not glow (the glowing count belongs to the pill variant only).
3. All of it runs on `duration-arrive` with eased curves and finishes within about 1.6s. Under `prefers-reduced-motion`, the result simply appears.

## In the app today
The preview shows the whole intended screen. The app already ships the top bar, the photo stage with the analysing sweep and stage card, `ContainerId` with *Also possible* and the *Best interpretation* / *What remains uncertain* explanation, `ManifestRetry`, the readings (`FieldRow`s, under *Container details*), the damage view and the arrival choreography. These parts are deliberately not built yet; each is a follow-up, not a parity fix:
- **What we found** (headline, paragraph, stat row) under the photo.
- The **thumbnail strip** with *Add photo* (multi-photo is deferred); a single photo shows a *Replace photo* button instead.
- **Photo areas** drawn on the photo (photo-relative highlight is deferred), and the stand-in and zoom controls.
- **Markings** (`MarkingBadge`s) and the suggestion `Notice`.
- **Export** in the top bar: the app puts *Export JSON*, *Download raw response* and *Download summary* under the readings.

Other app details the preview does not show:
- A live result carries a `qs-notice--live` above the ID (see `Notice`), the counterpart of *Recorded demonstration*.
- A run that never read the size code or the weights (every live run today reads the ID only) shows *Container details* with one sentence, *Not assessed in this inspection*, not a column of *Not seen* chips: *Not seen* means "in no photo". The damage view says *Damage not assessed in this inspection* in the same way.
- Before the result lands, the one primary action sits under the photo (`qs-btn--lg`: *Start inspection* in demo mode, *Run live inspection* live; *Analysing…* while busy). Once the result lands it is gone; *New inspection* is the next step.
- The stage card is titled with the model: *Analysing with Jev latest*.

## Rules
- Never surface passes, refinement or candidate generation. Any re-check happens inside *Checking the details*, and only its outcome lands.
- The order of arrival follows importance: identity, then readings, then damage. Never animate a value that isn't real yet.
- In sample mode, the `Notice` *Recorded demonstration* sits above the summary and the cost pill reads *Sample*.
