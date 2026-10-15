# StageProgress

Stage progress shows what the inspection is doing while the audience waits, in plain words and with measured times, never a made-up percentage.

## States
`qs-stage--done` (filled dot, check glyph, elapsed time), `qs-stage--active` (pulsing brand dot, static under reduced motion) and pending (empty ring).

## Consumer provides
An `<ol class="qs-stages" aria-live="polite">` with three or four `li.qs-stage` items in plain words: *Reading markings*, *Looking for damage*, *Checking the details*, *Putting the results together*. An optional `.qs-stage__detail` line says what is happening in everyday terms ("Taking a closer look at characters that were hard to read").

## Rules
- Any automatic re-check folds into *Checking the details*. Never mention passes, refinement, candidates, rounds or retries. The audience only cares about the outcome.
- Times are measured elapsed seconds in `data-sm`. Never a progress bar or percentage the API can't provide.
- The flow never pauses for input. A failed request turns into an error `Notice`, and the partial result stays usable.
