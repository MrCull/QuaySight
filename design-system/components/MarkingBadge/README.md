# MarkingBadge

A marking badge reports a visible special marking or placard exactly as seen, with its caveat.

## Variants
- `qs-marking qs-marking--hazard` with the diamond glyph: **only** for DG placards and safety warnings (SUPER HEAVY, overwidth, marine pollutant, fumigation). `hazard-fg` and the diamond appear nowhere else in the product.
- `qs-marking` (neutral): operational markings such as high-container stripes, and the absence of a placard.

## Consumer provides
The glyph, one line naming the marking, and an optional `.qs-marking__caveat`. Each marking is its own badge: never collapse several into "multiple warnings".

## In a field row
The app's *Markings* card checks each marking separately, one `FieldRow` per marking (DG PLACARD, SUPER HEAVY, HIGH CONTAINER, OVERWIDTH, FUMIGATION, MARINE POLLUTANT). A marking that was seen is a badge in the row's value cell, with its `CertaintyChip` beside it. One that was not seen has no badge: the value reads *Not visible in this photo* with *Not seen*; one the photo did not settle reads *Not clear from this photo* with *Can't tell*. The absence of a placard is the one absence shown as a (neutral) badge, so its caveat is always read. Seen markings sort first. A card the run never checked says *Not assessed in this inspection* in one sentence.

A DG placard names its class and symbol only: "DG placard, class 3 (flammable liquids) visible", caveat "Symbol: Flame. Cargo status unknown without a declaration".

## Copy
- "No DG placard visible", never "Non-hazardous" or "Safe".
- A high-container warning is not an overwidth warning. Name what was seen.

## Don't
Never use the hazard style for uncertainty, low probability or API errors.
