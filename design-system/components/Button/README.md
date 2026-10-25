# Button

Buttons start, export or reset an inspection. They never ask anyone to confirm, correct or approve a reading.

## Use
- `qs-btn--primary` for the one main action of a screen. Keep exactly one primary button per screen. On the inspection screen that is **New inspection**, in the top bar through the `NewInspection` component (`qs-btn--primary qs-btn--sm`); on the setup card it is **Continue** (`qs-btn--lg`).
- `qs-btn--secondary` for recovery and optional actions, and alternatives at the same level: a failed run's *Try again*, the `ManifestRetry` panel's *Check again with this manifest*, *Try again* and *Keep first result*, *Export JSON*, *Download raw response*.
- `qs-btn--ghost` for low-weight resets: *Clear key*.
- `qs-btn--sm` inside dense panels (cost ledger, marker popover).
- `qs-link` for an action inside a sentence, drawn as a `brand` underlined link but kept a native `<button>`: "Enter this provider's key in *settings* to start." opens the `SettingsDrawer`.
- In the app the inspection starts itself when photos (live) or a sample (demo) are chosen, so there is no *Start inspection* or *Run live inspection* button. The top bar's `NewInspection` reads *Cancel* during a run and shows only once photos or a sample are chosen; a failed run's notice carries *Try again*.

## Consumer provides
A `<button>` element with a verb-first label in sentence case. Add a leading `qs-glyph` icon only when it adds meaning (export, upload). Set `aria-busy="true"` and `disabled` while a request is in flight, so a repeat click can't start a second chargeable call.

Disabled buttons dim to 55% opacity. The exception is the `SetupCard`'s **Continue**: before a key is entered it is `aria-disabled="true"` but keeps its full brand fill and stays focusable, so the first screen never looks switched off. Pressing it moves focus to the key field and shows a one-line hint instead of continuing.

`qs-btn--icon` (with `qs-btn--sm`) makes a square, glyph-only button. Give it an `aria-label`; the `ThemeToggle` is the one use.

## Don't
- No "Confirm", "Approve", "Correct" or "Accept result" buttons. The spec forbids manual resolution.
- Don't colour buttons with certainty, severity or hazard tokens. Only `brand` is an action colour.
