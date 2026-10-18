# Button

Buttons start, export or reset an inspection. They never ask anyone to confirm, correct or approve a reading.

## Use
- `qs-btn qs-btn--primary qs-btn--lg` for the one main action, **Inspect container**. Keep exactly one primary button per screen.
- `qs-btn--secondary` for alternatives at the same level: *Try a sample container*, *Export JSON*, *Download raw response*.
- `qs-btn--ghost` for low-weight resets: *Clear key*. The top-bar *New inspection* action has its own component, `NewInspection`, which uses `qs-btn--primary qs-btn--sm`.
- `qs-btn--sm` inside dense panels (cost ledger, marker popover).
- `qs-link` for an action inside a sentence, drawn as a `brand` underlined link but kept a native `<button>`: "Enter this provider's key in *settings* to start." opens the `SettingsDrawer`.
- In the app the inspection starts itself when photos (live) or a sample (demo) are chosen, so there is no *Start inspection* or *Run live inspection* button. The top bar's `NewInspection` (*Cancel* during a run) is the main button; a failed run's notice carries *Try again*.
- While a run is in flight, **Cancel** (`qs-btn--secondary`) sits beside *Analysing…*. It stops the requests still running, keeps what already arrived (marked partial) and never asks for confirmation. It is gone once the run ends.

## Consumer provides
A `<button>` element with a verb-first label in sentence case. Add a leading `qs-glyph` icon only when it adds meaning (export, upload). Set `aria-busy="true"` and `disabled` while a request is in flight, so a repeat click can't start a second chargeable call.

## Don't
- No "Confirm", "Approve", "Correct" or "Accept result" buttons. The spec forbids manual resolution.
- Don't colour buttons with certainty, severity or hazard tokens. Only `brand` is an action colour.
