# ProviderSelect

Provider select is the setup block: pick an AI provider from a list, pick a model version, enter that provider's key. The list is driven by the provider catalogue, so a new provider adapter appears without any UI change.

## Parts
- **Provider**: a `.qs-combo` with a `button.qs-combo__button` (`aria-haspopup="listbox"`, `aria-expanded`). It shows the chosen provider's monogram tile (`.qs-mono`), model family, vendor and API, and a *Recommended* cap when it applies.
- **List**: `.qs-listbox` (`role="listbox"`) on `surface-raised` with `shadow-raised`. It holds a `.qs-listbox__filter` input (worth showing once the catalogue passes about five entries), `.qs-listbox__group` headings (*Ready for photos*; *Not available for photos* for catalogue entries without image input), and one `.qs-option` (`role="option"`) per provider. Each option shows its capability caps (`.qs-cap`: Probabilities, Bounding boxes, Multi-image; `.qs-cap--exp` dashed for experimental; `.qs-cap--rec` for the recommended default). Unsupported entries get `aria-disabled="true"` and say why in their `small` line.
- **Model version**: a `.qs-input` select. Warn under a moving `latest` or `preview` alias with `.qs-hint--warn`.
- **Key**: a password `.qs-input` labelled with the provider name, with show/hide and *Clear*. The hint says where the key goes.

## Consumer provides
The catalogue: id, display name, vendor, API name, a two-letter monogram, capability flags and the recommended model. Use monograms, not vendor logos.

## Rules
- Keyboard: arrows move `is-active`, Enter selects, Esc closes, typing filters.
- Switching provider starts a new run. It never silently re-runs or merges results.
- Never pre-fill a key in screenshots or samples.
