# SeverityBadge

The severity badge shows a suspected defect's CEDEX code and its apparent visual severity on a five-level scale: none, cosmetic, minor, moderate, major. *None* is never a finding, so a badge shows one of the four others, as one to four bars.

| Level | Bars | Meaning |
| --- | --- | --- |
| Cosmetic | 1 | Superficial marks only (small rust or paint damage), no deformation. The lightest step: `sev-cosmetic`, outlined badge. |
| Minor | 2 | A local dent, crease or deformation of limited extent. |
| Moderate | 3 | Clearly substantial deformation. |
| Major | 4 | Severe deformation, rupture or a hole. |
| Not rated | 0 | A component finding (rail, corner post, casting) the photo gives no severity rating for. Neutral ink, never magenta. |

It is deliberately a different scale from certainty: magenta and bars here, against blue-to-amber discs for certainty. A high-confidence minor dent and a low-confidence possible hole must both read correctly, so a finding always shows **both** a SeverityBadge and a CertaintyChip.

## Consumer provides
`<span class="qs-sev qs-sev--{cosmetic|minor|moderate|major|unrated}">` containing `.qs-sev__bars` with four empty `<i>`, an optional `.qs-sev__code` (CEDEX: `DT`, `BT`, `BW`, `HO`, `CK`, `CW`, `CO`, `CH`, `BR`) and the word. The bars fill from the class.

## Copy
Say *apparent* or *visual* severity in details ("Apparent moderate dent"). Never a repair verdict: no *Repair required*, *Fails inspection* or *Seaworthy*.

## Don't
- Don't reuse `sev-*` or `damage-*` tokens for errors or hazard markings.
- Don't show a badge for *none*: a zone with no damage has no finding. An unseen zone is *Not seen*, never *none*.
- Nothing on the scale is green, and cosmetic must never read as "clear".
