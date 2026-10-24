# FindingCard

A finding card describes one suspected defect: its number (matching the pin on the drawing and the area on the photo), what it is, where it is, apparent severity and certainty. Selecting it opens the evidence.

## Anatomy
- `.qs-finding__n`: the finding number in a disc that repeats the pin. Fill = severity (`--cosmetic|--minor|--moderate|--major`, or `--unrated` for a component with no severity rating); outline = certainty (`--likely` dashed, `--uncertain` dotted).
- `.qs-finding__title`: a plain-English name ("Dent in the side sheet"), then `.qs-finding__loc` with where it is.
  - A **panel finding** names its zone in words ("Sections 3 and 4 of 10 from the door end, lower half of the side sheet"; photo-relative, "Photo column 2 of 5 from the left", while the side is not settled; on the doors, the leaf and its top, middle or bottom). The words stay beside the CEDEX location code: they carry detail the code does not.
  - A **component finding** names the part instead of a zone: bottom or top side rail, the corner post at photo left or right, a corner casting (door end: locking bars and cams, hinges, gaskets, header, sill). Its badge is *Not rated* when the photo gives no severity for it.
  - A part showing only rust or paint wear is titled "Surface wear on the side sheet" (never "Damage to…"), at the lowest severity (Cosmetic), listed after real findings. Its best interpretation reads "apparent surface wear on this component". Corrosion that holed the metal is not surface wear.
- `.qs-finding__tags`: one `SeverityBadge` and one `CertaintyChip`, always both.
- `.qs-finding__codes` (compact card): the CEDEX damage type (`.qs-type-code`, `damage-fg` on `damage-bg`) and, when there is one, the CEDEX location code (`.qs-cedex-code`, neutral). An estimated code is prefixed `≈`. A type below the naming bar reads *Type Uncertain* (`.qs-type-code--none`); a finding with no location code shows none, never an invented one.
- `.qs-finding__more`: the older single-column card's expanded body, shown when `aria-pressed="true"`. The damage view now uses compact cards and the detail panel below instead.

## Compact card and detail panel
With many findings the cards sit in a full-width grid under the drawing (`.rs-findings`, `repeat(auto-fill, minmax(280px, 1fr))`: three or four columns on a wide desktop, one on a phone). Each is a compact `button.qs-finding.qs-finding--compact`: number, title, the described position, `.qs-finding__codes`, then `.qs-finding__tags` (severity, without a code, and certainty). It has no `__more`.

The selected finding opens in `article.qs-finding-detail` beside the drawing (`--selected` once something is selected; an empty prompt otherwise). In order:
- the head: number disc, title, described position, `SeverityBadge` and `CertaintyChip`; then the description;
- **CEDEX location** (`[data-detail="cedex-location"]`): the code in `.qs-cedex-code` and its basis (`.qs-finding-detail__basis`): *Placed from the photos*, *Estimated* (part of the face out of the photo) or *Not established* with *No code*. The code read out ("Right side · Bottom half · Sections 3 to 4 of 10"), the reason when estimated or not established, and the **Described position** in words;
- **CEDEX damage type** (`[data-detail="cedex-type"]`): the best match (`.qs-type-code`, its name, *Best match*, one plain sentence of what the type means, and its `.qs-prob--top` bar), then *Other possible types* with their bars. When no type reaches the naming bar (0.5): *Uncertain*, "No damage type is probable enough to name", and every candidate under *Candidate types*. A line says the type is not the severity;
- **Interpretation**: seen in, best interpretation, what remains uncertain, and the caveats.
Never *Confirmed*, *Verified* or *Certified* for a location: every code is an estimate from photos.

## Consumer provides
A `<button class="qs-finding" data-finding="n" aria-pressed>` per finding, ordered by usefulness: confident serious findings first, then uncertain ones, then minor ones. Selection is shared: the same `data-finding` on the pin, the region zone and the photo area should toggle `is-selected` / `aria-pressed` together.

## Don't
No accept/reject, edit or "mark as false positive" controls: the result is read-only.
