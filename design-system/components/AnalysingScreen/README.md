# AnalysingScreen

The analysing screen is the main inspection screen while the photos are being analysed: the same layout as `ResultsScreen`, before the results land.

## What shows
- The top bar, unchanged: the `SettingsChip` (or, in demo mode, the recording's model chip) and the quiet cost line, which keeps the previous figure until the response arrives and never ticks up.
- The photo stage with the uploaded photo straight away, a soft brand sweep over it, and a `StageProgress` card titled *Analysing with [model]*: *Reading the ID*, *Reading container details*, *Checking for damage*. Each stage advances when its own requests settle, with its measured time once done, and shows its own failure; a stage this run makes no request for reads *Not part of this run*. Under the photo, the primary button reads *Analysing…* (disabled, `aria-busy`), with **Cancel** (`qs-btn--secondary`) beside it.
- `qs-skeleton` shimmer in the readings column. The summary, thumbnails and damage view are not drawn until there is something real to show.

## Rules
- No percentages, no fake progress bars, no estimated time left.
- Never name passes, retries or candidates. A re-check happens inside the stage it serves (an ID re-check inside *Reading the ID*).
- A part whose stage has settled lands on its own (its card swaps to `.qs-arrived` inside the still-arriving screen), so nobody waits for the slowest request.
- **Cancel** stops the requests still in flight and never sends the rest. What already arrived lands, under a `qs-notice--partial` (see `Notice`); if nothing had arrived, a partial notice says so and the primary button returns. Cancel never asks for confirmation.
- When the response is parsed, swap `.qs-arriving` for `.qs-arrived` on the same container; `ResultsScreen` describes the landing.
