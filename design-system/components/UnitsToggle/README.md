# UnitsToggle

The units toggle switches the Container details readings between **Metric** and **Imperial**. It is a display setting, nothing more: it never changes what was read, what the record holds or what the exports carry (exports always carry both units).

## Consumer provides
- A `.qs-seg` (`role="group"`, `aria-label="Units"`) in the heading row of the Container details panel (`.rs-card__head`), at the end opposite the *Container details* label.
- Two `button.qs-seg__opt` (`type="button"`): **Metric** and **Imperial**, each with `aria-pressed` (`true` on the one in force). Each holds its word and an `<i class="qs-glyph qs-glyph--check">`; the glyph only shows on the pressed option, so the choice is never carried by colour alone.

## Behaviour
- Starts on **Metric**.
- The choice is remembered in this browser (browser storage, a per-viewer convenience). A browser that blocks storage still works: it starts on Metric and forgets on reload.
- Switching re-renders the weights and the cubic capacity in the chosen unit (`32,500 kg` or `71,650 lb`; `33.2 m³` or `1,173 cu ft`). Nothing else on the screen moves, and nothing animates.
- Where a figure was printed in only one unit, the other unit is shown converted and tagged *Calculated* (see `FieldRow`), never as if it had been printed.
- A weight whose kg and lb readings disagree shows both readings in its note whichever unit is in force.

## Keyboard
Tab to the group, then Tab between the two buttons; Space or Enter presses. Focus uses the shared 2px `focus-ring`, drawn inside the option (`outline-offset: -2px`) because the group clips anything outside its own edge.

## Rules
- The brand colour marks the pressed option, as for any chosen control. It never means a status.
- No colour from the certainty, severity or hazard axes.
- Sentence case words, no icons for the units themselves.
