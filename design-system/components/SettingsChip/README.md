# SettingsChip

The settings chip is the setup folded into the top bar once the presenter continues past the `SetupCard`. It says what will run and opens the `SettingsDrawer`.

## Use
- `button.qs-settingschip` in the top bar, in the right-hand zone of the top bar (brand left, `NewInspection` centred), muted, just before the `CostIndicator`, with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` pointing at the drawer.
- Inside: the provider's `.qs-mono` monogram (`aria-hidden`), then `.qs-settingschip__text` and a chevron glyph.
- The visible wording is **{vendor} · {model display name} · {mode}**, e.g. *OpenRouter · Jev latest · Live* or *OpenAI · GPT-6 Luna · Live*. The vendor is whose key it is; the model is named as people say it (`.qs-settingschip__model`, `ink-muted`), never by its wire id (`~typesafe/jev-latest`). "key set" is not shown. The chip's `title` (tooltip) names the exact model version the provider reported (e.g. *Jev latest (TypeSafe) via OpenRouter*) and the key status (*key set* or *no key*); the exports carry the full ids. The mode is always *Live*: demo mode shows no chip, the `RunChip` stands in its place, and the `DemoBanner` says the results are recorded.
- With no key for the chosen provider (cleared, or a provider whose key was never entered) the key part reads **no key** and the chip takes `.qs-settingschip--nokey`: a dashed edge and the words in `ink`. Live runs can't start until a key is entered.
- Give the button an accessible name that starts with *Settings:* and repeats the visible summary.

## Rules
- Never show any part of the key: no masked dots, no last four characters, no length.
- `aria-expanded="true"` while the drawer is open, drawn with the `brand` edge used for a selected control.
- On phones the chip shrinks with an ellipsis; the top bar wraps rather than scrolling sideways.
- Focus shows the shared 2px `focus-ring`. Focus returns here whenever the drawer closes.

## Don't
- Don't use certainty, severity or hazard colours for the key status. *no key* is a setup state, not a finding. Nothing is green.
- Don't call it *Account*, *Verified* or *Connected*.
