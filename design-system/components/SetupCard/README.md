# SetupCard

The setup card is the first screen. It holds the `ProviderSelect` form (provider, model, key) and one primary **Continue**, centred on `bg`. Nothing else from the inspection screen shows: no photo drop, no Inspect button, no result panels. The top bar keeps only the brand.

## Use
- `section.qs-setupcard` (`role="region"`, `aria-labelledby` its title) holding `.qs-setupcard__head` (the title *Set up a provider* in `.qs-setupcard__title`, one line of `.qs-setupcard__lede`), the `.qs-setup` form from `ProviderSelect`, then `.qs-setupcard__actions` with `button.qs-btn.qs-btn--primary.qs-btn--lg` **Continue**.
- Centre it on the page: `max-width` 520px, a `space-8` margin on displays and the `space-4` gutter on phones. At phone width it fills the gutter with no horizontal scroll.
- `.qs-setupcard__after` sits under the card for one secondary link, centred: `button.qs-setupcard__demo` **Enter as demo user**. It is a button styled as a quiet underlined link (`ink-muted`, `ink` on hover), always enabled, and needs no key. It opens demo mode (see `DemoBanner`).

## Behaviour
- The recommended provider and model are chosen on first visit, so a presenter only pastes a key.
- The key field is labelled for the chosen provider ("OpenAI API key") and its hint says whose endpoint receives the photo and the key.
- **Continue** stays disabled until a key is entered and the model belongs to the provider. Enter in the key field acts as Continue.
- After Continue the card makes way for the inspection screen and the setup folds into the `SettingsChip`.
- A refresh shows the card again, with the provider and model remembered and the key empty. Keys are never stored.

## Accessibility
- Focus starts on the first control (the provider button) and moves provider, model, key, show/hide, Clear, Continue, then Enter as demo user.
- Use the shared 2px `focus-ring`. A disabled Continue keeps the native `disabled` attribute.

## Don't
- Don't show any part of the inspection screen beside the card, and don't pre-fill a key in previews or screenshots.
- Don't colour the card with certainty, severity or hazard tokens. Nothing is green.
