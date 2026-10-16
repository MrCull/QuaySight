# SettingsChip

The settings chip is the setup folded into the top bar once the presenter continues past the `SetupCard`. It says what will run and opens the `SettingsDrawer`.

## Use
- `button.qs-settingschip` in the top bar, after the brand and before the `CostIndicator` and `NewInspection`, with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` pointing at the drawer.
- Inside: the provider's `.qs-mono` monogram (`aria-hidden`), then `.qs-settingschip__text` and a chevron glyph.
- The wording carries over from the old collapsed provider summary: **{vendor} · {model display name} · key set · {mode}**, e.g. *OpenRouter · Jev latest · key set · Live* or *OpenAI · GPT-6 Luna · key set · Live*. The vendor is whose key it is; the model is named as people say it (`.qs-settingschip__model`, `ink-muted`), never by its wire id (`~typesafe/jev-latest`). The exact id and the version that answered belong to the result's *Live result* notice and the exports. The mode is always *Live*: demo mode shows no chip, and its `DemoBanner` says the results are recorded.
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
