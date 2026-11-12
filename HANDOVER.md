# Handover: visual redesign (PR #126)

Branch `claude/loving-hopper-85brdw`, PR https://github.com/MrCull/QuaySight/pull/126 (open, base `main`).

## Done

- First screen: hero photograph (`src/components/SetupHero.vue`) beside the setup card; "Enter as demo user" is a button.
- Sample picker, photo stage, panel shadows, full-width single schematic view, larger drop zone: all in `src/styles/atmosphere.css` (app layout only, `rs-*`; `bundle.css` untouched).
- Fonts bundled via `@fontsource/*` (imported in `src/main.ts`); Google Fonts links removed from `index.html`.
- New tokens in `design-system/tokens.json` (regenerated `tokens.css`): `hero-ground`, `on-hero`, `on-hero-muted`, `shadow-panel`, `shadow-lift`.
- `design-system/README.md` and `docs/user-guide.md` updated; `docs/images/*.png` re-captured.
- `e2e/layout.spec.ts` expects the photo strip about 320px tall (was 260px).

## Last change (not yet verified in a browser)

The owner said the hero wording "makes zero sense". The copy in `SetupHero.vue` was rewritten in plainer words and the photo shade darkened so the markings painted on the container no longer show through the headline. Still to do:

1. Run the app (`npm run dev`), look at the first screen in light, dark and phone widths, and confirm the new wording with the owner.
2. Re-capture `docs/images/setup-card.png`, `setup-provider-list.png` and `mobile-setup.png` (they still show the old wording).
3. Run `npm run check` and the e2e suite once more.

## Things to know

- `OPENAI_API_KEY` and `OPENROUTER_API_KEY` are set in the cloud environment, so a plain `npx vitest run` runs the `*.live.spec.ts` tests against the real APIs (costs money, rewrites `src/fixtures/live/*.json`). Unset both first: `unset OPENAI_API_KEY OPENROUTER_API_KEY`.
- Failing on `main` as well, not caused by this branch: 22 unit tests (9 files) and 2 Playwright tests (`demo.spec.ts:143`, `newInspection.spec.ts:222`, both the manifest offer).
- `npm run screenshots` (the harness) has not been run to completion against the new screens.
- Full-page Playwright screenshots can drop elements still running the `qs-rise` blur animation; freeze animations before capturing.

## Ideas offered to the owner (none started)

Photo overlay of readings; batch mode; printable report; session history; model comparison; camera capture with coaching; manifest CSV import; before/after comparison; owner/BIC lookup; presenter mode.
