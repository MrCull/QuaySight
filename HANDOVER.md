# Handover: result-screen and landing mock-ups (PR #127)

Branch `claude/nice-dirac-7p0m84`, PR https://github.com/MrCull/QuaySight/pull/127 (open, base `main`). Last updated 13 Nov 2026.

This branch adds only `docs/mockups/` and this file. No app code, tokens or tests are changed. Nothing is implemented in the app.

An earlier attempt lives on `claude/loving-hopper-85brdw` (PR #126) with its own `HANDOVER.md` at the repo root. If both branches merge, the two files will conflict: keep both texts.

## Goal

The owner rates the app's look 4/10 and wants 8 or more. The job so far is mock-ups to agree a direction before any app work.

## State

Five rounds of static mock-ups, each rejected or narrowed by the owner. Round 5 is current and awaits the owner's verdict. The owner has not picked a direction.

| Round | Files | Outcome |
| --- | --- | --- |
| 1 | `direction-a/b/c-*` | Rejected. Too far from the app; photo overlays not wanted. |
| 2 | `v2-1` to `v2-5` | Rejected. Door drawing imitated the photo. |
| 3 | `v3-1` to `v3-5` | Rejected: "the only thing different is the colour". Landing copy called "AI slop". |
| 4 | `v4-a-ledger`, `v4-b-around`, `v4-c-proof` | Result pages rejected as "way too busy". The C landing page was liked ("kinda like this one"). |
| 5 | `v5-a-headline`, `v5-b-bento`, `v5-c-sheet` | Sent with self-ratings 6.5, 6 and 5.5 against 4 for the current app. No reply yet. |

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
- Keep the result calm. One photo crop each for the container ID, the ISO code and the seal; one combined crop for the other painted text (max gross, tare and so on). The round 4 pages, with a door drawing, numbered tags and a crop per value, were "way too busy".
- Vary the landing from round 4's C (photos, one line, one field).
- Rate each variation out of 10, and rate honestly. The owner said earlier self-ratings (6.5 to 8) were far too high.
- The owner asked once for the current app's screenshots and ratings alongside; include them again when comparing.

## How the mock-ups are built

- Static HTML opened from the repo with `file://`. Fonts come from Google Fonts, so captures need network.
- `v2.js`: the two drawings, coloured only through CSS variables. `drawDoor` (modes `both`, `right`, `tags`, `none`; `data-crops="1"` adds photo crops to call-outs) and `drawIso` (views `door`, `blank`). `v2.css` styles them.
- `v4.js`: icon set, the inspection content, the tab switch. Open a result page with `#damage` or `#marks` to land on that tab.
- `v5.js` and `v5.css`: round 5. One stylesheet with a block per variation (`body.va`, `.vb`, `.vc`); the pages hold the layout markup. Round 5 does not use the door drawing.
- `crops/`: pieces cut by hand from `samples/jdlu-200690-1-rear-doors.jpg` and the seal close-up.
- Captures: Playwright at 1440x900, `deviceScaleFactor: 2`. The capture scripts were in the session scratchpad and are not in the repo; they are a dozen lines each and easy to rewrite. `*-board.png` stacks a variation's captures into one image.
- `current-board.png` is the app on `main`, taken from `docs/images/` (captured 12 Nov 2026), not a fresh run.

## Known gaps

- All content is hand-placed: the six damage findings, their positions, the crops. The ID, size and type, weights and seal number are what is painted in the photos. The seal photo is a different container's sample (COYU), reused as in the earlier branch.
- Fonts and colours in the mock-ups are proposals. None are in `design-system/tokens.json`, and several break the current design-system rules on purpose (the owner was told this).
- Icons in round 4 are quick hand-drawn paths, not a real icon set.
- In the app, crops depend on the model locating each marking; real crops will be rougher than these.
- The analysing screen has not been mocked up in any round.
- Round 5 leaves out things the app shows today: the placards summary on the main view (it is only in the Markings tab), the CSC plate, the metric/imperial switch, the model name and the session cost. Decide where they go before building.
- The ID and ISO crops come from a 1080px photo and are soft when enlarged; real crops will be no sharper.
- The PR description on #127 was rewritten for round 5.

## Next steps

1. Get the owner's verdict on round 5 (A, B or C, or a mix).
2. If none is chosen, ask what specifically falls short before making more; five rounds of guessing have not converged.
3. Once a direction is agreed: update the PR description, then plan the app work (design tokens first, per `design-system/README.md`; note the shared hotspots in `AGENTS.md`).
