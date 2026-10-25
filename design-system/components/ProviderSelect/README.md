# ProviderSelect

Provider select is the setup form: pick an AI provider from a list, pick a model version, enter that provider's key. The list is driven by the provider catalogue, so a new provider adapter appears without any UI change.

The form is never inline on the inspection screen. It renders inside the `SetupCard` on first visit and inside the `SettingsDrawer` afterwards; the `SettingsChip` summarises it in the top bar.

## Parts
- **Provider**: a `.qs-combo` with a `button.qs-combo__button` (`aria-haspopup="listbox"`, `aria-expanded`). It shows the chosen provider's monogram tile (`.qs-mono`), its name, and a `small` line with the vendor and API. When the vendor and the name are the same (*OpenRouter*, *OpenAI*), the line gives the API alone. The provider is named by whose key it takes; the model is named in the model select. A *Recommended* cap shows only while the recommended provider is chosen; otherwise an empty `span` keeps the grid.
- **List**: `.qs-listbox` (`role="listbox"`, `tabindex="0"`, `aria-activedescendant`) on `surface-raised` with `shadow-raised`. It takes focus while open and shows the shared 2px `focus-ring`. It holds `.qs-listbox__group` headings (*Ready for photos*; *Not available for photos* for catalogue entries without image input) and one `.qs-option` (`role="option"`, its own `id`, `data-testid="provider-option-{id}"`) per provider. Each option shows its capability caps (`.qs-cap`: *Probabilities*, *Boxes* when any of its models answers the box question, *Multi-image*; `.qs-cap--exp` dashed for experimental; `.qs-cap--rec` for the recommended provider). Unsupported entries get `aria-disabled="true"` and say why in their `small` line. Add a `.qs-listbox__filter` input once the catalogue passes about five entries; with two it is left out.
- **Model version**: a `.qs-input` select. Each option names the model, its maker and its route, then any note from the catalogue: *Jev 1.14 (TypeSafe) via OpenRouter · pinned*, *Jev latest (TypeSafe) via OpenRouter · moving target, recommended*, *GPT-6 Luna (OpenAI) direct · pinned*. The wording is the catalogue's (`labelsFor(…).option`), never rebuilt in a component. Under a moving alias (*Jev latest*), a `.qs-hint` says who moves it and that the answering version is recorded. The catalogue's `movingTarget` flag alone decides this: `labelsFor` adds *moving target* to the option from that flag, so the option, the hint and the live result's notice always agree.
- **Key**: a password `.qs-input` labelled with the provider name, with show/hide and *Clear*. The hint says whose endpoint receives the photo and the key. The label, placeholder and hint come from the catalogue, so the form stays provider-agnostic.
- **Key-format warning**: when the key doesn't start the way the provider's keys do (`sk-or-` for OpenRouter, `sk-` for OpenAI, from the catalogue's key field), a `.qs-keywarn` (`role="status"`, referenced by the key input's `aria-describedby`) sits between the key field and its hint. It holds a `.qs-keywarn__title`, *This doesn't look like an OpenRouter key.*, then one line: *OpenRouter keys start with* `.qs-keywarn__prefix` *sk-or-*. *If yours is right, you can still continue.* It is advice only: **Continue** (and Enter, and Done in the drawer) still work, so an unusual but valid key is never blocked. Nothing shows for a blank field, a key with the right prefix, or while the prefix is still being typed (`sk-o`).

## Consumer provides
The catalogue: id, display name, vendor, API name, a two-letter monogram, whether it is the recommended provider (exactly one is, and it is the first-visit choice), its models with their capability flags and recommended model, and the key field's label, placeholder and hint. Use monograms, not vendor logos.

## Keyboard
- On the provider button, Arrow Down or Arrow Up opens the list on the chosen provider.
- In the list, the arrows (and Home, End) move `is-active`; Enter or Space chooses; Escape closes the list without a change and only the list (a drawer around it stays open). Focus returns to the provider button.
- With a filter shown, typing filters.

## Rules
- Switching provider or model runs New inspection: a blank screen, never a silent re-run or merged results. Changing only the key resets nothing.
- Each provider keeps its own key. Switching provider never moves a key.
- Never pre-fill a key in screenshots or samples.
- The key-format warning names the provider and the expected prefix only. It never repeats the key or any part of it, and it is never coloured with certainty, severity, hazard or error tokens.
