# MarkingBadge

A marking badge reports a visible special marking or placard exactly as seen, with its caveat.

## Variants
- `qs-marking qs-marking--hazard` with the diamond glyph: **only** for DG placards and safety warnings (SUPER HEAVY, overwidth, marine pollutant, fumigation). `hazard-fg` and the diamond appear nowhere else in the product.
- `qs-marking` (neutral): operational markings such as high-container stripes, and the absence of a placard.

## Consumer provides
The glyph, one line naming the marking, and an optional `.qs-marking__caveat`. Each marking is its own badge: never collapse several into "multiple warnings".

## Copy
- "No DG placard visible", never "Non-hazardous" or "Safe".
- A high-container warning is not an overwidth warning. Name what was seen.

## Don't
Never use the hazard style for uncertainty, low probability or API errors.
