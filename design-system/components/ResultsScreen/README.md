# ResultsScreen

The results screen is the main inspection screen once photos are uploaded and results are back. It shows the photo as hero, the readings beside it, and the damage view below. It also defines how results arrive; use *Replay result arrival* in the preview to watch it again. The `AnalysingScreen` card shows the same screen while the analysis is still running.

## Layout (desktop, 1440)
- **Top bar** (`surface`, 64px): the name in `display`, the inspection crumb, the run's provider and model chip, the `CostIndicator`, *Export* and *New inspection*.
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
   - The cost pill glows once and counts from the previous figure to the real new one.
3. All of it runs on `duration-arrive` with eased curves and finishes within about 1.6s. Under `prefers-reduced-motion`, the result simply appears.

## Rules
- Never surface passes, refinement or candidate generation. Any re-check happens inside *Checking the details*, and only its outcome lands.
- The order of arrival follows importance: identity, then readings, then damage. Never animate a value that isn't real yet.
- In sample mode, the `Notice` *Recorded demonstration* sits above the summary and the cost pill reads *Sample*.
