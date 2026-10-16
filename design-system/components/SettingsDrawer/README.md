# SettingsDrawer

The settings drawer reopens the setup form from the `SettingsChip` without leaving the inspection screen. It renders the same `ProviderSelect` form as the `SetupCard`.

## Use
- `aside.qs-drawer` (`role="dialog"`, `aria-modal="false"`, `aria-labelledby` its title) on the right edge, full height, up to 440px wide and full width on phones.
- `.qs-drawer__head`: the title *Settings* (`.qs-drawer__title`) and a ghost close button (`aria-label="Close settings"`, cross glyph).
- `.qs-drawer__body`: the `.qs-setup` form, then one `.qs-hint` saying what a change does.
- `.qs-drawer__foot`: a secondary **Done** that closes it.
- A floating layer: `surface-raised`, a `line` left edge and `shadow-raised`. It slides in over `duration-base`; reduced motion drops that to nothing.

## Behaviour
- **Non-modal and always closable.** No scrim and no focus trap. Escape, the close button, Done, Enter in the key field and a click outside each close it.
- Focus moves to the first control (the provider button) when it opens and back to the `SettingsChip` when it closes.
- **Changing the provider or model** runs `NewInspection`: a blank screen, with the next run attributed to the new choice. **Changing only the key** resets nothing.
- The presenter can reveal, hide, edit or clear the key. A cleared key stops live runs until a key is entered again; the chip then reads *no key*.
- A key entered for one provider stays with that provider. Switching provider shows that provider's own key field.

## Don't
- Don't make it a modal or block the screen behind it (the `Notice` "never a modal" rule still applies).
- Don't show the key in the chip, the title or any summary, and don't remember it after a refresh.
- Don't colour it with certainty, severity or hazard tokens. Nothing is green.
