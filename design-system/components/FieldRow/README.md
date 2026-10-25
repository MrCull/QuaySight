# FieldRow

A field row shows one reading in the summary: a label, a value with its provenance, a certainty chip, and an optional explanation.

## Consumer provides
- `.qs-field__label`: the field name in uppercase, as printed on the doors (MAX GROSS, TARE, ISO CODE).
- `.qs-field__value`: the value in `data` style (mono), then one `ProvenanceTag`. When nothing can be stated, add `qs-field__value--absent` and a plain sentence ("Not visible in this photo") instead of a dash.
- A `CertaintyChip` in the third column.
- `.qs-field__note` (optional) for unresolved items, always as **Best interpretation:** … **What remains uncertain:** …

## Reading glyph
A row may lead its label with the reading glyph for its kind of reading: add `qs-field__label--glyph` and put `<i class="qs-glyph qs-glyph--{name}" aria-hidden="true">` before the text. The Container details rows use `container` (ISO CODE), `length`, `height`, `width`, `boxtype` (TYPE), `weight` (MAX GROSS), `scale` (TARE), `package` (PAYLOAD), `cube` (CUBIC CAPACITY), `reefer`, `opentop`, `tank` and `flatrack`. The glyph names the kind of reading only; it takes the label's ink and never a certainty, severity or hazard colour.

## Phone
At 480px and below the row regrids: the label and the certainty chip share the first line, and the value with its provenance tag gets the full width beneath, so a long tag (*Decoded from ISO*) never runs under the chip.

## Container details rows
- **ISO CODE** is *Printed*; **LENGTH**, **HEIGHT**, **WIDTH** and **TYPE** are *Decoded from ISO* (45G1 → 40 ft, 9 ft 6 in High Cube, 8 ft standard width, General purpose). A plausible other code goes in the note: "Also possible: 22G0." When no Confident code decides the length, **LENGTH** is the side photo's shape estimate with the *Estimated from shape* tag (`qs-prov--model`); when a Confident code and the shape disagree, LENGTH keeps the code's value at *Uncertain*, the shape's value goes in the note ("Also possible: 40 ft.") and a `qs-notice--partial` line under the rows says so. A code that is printed but unreadable says so with *Can't tell*; no code in the photo is *Not visible in this photo* with *Not seen*. Nothing is decoded from a code that wasn't read.
- **REEFER**, **OPEN TOP**, **TANK** and **FLAT RACK** are separate rows, *Yes* or *No* with the `qs-prov--model` tag (*Model-selected*), or *Not clear from this photo* with *Can't tell*. A check that disagrees with the decoded code keeps its answer, reads no better than *Uncertain*, and explains the disagreement in the note.

## Weight rows in two units
A live run reads each weight in **both** kg and lb, and the cubic capacity in m³ and cu ft, so each unit can check the other. The rows are **MAX GROSS**, **TARE**, **PAYLOAD** (the printed NET or PAYLOAD), **PAYLOAD (CALCULATED)** (`qs-prov--calculated`, maximum gross minus tare) and **CUBIC CAPACITY**. A recorded sample has no printed payload row: its one **PAYLOAD** row is the calculated one.
- **Which unit shows** is the `UnitsToggle` in the Container details heading: `30,480 kg` or `67,200 lb`, `33.2 m³` or `1,173 cu ft`. Never both in one value slot. The rows, the evidence and the certainty are the same either way.
- **They agree** (after conversion, within the rounding printed on door panels, about ±0.5%): the note says *kg and lb agree.* (*m³ and cu ft agree.* for the capacity) and the certainty has risen one step. This is evidence, not a status: it sits in the note, never as a chip.
- **They disagree** (and one second look still left them apart): the value shows the reading in the unit in force, the chip is *Uncertain*, and the note shows **both** readings whichever unit is in force: *kg and lb disagree: read as 2,180 kg and 4,610 lb, which do not match after conversion.*
- **A weight it is calculated from disagrees**: **PAYLOAD (CALCULATED)** reads no better than *Uncertain* and its note says why after *Maximum gross minus tare.*: *Uncertain because tare is: its kg and lb readings disagree.* (*maximum gross*, or both: *are … their*).
- **Printed and calculated payload conflict**: the note on **PAYLOAD (CALCULATED)** says *Printed payload 28,350 kg does not match maximum gross minus tare, 28,300 kg.* in the unit in force, and MAX GROSS, TARE and both PAYLOAD rows read no better than *Uncertain*.
- **Only one unit was printed or read**: the other is the conversion, tagged *Calculated* (the `=` prefix), with the note *Converted from kg (1 kg = 2.20462 lb): the lb figure was not read.* A recorded sample, which carries kg only, shows its lb this way.
- **Maximums are not loads.** MAX GROSS says *A maximum rating, not the cargo weight.* and the printed PAYLOAD says *The most the container may carry, not a cargo weight.* Nothing here is ever called the loaded or actual weight.
- **Absent**: *Not visible in this photo* with *Not seen* when the figure is in no photo; *Not clear from this photo* with *Can't tell* when it is there but a digit could not be read. Never a zero, never a partly read figure.

## Not assessed
When a run never read a group of fields (a live run that reads the ID only has no size code or weights), don't draw a row per field with *Not seen*: *Not seen* means "in no photo", which isn't what happened. Show the group's card with one plain sentence instead: *Not assessed in this inspection: this run read the container ID only.* When only one group of a card wasn't asked, that group is one sentence under the rows: *Weights: not assessed in this inspection.*

## Rules
- Rows are read-only. No inputs, pickers or edit icons.
- Sort the most useful confident readings first, then caveats. Raw model probabilities go in the expandable technical detail, not here.
- Units and grouping: `32,500 kg`, never the lb value in the kg slot. Keep MAX GROSS, TARE and PAYLOAD as separate rows.
