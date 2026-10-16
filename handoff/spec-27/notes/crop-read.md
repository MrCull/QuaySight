# Crop read (D) and what later tickets need from it (#31)

Branch: `worktree-agent-af587df8de12c6bca`. Code: `src/domain/cropRead.ts` (pure: `usableIdBox`, `cropRegion`,
`combineIdReadings`, the `idCropRead` record field), `src/plan/requests/idCropRead.ts` (request id `crop`,
purpose "Reading the ID up close", stage `id`, `optional`, `after: [readId]`, `appliesTo: route.entry.box`),
`src/services/scalePhoto.ts` (`cropPhoto`).

## Seams you can reuse

- **ID request answer** (`readId`, the survey #32/#33 extend): `IdAnswer` now carries `readings` for Jev
  too (not only Luna) and `box?: IdBox | null` (the `container_box` answer). If you replace how the ID
  request reads Jev, keep both fields filled or D will never run (`needed` checks a usable box and readings).
- **Cropping any box (E's weight crop):** `cropPhoto(ctx.photo, box, route.entry.photoLimits)` returns
  `{ photo, region }`. It cuts the prepared photo around the box with a margin of 0.35 × the box's long side,
  widens a too-thin crop, and scales it to the largest size within the limits. To send it, use
  `askDecisions({ ...ctx, photo }, ask)`. The pure geometry is `cropRegion(size, box, limits)`.
- **`largestWithin(size, limits)`** (`photoFit.ts`): the largest size within the limits. It enlarges, so use
  it only for crops. Whole photos are never enlarged, Luna's included: the user decided this on 16 Oct
  after live evidence (see the research note).
- **Codec:** `DecodedPhoto.toJpegRegion(region, w, h)`. The fake codec (`__mocks__/imageCodec.ts`) now
  decodes `"jpeg WxH"` blobs again, and describes a crop as `"jpeg WxH from RWxRH at X,Y"`. Store tests can
  assert which image reached a request.
- **`ChoiceReading.probability`** (optional): the chosen character's probability, set by
  `readIdCharacters`. `combineIdReadings` compares readings by it (or by certainty word when it is absent).
- **Jev mapping:** `jevCaveatsOf(answers)` and `jevIdReading(readings, caveats)` (`jev.ts`) build a
  reading from per-position readings. `JevMapping` gains `readings` and `caveats`.

## Live smoke without a canvas

`src/services/__tests__/browserCodec.ts` is a real decoder and canvas through Playwright's Chromium, for
opt-in live specs in Node. Use it with `vi.mock('../imageCodec', () => import('./browserCodec'))` and set
`PW_CHROMIUM_PATH`. A live run can then go through the store exactly as the app makes it (see the Jev test
in `coyu.live.spec.ts`).

## Live facts (16 Oct 2026)

- **Jev latest:** reads `COYU2668130` on the full photo. The crop read reads it at about 1.0 per character.
- **Luna through the app's own path** (store, canvas re-encode): `CO?U22?8130`, with position 6 misread as
  2, on both routes. The Luna smoke sends the original bytes instead and does not cover that path.
- **Enlarging for Luna:** dropped by decision.

## Request count

A Jev run is A + D (+ manifest); Luna is A + F (+ manifest). The cap of 6 still holds for
A, D/F, B, C, E plus manifest, so `maxRequestsPerInspection` was not changed.
