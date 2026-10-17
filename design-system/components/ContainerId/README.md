# ContainerId

The container ID is the hero reading: an ISO 6346 number set character by character, with each character's certainty underlined and the check digit boxed as it is printed on the door.

## Anatomy
- Owner code and category letter (4), first and last three serial digits (3 + 3), each a `.qs-id__group`. The gaps mirror the printed layout.
- Every `.qs-id__ch` carries `data-c`: none for confident (solid blue underline), `likely` (dashed), `uncertain` (dotted amber, amber glyph), `unknown` (slate, shown as `·`).
- `.qs-id__check` is the separately observed check digit in its box. Add `data-c="uncertain"` when the visible digit is weak.
- `.qs-id__meta` row: the overall `CertaintyChip`, the `ProvenanceTag` and the deterministic check result.

## Consumer provides
The characters, a certainty per position, the observed check digit, and whether the calculated check digit matches. Give the wrapper an `aria-label` spelling the ID out with the uncertain positions named.

## Rules
- Set in `id-xl` (IBM Plex Mono). Its dotted zero keeps O and 0 apart. Never set an ID in the display or sans face.
- A valid check digit is supporting evidence, not proof: it never upgrades a weak reading to Confident on its own.
- A partial reading shows the missing positions as `·` with `data-c="unknown"`. Never fill them in. (The seal card shows `?` instead; see `SealCard`.)
- The enlarged crop under the ID is captioned "Where we read the ID", with " · Photo N" added when there are several photos. It is a button: tapping shows the full photo with the region outlined (`qs-photo-region`), tapping again returns to the close-up.
- When the owner code is not in the list the app knows, the meta row adds the tag "Owner not on our list" (`qs-prov`, see `ProvenanceTag`). It says only that the code is unlisted, not that the ID is wrong.
- A plausible alternative sits below as "Also possible QSIU 307478 1 · the fifth digit could be a 7; the printed check digit favours 2". It is a suggestion, never a picker option, and never shows how it was produced (no passes, candidates or check counts).
- `qs-id--md` (28px) for lists, the cost ledger header and comparisons.
