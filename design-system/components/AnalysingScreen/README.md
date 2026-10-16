# AnalysingScreen

The analysing screen is the main inspection screen while the photos are being analysed: the same layout as `ResultsScreen`, before the results land.

## What shows
- The top bar, unchanged: the `SettingsChip` (or, in demo mode, the recording's model chip) and the quiet cost line, which keeps the previous figure until the response arrives and never ticks up.
- The photo stage with the uploaded photo straight away, a soft brand sweep over it, and a `StageProgress` card titled *Analysing with [model]*: *Reading markings*, *Looking for damage*, *Checking the details*, each with its measured time once done. Under the photo, the primary button reads *Analysing…* (disabled, `aria-busy`).
- `qs-skeleton` shimmer in the readings column. The summary, thumbnails and damage view are not drawn until there is something real to show.

## Rules
- No percentages, no fake progress bars, no estimated time left.
- Never name passes, retries or candidates. A re-check happens inside *Checking the details*.
- When the response is parsed, swap `.qs-arriving` for `.qs-arrived` on the same container; `ResultsScreen` describes the landing.
