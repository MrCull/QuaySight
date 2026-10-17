# Loupe

The loupe is a magnifier. When the presenter rests the mouse on the main container photo, or on any photo in the 2–4 photo grid, it shows a close-up of the spot under the pointer beside the cursor. Small printed markings can then be read without opening the full-screen `PhotoViewer`. Together they answer the spec's §8.2 MUST: zoom/pan and switching between photos.

## Anatomy
- `.qs-loupe`: one square floating panel, `--space-8` × 3.5 (224px) a side, on `surface-raised` with `shadow-raised`, a `line-strong` border and `radius-md`. It is `position: fixed` and ignores the pointer (`pointer-events: none`).
- Its background is the **original** photo, the full-resolution source held for the inspection. The app sets `left`, `top`, `background-image`, `background-size` and `background-position` inline as the pointer moves.
- Nothing else. No children, no overlays (no damage or ID regions, now or later), and no outline on the source photo marking the magnified area.

## Behaviour
- **Delay:** it appears after **330ms** of the pointer resting on a photo, never sooner. Once shown it follows the pointer straight away.
- **Hiding:** straight away, when the pointer leaves the photo or moves onto the letterbox bars of the `contain`-fitted image. Pressing the photo hides it too; the click still opens `PhotoViewer`.
- **Carry-over:** if the pointer reaches another photo within about **150ms**, the loupe carries over with no new delay. After a longer gap the full 330ms applies again.
- **Placement:** `--space-5` below and to the right of the pointer, so it never covers the spot being looked at. Near the right or bottom edge of the viewport it flips to the left or above.
- **Magnification:** about 3× the displayed size, capped at the original's real resolution, so one original pixel is never stretched over more than one loupe pixel (no blurry upscaling). There is no mouse-wheel zoom; the wheel keeps scrolling the page.
- **Layer:** z-index 35, above the top bar (21) and the cost bottom sheet (30), below `PhotoViewer` (40). It is hidden while the viewer is open.
- **When:** during analysis as well as after results.
- **Motion:** a fade over `duration-fast`. Under `prefers-reduced-motion`, or with the app's `qs-reduced-motion` class, it appears instantly.

## Accessibility and input
- It is decorative and mouse-only, so it carries `aria-hidden="true"`. Keyboard users get the full-screen `PhotoViewer` from the same photo button.
- It is off for touch and pen pointers and on coarse-pointer devices. A tap still opens the viewer.

## Don't
- Don't give `PhotoCrop` close-ups or demo sample tiles a loupe.
- Don't draw anything in the loupe or on the source photo, and don't show passes, candidates or anything about how the photo was read.
- Tokens only; don't re-colour `qs-loupe` locally.
