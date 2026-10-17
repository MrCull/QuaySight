# ResultsScreen

The results screen is the main inspection screen once photos are uploaded and results are back. It shows the photo as hero, the readings beside it, and the damage view below. It also defines how results arrive; use *Replay result arrival* in the preview to watch it again. The `AnalysingScreen` card shows the same screen while the analysis is still running.

## Layout (desktop, 1440)
- **Top bar** (`surface`, 64px): the name in `display`, the crumb (*Container inspection*), the `SettingsChip` (live) or, in demo mode, the chip naming who answered the recording, the quiet `CostIndicator` (`qs-cost--quiet`), *Export* and *New inspection* (`NewInspection`). A live run needs no separate run chip: changing provider or model blanks the screen, so the settings chip always names what produced the result on screen.
- **Left**: the photo stage (`surface-sunken`, `radius-lg`) with image-relative areas drawn on the photo, the face pill and the stand-in or zoom controls; then the thumbnail strip with an *Add photo* tile.
- **Right** (540px): **What we found** first (the `WhatWeFound` card: a `display-md` headline, the caveats first, then one row per topic), then `ContainerId` with any plausible alternative ("Also possible …"). If the ID was not identified, the optional `ManifestRetry` panel sits directly under it. Then *Container details* (the `UnitsToggle` at its far end, then the `FieldRow`s), *Markings* (one `FieldRow` per marking), and an optional suggestion `Notice`.
- **Full width**: the damage view. The `ContainerSchematic`'s two views (rear and right side, front and left side) are stacked one above the other, with a column of `FindingCard`s beside them. On wide screens (viewport 1800px and up) the views sit side by side and the cards form a row beneath. Selecting a pin, a card or a photo area selects all three.
- **Phone**: the same order stacked, the photo first.

## Arrival choreography
1. **Analysing** (`.qs-arriving`): the photo is shown at once. A soft brand sweep passes over it, a `StageProgress` card lists plain stages (*Reading the ID*, *Reading container details*, *Checking for damage*) with their measured times, and the right column shows `qs-skeleton` shimmer. Nothing shows a percentage.
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
The preview shows the whole intended screen. The app already ships the top bar, **What we found** (the `WhatWeFound` card at the top of the readings column, caveats first), the photo stage with the analysing sweep and stage card, `ContainerId` with *Also possible* and the *Best interpretation* / *What remains uncertain* explanation, `ManifestRetry`, the readings (`FieldRow`s, under *Container details*), the damage view and the arrival choreography. These parts are deliberately not built yet; each is a follow-up, not a parity fix:
- The **thumbnail strip** with *Add photo* (multi-photo is deferred); a single photo shows a *Replace photo* button instead.
- **Photo areas** drawn on the photo (photo-relative highlight is deferred), and the stand-in and zoom controls. **Rotation** of a photo is deferred too.
- The suggestion `Notice`.
- **Export** in the top bar: the app puts *Export JSON*, *Download raw response* and *Download summary* under the readings.

Built in place of the zoom controls: photo zoom/pan and switching between photos (spec §8.2). Resting the mouse on a photo shows the `Loupe` beside the cursor; clicking a photo opens it full screen in `PhotoViewer`, whose arrows and ←/→ keys step through the photos.

Other app details the preview does not show:
- A live result carries a `qs-notice--live` above the ID (see `Notice`), the counterpart of *Recorded demonstration*.
- *Container details* holds the ISO code and what it decodes to, then the weights, then the four equipment checks (reefer, open top, tank, flat rack). A live run reads both units, so it adds the printed **PAYLOAD** and **CUBIC CAPACITY** rows, which the preview's illustrative sample (kg only, one calculated payload) does not carry. *Markings* follows it as its own card, one `FieldRow` per marking with a `MarkingBadge` for each marking seen (see `MarkingBadge`).
- The *Container details* heading carries the `UnitsToggle` (Metric / Imperial) at its far end, on any result that has details to show. It starts on Metric, is remembered in the browser and is display only: exports always carry both units.
- A group a run never asked (the weights on a live run, until they are read; the equipment checks and markings on a recorded sample) says *Not assessed in this inspection* in one sentence, not a column of *Not seen* chips: *Not seen* means "in no photo". The damage view says *Damage not assessed in this inspection* in the same way.
- Before the result lands, the one primary action sits under the photo (`qs-btn--lg`: *Start inspection* in demo mode, *Run live inspection* live; *Analysing…* while busy, with *Cancel* beside it). Once the result lands it is gone; *New inspection* is the next step.
- A result that is missing a part (cancelled, or one part's request failed) carries a notice above the ID: `qs-notice--partial` after Cancel, `qs-notice--error` naming the part that failed. Everything that arrived is shown.
- The stage card is titled with the model: *Analysing with Jev latest*.

## Crops
The ID, the seal and each placard carry an enlarged crop of where it was read (`PhotoCrop`), captioned "Where we read the ID" (or "…the seal", "…placard 1"), with " · Photo N" when there are several photos. Tapping the crop shows the full photo with the region outlined using `qs-photo-region` (one outline style for all; hazard colour stays on the `MarkingBadge` diamond). Tapping again returns to the close-up. No usable box, or a photo that will not load: no crop and no caption.

## Rules
- Never surface passes, refinement or candidate generation. Any re-check happens inside the stage it serves, and only its outcome lands.
- The order of arrival follows importance: identity, then readings, then damage. Never animate a value that isn't real yet.
- In sample mode, the `Notice` *Recorded demonstration* sits above the summary and the cost pill reads *Sample*.
