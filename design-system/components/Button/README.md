# Button

Buttons start, export or reset an inspection. They never ask anyone to confirm, correct or approve a reading.

## Use
- `qs-btn qs-btn--primary qs-btn--lg` for the one main action, **Inspect container**. Keep exactly one primary button per screen.
- `qs-btn--secondary` for alternatives at the same level: *Try a sample container*, *Export JSON*, *Download raw response*.
- `qs-btn--ghost` for low-weight resets: *Clear key*. The top-bar *New inspection* action has its own component, `NewInspection`.
- `qs-btn--sm` inside dense panels (cost ledger, marker popover).

## Consumer provides
A `<button>` element with a verb-first label in sentence case. Add a leading `qs-glyph` icon only when it adds meaning (export, upload). Set `aria-busy="true"` and `disabled` while a request is in flight, so a repeat click can't start a second chargeable call.

## Don't
- No "Confirm", "Approve", "Correct" or "Accept result" buttons. The spec forbids manual resolution.
- Don't colour buttons with certainty, severity or hazard tokens. Only `brand` is an action colour.
