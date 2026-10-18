# StageProgress

> The main screen no longer shows this list: the `KeyFactTile` row, with its **Reading…** placeholders and thin progress indicator, shows progress there. This component stays for other progress lists (the manifest check inside `ManifestRetry` uses it).

Stage progress shows what the inspection is doing while the audience waits, in plain words and with measured times, never a made-up percentage.

## States
- `qs-stage--done`: filled dot, check glyph, elapsed time.
- `qs-stage--active`: pulsing brand dot, static under reduced motion. Several stages can be active at once: their requests run together.
- pending: empty ring.
- `qs-stage--failed`: `error-fg` ring with the octagon glyph on `error-bg`, and a `.qs-stage__detail` saying what is kept ("Could not be completed. Everything else is kept."). Only for a request that failed, never for a low probability.
- `qs-stage--cancelled`: dashed muted ring with the cross glyph and the detail *Cancelled*: the presenter stopped it.
- `qs-stage--skipped`: dashed ring, muted title, detail *Not part of this run*, for a stage the run makes no request for.

## Consumer provides
An `<ol class="qs-stages" aria-live="polite">` with the run's `li.qs-stage` items in plain words: *Reading the ID*, *Reading container details*, *Checking for damage*. An optional `.qs-stage__detail` line says what is happening in everyday terms ("Taking a closer look at characters that were hard to read").

## Rules
- Each stage advances when its own requests settle; a stage is never advanced on a timer. Any automatic re-check folds into the stage it serves. Never mention passes, refinement, candidates, rounds or retries. The audience only cares about the outcome.
- Times are measured elapsed seconds in `data-sm`. Never a progress bar or percentage the API can't provide.
- The flow never pauses for input. A failed request turns into an error `Notice`, and the partial result stays usable.
