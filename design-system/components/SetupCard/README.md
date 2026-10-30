# SetupCard

The setup card is the first screen. It holds the `ProviderSelect` form (provider, model, key) and one primary **Continue**, centred on `bg`. Nothing else from the inspection screen shows: no photo drop, no Inspect button, no result panels. The top bar keeps the brand and the crumb *Container inspection* (the crumb hides on phones); the `SettingsChip`, `CostIndicator` and `NewInspection` appear only after Continue.

## Use
- `section.qs-setupcard` (`role="region"`, `aria-labelledby` its title) holding `.qs-setupcard__head` (the title *Set up a provider* in `.qs-setupcard__title`, one line of `.qs-setupcard__lede`), the `.qs-setup` form from `ProviderSelect`, then `.qs-setupcard__actions` with `button.qs-btn.qs-btn--primary.qs-btn--lg` **Continue**.
- Centre it on the page: `max-width` 520px, a `space-8` margin on displays and the `space-4` gutter on phones. At phone width it fills the gutter with no horizontal scroll.
- `.qs-setupcard__after` sits under the card for one secondary link, centred: `button.qs-setupcard__demo` **Enter as demo user**. It is a button styled as a quiet underlined link (`ink-muted`, `ink` on hover), always enabled, and needs no key. It opens demo mode (see `DemoBanner`).

## Behaviour
- The recommended provider and model are chosen on first visit, so a presenter only pastes a key.
- The key field is labelled for the chosen provider ("OpenAI API key") and its hint says whose endpoint receives the photo and the key.
- **Continue** cannot proceed until a key is entered and the model belongs to the provider. It never looks switched off: it keeps its full brand fill, with `aria-disabled="true"` until it is ready. Pressing it early moves focus to the key field and shows `.qs-setupcard__hint` (*Paste your API key above to continue.*, `role="status"`), which goes once a key is entered. Enter in the key field acts as Continue.
- The fields sit in `surface-sunken` wells on the card, so they read as places to type.
- A key that doesn't start the way the provider's keys do shows the `ProviderSelect` key-format warning under the field. Continue stays enabled: the warning is advice, not a gate.
- After Continue the card makes way for the inspection screen and the setup folds into the `SettingsChip`. Focus moves to the photo drop zone (the `PhotoDrop`), the next step.
- A refresh shows the card again, with the provider and model remembered and the key empty. Keys are never stored.

## Accessibility
- Focus starts on the first control (the provider button) and moves provider, model, key, show/hide, Clear, Continue, then Enter as demo user.
- Use the shared 2px `focus-ring`. Continue uses `aria-disabled`, not the native `disabled` attribute, so it stays focusable and can explain itself.

## Don't
- Don't show any part of the inspection screen beside the card, and don't pre-fill a key in previews or screenshots.
- Don't colour the card with certainty, severity or hazard tokens. Nothing is green.
