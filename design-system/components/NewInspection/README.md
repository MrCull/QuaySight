# NewInspection

The New inspection action gives the presenter a blank screen for the next container without reloading the page. It sits in the top bar on every inspection screen.

## Use
- `<button type="button" class="qs-btn qs-btn--secondary qs-btn--sm qs-newinsp">New inspection</button>`, the last item in the top bar, after the `CostIndicator`.
- Secondary weight, not primary: the screen's one primary action stays *Inspect* (or *Run live inspection*).
- The label is always **New inspection**. No icon.

## Behaviour
- **One click, no confirmation.** Resetting between containers on stage is a single press.
- **Clears** the photos, the results, the run status and any error, the `ManifestRetry` panel and its entries, and the selected damage marker.
- **Keeps** the provider, the model, every API key and the session cost total. The container total starts again at *None yet*.
- **Always enabled**, including while analysing. Pressed during a run, it cancels the run cleanly: nothing from that run lands on the blank screen. A call already sent stays on the cost ledger, because it was charged.
- The same reset runs when the provider or model changes and when leaving demo mode, so those flows never leave a result from one model beside the next run.

## Accessibility
- A native `<button>`, reachable with Tab. Focus shows the shared 2px `focus-ring` outline, offset 2px, from `qs-btn`.
- After the reset, the photo drop zone is the next thing to use; don't move focus away from the button.

## Don't
- Don't ask "Are you sure?" or show a modal. The action discards only what is on screen.
- Don't call it *Reset*, *Clear all* or *Start over*, and don't colour it with certainty, severity or hazard tokens.
- Don't clear keys, the provider or model, or the session total.
