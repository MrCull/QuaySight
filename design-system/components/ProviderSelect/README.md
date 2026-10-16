# ProviderSelect

Provider select is the setup form: pick an AI provider from a list, pick a model version, enter that provider's key. The list is driven by the provider catalogue, so a new provider adapter appears without any UI change.

The form is never inline on the inspection screen. It renders inside the `SetupCard` on first visit and inside the `SettingsDrawer` afterwards; the `SettingsChip` summarises it in the top bar.

## Parts
- **Provider**: a `.qs-combo` with a `button.qs-combo__button` (`aria-haspopup="listbox"`, `aria-expanded`). It shows the chosen provider's monogram tile (`.qs-mono`), model family, vendor and API, and a *Recommended* cap when it applies.
- **List**: `.qs-listbox` (`role="listbox"`) on `surface-raised` with `shadow-raised`. It holds a `.qs-listbox__filter` input (worth showing once the catalogue passes about five entries), `.qs-listbox__group` headings (*Ready for photos*; *Not available for photos* for catalogue entries without image input), and one `.qs-option` (`role="option"`) per provider. Each option shows its capability caps (`.qs-cap`: Probabilities, Bounding boxes, Multi-image; `.qs-cap--exp` dashed for experimental; `.qs-cap--rec` for the recommended default). Unsupported entries get `aria-disabled="true"` and say why in their `small` line.
- **Model version**: a `.qs-input` select. Warn under a moving `latest` or `preview` alias with `.qs-hint--warn`.
- **Key**: a password `.qs-input` labelled with the provider name, with show/hide and *Clear*. The hint says whose endpoint receives the photo and the key. The label, placeholder and hint come from the catalogue, so the form stays provider-agnostic.

## Consumer provides
The catalogue: id, display name, vendor, API name, a two-letter monogram, capability flags, the recommended model and the key field's label, placeholder and hint. Use monograms, not vendor logos.

## Rules
- Keyboard: arrows move `is-active`, Enter selects, Esc closes, typing filters.
- Switching provider or model runs New inspection: a blank screen, never a silent re-run or merged results. Changing only the key resets nothing.
- Each provider keeps its own key. Switching provider never moves a key.
- Never pre-fill a key in screenshots or samples.
