# Handover: visual redesign (PR #126)

Branch `claude/loving-hopper-85brdw`, PR https://github.com/MrCull/QuaySight/pull/126 (open, base `main`).

## Done

- First screen: hero photograph (`src/components/SetupHero.vue`) beside the setup card; "Enter as demo user" is a button.
- Sample picker, photo stage, panel shadows, full-width single schematic view, larger drop zone: all in `src/styles/atmosphere.css` (app layout only, `rs-*`; `bundle.css` untouched).
- Fonts bundled via `@fontsource/*` (imported in `src/main.ts`); Google Fonts links removed from `index.html`.
- New tokens in `design-system/tokens.json` (regenerated `tokens.css`): `hero-ground`, `on-hero`, `on-hero-muted`, `shadow-panel`, `shadow-lift`.
- `design-system/README.md` and `docs/user-guide.md` updated; `docs/images/*.png` re-captured.
- `e2e/layout.spec.ts` expects the photo strip about 320px tall (was 260px).

## Last change

The owner said the hero wording "makes zero sense". The copy in `SetupHero.vue` was rewritten in plainer words ("Inspect a shipping container from photos. Every result shows how certain it is.") and the photo shade darkened so the markings painted on the container no longer show through the headline. Checked in a browser at 1440px and 390px, light theme, and the three setup images in `docs/images/` re-captured. Still to do:

1. Confirm the new wording with the owner.
2. Look at the first screen in the dark theme.
3. Run the e2e suite once more (`npm run check` passed before the wording change; only text and gradient values changed since).

## Things to know

- `OPENAI_API_KEY` and `OPENROUTER_API_KEY` are set in the cloud environment, so a plain `npx vitest run` runs the `*.live.spec.ts` tests against the real APIs (costs money, rewrites `src/fixtures/live/*.json`). Unset both first: `unset OPENAI_API_KEY OPENROUTER_API_KEY`.
- Failing on `main` as well, not caused by this branch: 22 unit tests (9 files) and 2 Playwright tests (`demo.spec.ts:143`, `newInspection.spec.ts:222`, both the manifest offer).
- `npm run screenshots` (the harness) has not been run to completion against the new screens.
- Full-page Playwright screenshots can drop elements still running the `qs-rise` blur animation; freeze animations before capturing.

## Ideas offered to the owner (none started)

Photo overlay of readings; batch mode; printable report; session history; model comparison; camera capture with coaching; manifest CSV import; before/after comparison; owner/BIC lookup; presenter mode.

## CI: Azure staging-environment quota

The Azure Static Web Apps job failed on PR #126 with "This Static Web App already has the maximum number of staging environments". It is a quota on the Azure side, not a build error: the plan allows 3 preview environments, and open PRs #114 and #124 (plus, probably, one left over from a closed PR) hold them.

- Done in this branch: the PR preview deploy step is `continue-on-error` for pull requests only, so a full quota no longer fails a PR. Pushes to `main` still fail loudly. Not yet seen running on GitHub.
- Still needed, by the owner (no Azure access from the agent session): Azure portal > the Static Web App > Environments > delete a stale preview environment; or close/merge #114 or #124. Until then PR #126 has no preview site.

## What it would take to reach 8/10 visually (owner's question, nothing started)

The owner rates the app 4/10 before this branch and about 5/10 after. The branch changed the wrapping (first screen, picker, fonts, depth); the result screen itself, where the time is spent, is still the same layout. In rough order of payoff:

1. **Give the result screen a hierarchy.** It is one long column of equal-weight boxes (about 3,500px tall). Put the photo, the container ID and the key facts together above the fold as one composed "verdict" area, and move Readings, Container details and Damage behind tabs or collapsible sections.
2. **Put the findings on the photo.** Outline the ID, seal, placards and damage on the photograph itself, linked both ways to the lists. This is the single change that would make it look impressive (PR #124 has experimental damage highlights).
3. **Cut the repetition.** Rows of "Not clear from this photo / Can't tell" and nine near-identical finding cards read as noise. Collapse unread rows into one line ("5 markings not readable in this photo") and show findings as a compact grouped table with one detail panel.
4. **Fewer boxes.** Almost every value sits in a bordered chip inside a bordered row inside a bordered card. Drop most borders; use spacing and type weight instead; keep chips for certainty only.
5. **Redraw the damage schematic.** The 3D drawing is small, pale and the weakest illustration on the page. It needs a proper, larger, higher-contrast drawing with real door and corrugation detail.
6. **A braver palette and type scale.** Everything is grey-blue on grey-blue with many 12-13px uppercase labels. Stronger neutral contrast, one confident accent, larger body text, fewer sizes.
7. **Shrink the demo banner.** The two-ruled band takes about 90px of prime space on every demo screen; a slim strip or a pill in the top bar says the same.
8. **A designed analysing state.** Today it is the photo plus three grey skeleton tiles on an empty page. Show the readings appearing on the photo as each stage settles.
9. **Custom controls and real assets.** The native select, the monogram provider badges and the stock sample photo as hero all look unfinished; a commissioned or better-shot hero photograph and consistent custom controls would help.
10. **Design it before coding it.** Getting past 8 needs mock-ups of the result screen agreed first (and the design-system rules that force the boxes and labels revisited), not more CSS on the current structure.

## Mock-up of roadmap items 1 to 4

`docs/mockups/result-screen.html` (open it in a browser from the repo; image: `docs/mockups/result-screen.png`). A static page, not app code, built on `tokens.css` and `bundle.css`. It shows the result screen with: the photo and the answer composed together above the fold (1), readings and damage outlined on the photo (2), unread markings as one sentence and findings as one grouped table with a single detail panel (3), and lists on hairlines with chips for certainty only (4). Values come from the recorded "Rear doors with markings" sample; the outlines and pins on the photo are placed by hand. Not yet reviewed by the owner; nothing is implemented in the app.

## Other open PRs (checked 12 Nov 2026, both left open)

- **#114 Loupe shows over the whole ledger close-up**: a 3-line CSS fix in `bundle.css` plus an e2e test. Not in `main`, merges cleanly. Useful; ready to merge.
- **#124 Add experimental Jev damage photo highlights** (`try-box`, 31 commits, 825 files, mostly research evidence and fixtures; about 1,300 lines in `src`). Not in `main`, merges cleanly. Useful: it is the groundwork for roadmap item 2. Its own description says it is for testing and leaves #122 and #123 open.

Each open PR holds one Azure preview environment (see the quota section above).
