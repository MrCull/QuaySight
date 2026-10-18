# ResultsScreen

The results screen is the main inspection screen once photos are uploaded and results are back. It uses the full width: the photos in a strip across the top, then the damage view beside the readings. It also defines how results arrive; use *Replay result arrival* in the preview to watch it again. The `AnalysingScreen` card shows the same screen while the analysis is still running.

## Layout (desktop, 1920)
- **Top bar** (`surface`, 64px): the name in `display`, the crumb (*Container inspection*), `NewInspection` centred, the `SettingsChip` (live) or, in demo mode, the chip naming who answered the recording, the quiet `CostIndicator` (`qs-cost--quiet`) and *Export*. A live run needs no separate run chip: changing provider or model blanks the screen, so the settings chip always names what produced the result on screen.
- **Photo strip** (`.rs-strip`): the inspection's photos (1 to 5) in one centred row of fixed height (4 x `--space-8`, 256px on a large screen). Each photo is at its own aspect ratio (`surface-sunken`, `radius-lg`), so one photo is never stretched to the width; the row height also shrinks so that five landscape photos and their gaps fit one row at 1920px. Under each photo sit its number and its face chip (*Doors*, *Right side* …), never over it. A photo that shows no container carries the same chip and a dropped notice. The hover `Loupe` and click-to-enlarge `PhotoViewer` work on every photo. While the run is in flight the `StageProgress` card sits centred under the strip; it lifts away on landing.
- **Notices** (`.rs-notices`): the ones that remain (recorded demonstration, different containers, dropped photos, failed, cancelled, partial, failed parts) sit compactly under the strip, side by side when there are several.
- **Detail area** (`.rs-detail`), two columns:
  - **Left, wide**: the damage view. The `ContainerSchematic`'s two views (rear and right side, front and left side) are stacked, with a column of `FindingCard`s beside them. Selecting a pin, a card or a photo area selects all three.
  - **Right, narrower** (8 x `--space-8`, 512px): **What we found** first (the `WhatWeFound` card: a `display-md` headline, the caveats first, then one row per topic; a later change replaces it with key-fact tiles), then `ContainerId` with any plausible alternative ("Also possible …") and "Where we read the ID". If the ID was not identified, the optional `ManifestRetry` panel sits directly under it. Then the seal, *Container details* (the `UnitsToggle` at its far end, then the `FieldRow`s), *Markings* (one `FieldRow` per marking), *Export* and an optional suggestion `Notice`.
- **Narrow** (1100px and below): one column, the damage first, then the readings. On phones the photos wrap onto further rows (smaller height) and nothing scrolls sideways.

## Arrival choreography
1. **Analysing** (`.qs-arriving`): the photo is shown at once. A soft brand sweep passes over it, a `StageProgress` card lists plain stages (*Reading the ID*, *Reading container details*, *Checking for damage*) with their measured times, and the readings column shows `qs-skeleton` shimmer. Nothing shows a percentage.
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
The preview shows the whole intended screen. The app already ships the top bar, the photo strip with the analysing sweep, the stage card under it, **What we found** (the `WhatWeFound` card at the top of the readings column, caveats first), `ContainerId` with *Also possible* and the *Best interpretation* / *What remains uncertain* explanation, `ManifestRetry`, the readings (`FieldRow`s, under *Container details*), the damage view and the arrival choreography. Photos are one strip, not a main photo with thumbnails: resting the mouse on a photo shows the `Loupe`, and clicking a photo opens it full screen in `PhotoViewer`, whose arrows and ←/→ keys step through the photos. The preview's photo overlays (pills, zoom buttons) are not built: nothing sits on a photo. These parts are deliberately not built yet; each is a follow-up, not a parity fix:
- The *Add photo* tile: photos are chosen together, and there is no replace control: `NewInspection` is the way to change photos.
- **Photo areas** drawn on the photo (photo-relative highlight is deferred), and **rotation** of a photo.
- The suggestion `Notice`.
- **Export** in the top bar: the app puts *Export JSON*, *Download raw response* and *Download summary* at the end of the readings column.

Other app details the preview does not show:
- The header has three zones: brand left, `NewInspection` centred, and on the right, muted, the `SettingsChip` (or `RunChip` in demo mode) and the cost indicator. A live result carries no "Live result" notice: the chip's tooltip names the exact model version and the key status.
- *Container details* holds the ISO code and what it decodes to, then the weights, then the four equipment checks (reefer, open top, tank, flat rack). A live run reads both units, so it adds the printed **PAYLOAD** and **CUBIC CAPACITY** rows, which the preview's illustrative sample (kg only, one calculated payload) does not carry. *Markings* follows it as its own card, one `FieldRow` per marking with a `MarkingBadge` for each marking seen (see `MarkingBadge`).
- The *Container details* heading carries the `UnitsToggle` (Metric / Imperial) at its far end, on any result that has details to show. It starts on Metric, is remembered in the browser and is display only: exports always carry both units.
- A group a run never asked (the weights on a live run, until they are read; the equipment checks and markings on a recorded sample) says *Not assessed in this inspection* in one sentence, not a column of *Not seen* chips: *Not seen* means "in no photo". The damage view says *Damage not assessed in this inspection* in the same way.
- The inspection starts itself when photos or a sample are chosen, so there is no start row. The header's *New inspection* reads *Cancel* while a run is in flight.
- A result that is missing a part (cancelled, or one part's request failed) carries a notice under the photo strip: `qs-notice--partial` after Cancel, `qs-notice--error` naming the part that failed. Everything that arrived is shown.
- The stage card is titled with the model: *Analysing with Jev latest*.

## Crops
The ID, the seal and each placard carry an enlarged crop of where it was read (`PhotoCrop`), captioned "Where we read the ID" (or "…the seal", "…placard 1"), with " · Photo N" when there are several photos. Tapping the crop shows the full photo with the region outlined using `qs-photo-region` (one outline style for all; hazard colour stays on the `MarkingBadge` diamond). Tapping again returns to the close-up. No usable box, or a photo that will not load: no crop and no caption.

## Rules
- Never surface passes, refinement or candidate generation. Any re-check happens inside the stage it serves, and only its outcome lands.
- The order of arrival follows importance: identity, then readings, then damage. Never animate a value that isn't real yet.
- In sample mode, the `Notice` *Recorded demonstration* sits above the summary and the cost pill reads *Sample*.
