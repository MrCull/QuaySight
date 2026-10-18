# AnalysingScreen

The analysing screen is the main inspection screen while the photos are being analysed: the same layout as `ResultsScreen`, before the results land.

## What shows
- The top bar, unchanged: the `SettingsChip` (or, in demo mode, the recording's model chip) and the quiet cost line, which keeps the previous figure until the response arrives and never ticks up.
- The photo stage with the uploaded photo straight away and a soft brand sweep over it (hidden under reduced motion). No text overlays the photo. The key-facts tiles (`KeyFactTile`) sit outside the photo, under it, each reading **Reading…** over a `qs-skeleton` bar, with a thin progress indicator above them (how many parts have settled; no percentage in words). Each tile fills in when its own part lands; a part that failed or was cancelled reads *No result*. There is no start row: the inspection starts when photos or a sample are chosen, and the header's *New inspection* reads **Cancel** while it runs.
- `qs-skeleton` shimmer in the readings column. The thumbnails and the damage view are not drawn until there is something real to show.

## Rules
- No percentages, no fake progress bars, no estimated time left.
- Never name passes, retries or candidates. A re-check happens inside the part it serves (an ID re-check inside the Container ID tile's *Reading…*).
- A part whose stage has settled lands on its own (its tile and card swap to `.qs-arrived` inside the still-arriving screen), so nobody waits for the slowest request.
- **Cancel** stops the requests still in flight and never sends the rest. Cancel clears straight back to the empty photo picker and never asks for confirmation.
- When the response is parsed, swap `.qs-arriving` for `.qs-arrived` on the same container; `ResultsScreen` describes the landing.
