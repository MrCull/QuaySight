# Handover: result-screen and landing mock-ups (PR #127)

Branch `claude/nice-dirac-7p0m84`, PR https://github.com/MrCull/QuaySight/pull/127 (open, base `main`). Last updated 13 Nov 2026.

This branch adds only `docs/mockups/` and this file. No app code, tokens or tests are changed. Nothing is implemented in the app.

An earlier attempt lives on `claude/loving-hopper-85brdw` (PR #126) with its own `HANDOVER.md` at the repo root. If both branches merge, the two files will conflict: keep both texts.

## Goal

The owner rates the app's look 4/10 and wants 8 or more. The job so far is mock-ups to agree a direction before any app work.

## State

Four rounds of static mock-ups, each rejected or narrowed by the owner. Round 4 is current and awaits the owner's verdict. The owner has not picked a direction.

| Round | Files | Outcome |
| --- | --- | --- |
| 1 | `direction-a/b/c-*` | Rejected. Too far from the app; photo overlays not wanted. |
| 2 | `v2-1` to `v2-5` | Rejected. Door drawing imitated the photo. |
| 3 | `v3-1` to `v3-5` | Rejected: "the only thing different is the colour". Landing copy called "AI slop". |
| 4 | `v4-a-ledger`, `v4-b-around`, `v4-c-proof` | Sent with self-ratings 6.5 to 7. No reply yet. |

`docs/mockups/README.md` describes every round's files.

## What the owner wants (cumulative, in their words where possible)

- Desktop only. No phone mock-ups.
- Photos in a row across the top.
- The door drawn as a clear schematic with the lettering on it, not an imitation of the photo.
- A crop of the real photo beside the container ID, the seal and the other main writing.
- Do not draw outlines or pins on the photographs themselves.
- Damage below, with a 3D-style drawing showing an end and a side.
- Tabs (or similar) below. Characteristics first, and it must look much better: icons, tick and cross. Then Damage, then Markings.
- Landing screen: slick and simple, very few words.
- Variations must differ in layout, not only colour.
- Rate each variation out of 10, and rate honestly. The owner said earlier self-ratings (6.5 to 8) were far too high.
- The owner asked once for the current app's screenshots and ratings alongside; include them again when comparing.

## How the mock-ups are built

- Static HTML opened from the repo with `file://`. Fonts come from Google Fonts, so captures need network.
- `v2.js`: the two drawings, coloured only through CSS variables. `drawDoor` (modes `both`, `right`, `tags`, `none`; `data-crops="1"` adds photo crops to call-outs) and `drawIso` (views `door`, `blank`). `v2.css` styles them.
- `v4.js`: icon set, the inspection content, the tab switch. Open a result page with `#damage` or `#marks` to land on that tab.
- `crops/`: pieces cut by hand from `samples/jdlu-200690-1-rear-doors.jpg` and the seal close-up.
- Captures: Playwright at 1440x900, `deviceScaleFactor: 2`. The capture scripts were in the session scratchpad and are not in the repo; they are a dozen lines each and easy to rewrite. `*-board.png` stacks a variation's captures into one image.
- `current-board.png` is the app on `main`, taken from `docs/images/` (captured 12 Nov 2026), not a fresh run.

## Known gaps

- All content is hand-placed: the six damage findings, their positions, the crops. The ID, size and type, weights and seal number are what is painted in the photos. The seal photo is a different container's sample (COYU), reused as in the earlier branch.
- Fonts and colours in the mock-ups are proposals. None are in `design-system/tokens.json`, and several break the current design-system rules on purpose (the owner was told this).
- Icons in round 4 are quick hand-drawn paths, not a real icon set.
- In the app, crops depend on the model locating each marking; real crops will be rougher than these.
- The analysing screen has not been mocked up in any round.
- The PR description on #127 still describes round 1 only. The GitHub connector failed for most of the session, so it was not updated and the PR is not being watched.

## Next steps

1. Get the owner's verdict on round 4 (A, B or C, or a mix).
2. If none is chosen, ask what specifically falls short before making more; four rounds of guessing have not converged.
3. Once a direction is agreed: update the PR description, then plan the app work (design tokens first, per `design-system/README.md`; note the shared hotspots in `AGENTS.md`).
