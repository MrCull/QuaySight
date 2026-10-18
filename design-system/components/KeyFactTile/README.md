# KeyFactTile

A row of key-facts tiles gives the audience the headline of a result at a glance. It sits between the photo strip and the detail area, under any notices, and replaces the old *What we found* summary. Each tile is one part of the result: its words, its certainty word and, where it applies, its severity or hazard marking. Clicking a tile takes the presenter to the matching detail section.

## Consumer provides
- `section.qs-keyfacts` with an `aria-label` ("Key facts") around `ul.qs-keytiles`.
- Optional `div.qs-keyfacts__progress` (`role="progressbar"`, with `i` inside whose width is the share of parts settled): the thin progress indicator, shown only while the run is in flight. It never shows a percentage in words, and replaces the stage list.
- One `li.qs-keytile.qs-keytile--{id|seal|damage|placards}` per tile, holding a `div.qs-keytile__body` with `role="button"` and `tabindex="0"` (it can hold the ID display, which a `button` may not). Set `data-tile` and `data-state` (`reading`, `arrived` or `unavailable`).
- Inside the body:
  - `span.qs-keytile__head`: `span.qs-keytile__label.qs-type-label` and, once arrived, the `CertaintyChip`.
  - The value: `span.qs-keytile__value.qs-type-display-md` (the seal number adds `qs-keytile__value--mono`). The Container ID tile sets the reading through `ContainerId` instead, which carries the check-digit result and *Not a common owner code*.
  - Optional `span.qs-keytile__extra` (the `SeverityBadge`, or the hazard `qs-marking--hazard` badge on Placards) and `span.qs-keytile__notes.qs-type-body-sm` for short facts.

## The four tiles
1. **Container ID**, first and wider (twice the width of the others): the ID through `ContainerId`, its certainty word, the check-digit result and the owner-code note. With fewer than 6 characters read it says **ID not readable in this photo** and shows no ID.
2. **Seal**: the number (`?` shown as a middle dot) and its certainty, or **Not seen**. A seal with no readable number says *Number not readable*.
3. **Damage**: how many findings (*3 findings*, *1 finding*) and the worst severity as a `SeverityBadge`, or **None seen**. When no finding is rated the tile says *Severity can't tell*.
4. **Placards**: present **only when a placard is seen**: the class and its name for one placard (*Class 3, flammable liquids*), *3 placards* with the classes listed under it for several, or *Placard seen* when the class was not read, with the certainty word and the hazard badge. No placard seen adds no tile and no clutter.

A part the survey did not answer reads *Not assessed*, never *Not seen*.

## States and arrival
- **Reading**: from the moment the inspection starts every tile shows **Reading…** in `ink-muted` over a `qs-skeleton` bar, `aria-busy="true"`. No certainty chip, no value.
- **Arrived**: the tile's part has landed. A tile that fills in while the run is still going carries `qs-rise` with `--i` set to its position (and `qs-arrived` on the tile itself), so the tiles fill in one after another with the standard `.qs-arriving` → `.qs-arrived` choreography. The Container ID and Seal tiles land together (one stage reads both), Damage and Placards on their own.
- **Unavailable**: the part failed or was cancelled. The tile says **No result**, never *Not seen*; the notice above the tiles says why.

Under `prefers-reduced-motion` (or `qs-reduced-motion`) the tiles simply appear, and the progress bar does not animate.

## Click to jump
Clicking (or Enter or Space on) a tile scrolls to its detail section, moves focus to it and outlines it for a moment with `.qs-flash` (`focus-ring`, never a certainty, severity or hazard colour). Under reduced motion it jumps without scrolling animation and the outline is still. The sections are marked `data-detail` with `tabindex="-1"`: Container ID `detail-id`, Seal `detail-seal`, Damage `detail-damage`, Placards `detail-markings` (the Markings card). A tile whose section is not on screen does nothing.

## Rules
- **Three axes, never mixed.** The certainty chip carries certainty (`CertaintyChip`'s own colours), the `SeverityBadge` carries severity, and `qs-marking--hazard` appears only on the Placards tile. The tile itself is plain `surface` with a `line` border. Nothing is green.
- Fixed status words only: **Confident**, **Likely**, **Uncertain**, **Can't tell**, **Not seen**. Never *supported*, *verified*, *safe* or *undamaged*.
- A placard says nothing about the cargo: the tile names the class only.
- Never show passes, refinement, candidates or retries. The tile shows the best value and its certainty; a plausible alternative stays in the detail section.
- Tokens only; don't re-colour `qs-*` parts locally. Read only: nothing here asks the presenter to confirm or correct.

## Layout
Tiles share one row and wrap: the ID tile takes `6 x --space-8` as its basis, the others `3 x --space-8`. At 1920px the strip, the tiles and the top of the damage view sit above the fold. On phones the tiles stack, with `space-3` padding.
