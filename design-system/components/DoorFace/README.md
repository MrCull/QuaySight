# DoorFace

The rear doors drawn flat, with each reading painted where it is normally stencilled on a container's doors. It is the centre of the `ReadingsLedger`: the presenter sees the box and its numbers in one picture, and every reading beside it lines up with its place on the doors.

It is a **template**, not a trace of the photo. The ID always sits top right, the weight block below it, the seal on the right-hand locking handle, whatever this container's doors look like. Where the reading was actually found is the `ReadingsLedger`'s evidence crop, cut from the photo.

## Anatomy
One `svg.qs-door` with `viewBox="0 0 600 620"` (the door end of a container, in its own coordinates) and an `aria-label` that says what was painted.
- **Structure** (always drawn): `qs-door__frame` (header, sill, corner posts, the four castings with `qs-door__hole` apertures), two `qs-door__leaf` leaves meeting at `qs-door__gap`, five `qs-door__panel` recesses per leaf with a `qs-door__crease`, four `qs-door__bar` locking bars with `qs-door__hw` keepers and guides, `qs-door__handle` handles, and hinges on both posts. The `schem-*` family lights it, as in `ContainerSchematic`, so it reads as the same steel.
- **Painted readings** (drawn only when read), in these slots:

  | Slot | Where | Markup |
  |---|---|---|
  | Container ID | top of the right leaf, (350, 80) | `text.qs-door__paint`, then the check digit in `rect.qs-door__check` |
  | Size-type code | under the ID, (436, 120) | `text.qs-door__paint` |
  | MAX GROSS, TARE, NET, CU. CAP. | the weight block on the right leaf, rows at y 206, 232, 258, 284 | `text.qs-door__stencil` label, `text.qs-door__paint.qs-door__paint--sm` value, right-aligned at x 538 |
  | Seal | on the right-hand inner locking handle | `rect.qs-door__seal` |
  | Approval plate | left leaf, (82, 245) | `rect.qs-door__plate` with `text.qs-door__plate-text` |
  | CSC plate | left leaf, lower, (74, 478) | `rect.qs-door__plate`; add `qs-door__plate--unread` when it is in the photo but not readable |
  | DG placard | left leaf, centred at (167, 330) | `path.qs-door__placard` (the hazard diamond); `qs-door__placard--unseen` (a dashed outline) when none is visible |
  | High-container caution | top of both corner posts | two rects filled with the `qs-door__caution-a` / `-b` stripe pattern |

- **Certainty** of each painted value: one `line.qs-door__u` under it, with `data-c` for the value's weakest character: none (confident, solid), `likely` (dashed), `uncertain` (dotted, amber), `unknown` (thin). The ledger shows the per-character detail; the drawing shows one line per value.

## Rules
- **Paint only what was read.** A reading that was not read, or was calculated (a payload worked out as max gross minus tare), is not painted: its place on the door stays bare. Never fill a slot with a placeholder number.
- **No damage on this drawing.** Findings belong to the damage view (`ContainerSchematic`, `DamageAssessment`). The door face carries readings and markings only.
- **Three axes, never mixed.** Underlines carry certainty in the `cert-*` colours. The hazard colours appear only on the DG placard diamond and the caution stripes. Nothing is green.
- Values are set in IBM Plex Mono (`qs-door__paint`); the stencilled field names in Barlow Condensed (`qs-door__stencil`), echoing the real door. Never set an ID in another face.
- Tokens only; don't re-colour `qs-door__*` parts locally.

## Consumer provides
The SVG, generated from the reading slots above. Each painted slot is a fixed position in door coordinates, so the `ReadingsLedger` can place its rows level with them: a slot's page height is its door `y` times the drawn width over 600.

## Motion
Inside the ledger the drawing is present from the start (it is a template); the painted values arrive with the ledger's rows under `.qs-arrived`. Under reduced motion everything is simply present.
