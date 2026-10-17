# PhotoViewer

The photo viewer shows the original container photo filling the screen. The presenter opens it by clicking, tapping, or focusing and pressing Enter/Space on the main photo or on any photo in the 2–4 photo grid. It answers the spec's §8.2 MUST, "give the image a central role".

## The one sanctioned full-screen layer
Elsewhere this system says "never a modal" (`Notice`, `NewInspection`, `SettingsDrawer`). The viewer is the single exception, because **the photo is the hero**: the presenter is showing the container itself, and nothing else on screen matters while they do. No other component may become a full-screen or modal layer by pointing at this one.

- **Backdrop:** the `scrim` token, with a light blur. Never a solid colour.
- **z-index 40**, above every other layer: cost panel 10 (30 as the narrow-screen bottom sheet), demo banner 20, settings drawer 20, top bar 21. It covers the analysing sweep too: the viewer opens during analysis as well as after results.

## Anatomy
- `.qs-viewer`: the fixed layer, `role="dialog"`, `aria-modal="true"`, named after the caption (or "Photo" with one photo). It takes focus when it opens.
- `.qs-viewer__img`: the **original** photo, the full-resolution source held for the inspection, fitted with `object-fit: contain` and `image-orientation: from-image`. Nothing is drawn on it: no damage regions, no ID box, now or later. No zoom inside the viewer.
- `.qs-viewer__cap` (with `qs-type-caption`): "Photo N of M · <face>" on `scrim` in the bottom-left corner. The face is the survey's face chip, once it has named one; before that the caption is just "Photo N of M". Shown only with 2 or more photos.
- `.qs-viewer__nav--prev` / `--next`: round buttons with the `chevron` glyph turned left and right, "Previous photo" / "Next photo". The ← and → keys do the same. Both wrap around at the ends. Shown only with 2 or more photos.
- `.qs-viewer__close`: the visible ×, "Close photo".

## Behaviour
- **Closing:** any click (on the photo or the backdrop), the ×, or Esc. The arrows step through photos and do not close it. Opening adds no browser-history entry, so Back is not involved.
- **Focus:** returns to the photo that opened it.
- **Touch:** a tap opens it, the same as a click.
- **Motion:** a fade over `duration-base`. Under `prefers-reduced-motion`, or with the app's `qs-reduced-motion` class, it appears instantly.

## Photos as controls
Each main or grid photo is a `<button>` named "Enlarge photo N of M" ("Enlarge photo" with one photo), with a `zoom-in` cursor and the `focus-ring` outline. `PhotoCrop` close-ups keep their own tap-to-toggle and sample tiles keep click-to-choose; neither opens the viewer.

## Don't
- Don't put overlays, results, certainty or text other than the caption on the viewer.
- Don't show passes, candidates or anything about how the photo was read.
- Tokens only; don't re-colour `qs-viewer` parts locally.
