# DemoBanner

The demo banner says, the whole time a visitor is in demo mode, that what they see is sample data and not a real inspection. Demo mode is entered from the `SetupCard` with **Enter as demo user**: no API key, no network, the three bundled sample containers only.

## Use
- `section.qs-demobanner` (`role="region"`, `aria-label="Demo mode"`) directly under the top bar, full width, before the inspection screen. It is sticky (`top: 0`), so it stays on screen while the page scrolls.
- Inside, in order:
  - the `recorded` glyph (`aria-hidden`);
  - `.qs-demobanner__text` holding `p.qs-demobanner__title`, exactly **<b>DEMO</b> — sample results, not a real inspection**, then `p.qs-demobanner__body`: *Inspecting your own photos needs an API provider.*;
  - `button.qs-btn.qs-btn--secondary.qs-demobanner__action` **Connect a provider**.
- At phone width the action drops under the words and fills the row; nothing scrolls sideways.

## Behaviour
- Shown on every demo screen state: the sample picker, a sample on screen, analysing, the result, the manifest offer.
- **Connect a provider** leaves demo mode and opens the `SetupCard`, on a blank screen (the same reset as `NewInspection`). The provider and model chosen before are kept; no key is ever pre-filled.
- Never dismissible. Demo mode is never remembered: a refresh opens the `SetupCard`.

## Demo mode around it
- The `PhotoDrop` gives way to the sample picker (`.qs-samples` with three `.qs-sample` tiles: *Rear doors with markings*, *Damaged grey side*, *Clean grey rear doors*). Its explanation adds that inspecting your own photos needs an API provider; there is no drop zone and no file picker.
- Each result keeps the `Notice` *Recorded demonstration: [provider/model]*, naming who answered when that sample was recorded. A sample's result is only ever shown against its own photo.
- The `CostIndicator` reads *Saved result · no live API charge*. Demo mode never adds to the live ledger and makes no request to any provider.
- `NewInspection` returns to the sample picker. The `SettingsChip` is not shown; the banner's action is the way to a provider.

## Rules
- Neutral ink only: `surface-raised`, `ink`, `ink-muted` and `ink` rules top and bottom. Never certainty, severity or hazard colours, and never `brand` as a status. Nothing is green.
- The words are fixed. Don't call it *Preview*, *Trial* or *Sandbox*, and never say *verified*, *safe* or *simulated live*.
- Don't put the banner inside the results; it frames the whole screen.

## Accessibility
- The region is named *Demo mode*. The action is a native `<button>` with the shared 2px `focus-ring`.
- The title is plain text, read in full by screen readers.
