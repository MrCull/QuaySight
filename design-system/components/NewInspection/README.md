# NewInspection

The New inspection action gives the presenter a blank screen for the next container without reloading the page. It sits in the top bar on every inspection screen.

## Use
- `<button type="button" class="qs-btn qs-btn--secondary qs-btn--sm qs-newinsp">New inspection</button>`, the centre item of the three-zone top bar: brand on the left, this button centred, and the muted `SettingsChip` (or `RunChip`) and `CostIndicator` on the right. It is the most-used action, so nothing else sits between it and the middle of the bar.
- Secondary weight, not primary: it is the main button of the top bar, but not a `qs-btn--primary`: the inspection starts itself when photos or a sample are chosen, so there is no other action to rank it against.
- The label is **New inspection**, and **Cancel** while an inspection runs. No icon. Cancel behaves exactly like New inspection: it stops what is in flight and clears to the empty picker, with no confirmation.

## Behaviour
- **One click, no confirmation.** Resetting between containers on stage is a single press.
- **Clears** the photos, the results, the run status and any error, the `ManifestRetry` panel and its entries, and the selected damage marker.
- **Keeps** the provider, the model, every API key and the session cost total. The container total starts again at *None yet*.
- **Always enabled**, including while analysing. Pressed during a run, it cancels the run cleanly: nothing from that run lands on the blank screen. A call already sent stays on the cost ledger, because it was charged.
- The same reset runs when the provider or model changes and when leaving demo mode, so those flows never leave a result from one model beside the next run.

## Accessibility
- A native `<button>`, reachable with Tab. Focus shows the shared 2px `focus-ring` outline, offset 2px, from `qs-btn`.
- After the reset, focus moves to the next thing to use: the photo drop zone (`PhotoDrop`), or in demo mode the first sample in the sample picker. Only a press of this button moves focus; a provider or model change in the `SettingsDrawer` runs the same reset but leaves focus in the drawer.

## Don't
- Don't ask "Are you sure?" or show a modal. The action discards only what is on screen.
- Don't call it *Reset*, *Clear all* or *Start over*, and don't colour it with certainty, severity or hazard tokens.
- Don't clear keys, the provider or model, or the session total.
