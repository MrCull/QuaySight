# FindingCard

A finding card describes one suspected defect: its number (matching the pin on the drawing and the area on the photo), what it is, where it is, apparent severity and certainty. Selecting it opens the evidence.

## Anatomy
- `.qs-finding__n`: the finding number in a disc that repeats the pin. Fill = severity (`--minor|--moderate|--major`); outline = certainty (`--likely` dashed, `--uncertain` dotted).
- `.qs-finding__title`: a plain-English name ("Dent in the door panel"), then `.qs-finding__loc` with face, region and photo.
- `.qs-finding__tags`: one `SeverityBadge` and one `CertaintyChip`, always both.
- `.qs-finding__more`: shown when `aria-pressed="true"`. It holds the **Best interpretation** and **What remains uncertain** lines, plus `.qs-prob` rows for the provider's alternatives. The top bar is `damage-fg`; the others are `ink-muted`. Label the provider and pass beside the bars, never "accuracy".

## Consumer provides
A `<button class="qs-finding" data-finding="n" aria-pressed>` per finding, ordered by usefulness: confident serious findings first, then uncertain ones, then minor ones. Selection is shared: the same `data-finding` on the pin, the region zone and the photo area should toggle `is-selected` / `aria-pressed` together.

## Don't
No accept/reject, edit or "mark as false positive" controls: the result is read-only.
