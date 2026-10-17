# FindingCard

A finding card describes one suspected defect: its number (matching the pin on the drawing and the area on the photo), what it is, where it is, apparent severity and certainty. Selecting it opens the evidence.

## Anatomy
- `.qs-finding__n`: the finding number in a disc that repeats the pin. Fill = severity (`--cosmetic|--minor|--moderate|--major`, or `--unrated` for a component with no severity rating); outline = certainty (`--likely` dashed, `--uncertain` dotted).
- `.qs-finding__title`: a plain-English name ("Dent in the side sheet"), then `.qs-finding__loc` with where it is.
  - A **panel finding** names its photo-relative zone in words ("Photo column 2 of 5 from the left, lower half of the side sheet"; on the doors, the leaf and its top, middle or bottom). Never a CEDEX location code: the photo does not establish orientation.
  - A **component finding** names the part instead of a zone: bottom or top side rail, the corner post at photo left or right, a corner casting (door end: locking bars and cams, hinges, gaskets, header, sill). Its badge is *Not rated* when the photo gives no severity for it.
  - A part showing only rust or paint wear is titled "Surface wear on the side sheet" (never "Damage to…"), at the lowest severity (Cosmetic), listed after real findings. Its best interpretation reads "apparent surface wear on this component". Corrosion that holed the metal is not surface wear.
- `.qs-finding__tags`: one `SeverityBadge` and one `CertaintyChip`, always both.
- `.qs-finding__more`: shown when `aria-pressed="true"`. It holds the **Best interpretation** and **What remains uncertain** lines (the plausible other severity, if any), plus `.qs-prob` rows for the CEDEX damage types the provider rated, and caveats (a partly visible zone, the approximate area, severity as an apparent visual judgement, never a repair verdict). The top bar is `damage-fg`; the others are `ink-muted`. Label the provider beside the bars, never "accuracy".

## Consumer provides
A `<button class="qs-finding" data-finding="n" aria-pressed>` per finding, ordered by usefulness: confident serious findings first, then uncertain ones, then minor ones. Selection is shared: the same `data-finding` on the pin, the region zone and the photo area should toggle `is-selected` / `aria-pressed` together.

## Don't
No accept/reject, edit or "mark as false positive" controls: the result is read-only.
