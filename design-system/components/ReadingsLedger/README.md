# ReadingsLedger

The readings of one container, laid out around a `DoorFace`: each reading sits level with the place it is painted on the doors, with a short dashed link to that place. A presenter can point at the drawing and the number beside it in one gesture. It replaces the stacked Container ID, Container details and Markings cards in the main screen's detail area.

## Anatomy
`section.qs-ledger` (`aria-label="Readings"`):
- `div.qs-ledger__head`: `h2.qs-ledger__title` ("Readings") and the `UnitsToggle`.
- `div.qs-ledger__body`, three columns on the `surface-sunken` well:
  - `div.qs-ledger__side.qs-ledger__side--left`: readings painted on the **left** leaf (DG placard, approval and CSC plates) and the high-container caution. Each row takes two lines, right-aligned against the door: icon and label, then the value and its `CertaintyChip`.
  - `div.qs-ledger__door`: the `DoorFace`, drawn 480px wide (`--ledger-door`).
  - `div.qs-ledger__side.qs-ledger__side--right`: readings painted on the **right** leaf, top to bottom: Container ID, size-type code, max gross, tare, payload, cubic capacity, seal. Each row is one line: icon, label, value, `CertaintyChip`. A fixed value column keeps the chips in a column.
  - In each side, `svg.qs-ledger__links`: one dashed `path` per linked row, from a dot on the door's edge at the slot's height to the middle of its row.
  - Optionally, at the right edge, `div.qs-ledger__evidence` crops (`qs-evidence`), level with the rows they back up. The main screen shows the ID and seal close-ups in their key-facts tiles instead (`KeyFactTile`), where they have room to be read and carry the loupe; use the ledger's evidence column for a reading whose close-up has no tile.
- `div.qs-ledger__more`: readings that are not painted on the doors, as plain `FieldRow`s under `p.qs-ledger__more-title` ("Not painted on the doors"): what was decoded from the size-type code (length, height, width, type), the model's answers (reefer, open top, tank, flat rack) and the markings looked for but not seen.

### A row
`div.qs-ledger__row` with `--y` (its top, in px from the top of the door):
1. `i.qs-glyph.qs-glyph--lg.qs-glyph--{name}.qs-ledger__icon`, the kind of reading: `tag` Container ID, `container` size-type code, `weight` max gross, `scale` tare, `package` payload, `cube` cubic capacity, `padlock` seal, `stamp` approval plate, `document` CSC plate, `hazard` DG placard, `height` high-container caution (`length` and `height` also suit decoded dimensions).
2. `span.qs-ledger__label.qs-type-label`: a short field name (*ID*, *Type*, *Max gross*, *Tare*, *Payload*, *Seal*).
3. `span.qs-ledger__value`: the reading **character by character**, through `ContainerId`'s markup at the small size: `span.qs-id.qs-id--sm` with `.qs-id__group`s of `.qs-id__ch`, each with its own `data-c` (none for confident, `likely`, `uncertain`, `unknown`), and the boxed `.qs-id__check` for the container ID's check digit only. A unit follows in `span.qs-ledger__unit` (*kg*, *m³*, or *lb*, *cu ft* under Imperial). A calculated value adds `span.qs-prov.qs-prov--calculated` ("Calculated"). Words (a marking, *No DG placard visible*) use `qs-ledger__value--words` and no per-character marks.
4. The `CertaintyChip` for the whole reading: its weakest character, never better.
5. Optional `p.qs-ledger__note` under the value, one short line: a plausible alternative (*Also possible* `QSIU 3074`**`7`**`8 1`, the differing character in `cert-uncertain-fg`), *Check digit valid*, or a caveat (*Not evidence that the cargo is non-hazardous*).

The ledger takes over from `ContainerId`'s card, `SealCard` and the Container details and Markings cards in the detail area: the same readings, the same per-character marks, the same tap-to-enlarge crops, now arranged around the door. The key-facts tiles above it keep their own large ID and seal.

Rows that land on the jump targets of the key-facts tiles carry `data-detail` and `tabindex="-1"`: the Container ID row `detail-id`, the Seal row `detail-seal`, the DG placard row `detail-markings`.

### Evidence crop
`button.qs-evidence` inside `div.qs-ledger__evidence` (`--y` like a row): `span.qs-evidence__frame` holding the region cut from the photo, then `span.qs-evidence__cap` with the `photo` glyph and the photo's number. One crop can back several rows (the weight block). A crop appears only when the model gave a usable box for that reading; no box, no crop, and no empty frame. Tapping it opens the full photo with the region outlined (`PhotoViewer`, `qs-photo-region`), as `SealCard`'s crop does. The crop is the photo as uploaded: never drawn on.

## Layout
- **Level with the paint.** A row's ideal top is its slot's height on the drawn door minus half a row (`slot y × 480 ÷ 600 − 16`). Rows never overlap: going down each side, a row starts at its ideal top or `space-2` below the row above, whichever is lower. Its link bends to reach it. Rows with no slot (a calculated payload) take the next free place in order and have no link.
- **Narrow** (the ledger's own width under 960px, a container query): the door goes first, at most 384px wide, then the readings as a list. Each row becomes two lines, as `FieldRow` does on a phone: icon, label and certainty, then the value and its note. No links; the crops follow the readings.

## States
- **Reading**: while the inspection runs the door is drawn bare and each row shows its icon and label with a `qs-skeleton` bar in place of the value. No chips, no crops.
- **Arrived**: rows carry `qs-rise` with `--i` in reading order, the characters settle as `ContainerId`'s do, and the door's painted values appear with their rows.
- **Not read**: a reading the model could not make out keeps its row with *Can't tell* (`unknown`) and no value; a part not visible keeps *Not seen*. A part the survey did not ask about has no row. Absent means not asked, never Not seen.

## Rules
- Fixed status words only: **Confident**, **Likely**, **Uncertain**, **Can't tell**, **Not seen**. Never *verified*, *safe* or *valid* on its own (the check digit line says *Check digit valid*, a fact about the digits).
- Never show passes, refinement, candidates or retries: the best reading, its certainty, one plausible alternative at most.
- Three axes, never mixed: certainty on underlines and chips; hazard colour only on the DG placard and caution stripes in the drawing; no damage here at all.
- Numbers, IDs, codes and units in IBM Plex Mono; thousands grouped (`32,500 kg`); one unit system at a time, as the `UnitsToggle` says.
- Read-only: nothing asks the presenter to confirm or correct a reading. Tokens only; don't re-colour `qs-*` parts locally.
