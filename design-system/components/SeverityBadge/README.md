# SeverityBadge

The severity badge shows a suspected defect's CEDEX code and its apparent visual severity, from one to three bars.

It is deliberately a different scale from certainty: magenta and bars here, against blue-to-amber discs for certainty. A high-confidence minor dent and a low-confidence possible hole must both read correctly, so a finding always shows **both** a SeverityBadge and a CertaintyChip.

## Consumer provides
`<span class="qs-sev qs-sev--{minor|moderate|major}">` containing `.qs-sev__bars` with three empty `<i>`, an optional `.qs-sev__code` (CEDEX: `DT`, `BT`, `BW`, `HO`, `CK`, `CW`, `CO`, `CH`, `BR`) and the word. The bars fill from the class.

## Copy
Say *apparent* or *visual* severity in details ("Apparent moderate dent"). Never a repair verdict: no *Repair required*, *Fails inspection* or *Seaworthy*.

## Don't
Don't reuse `sev-*` or `damage-*` tokens for errors or hazard markings.
