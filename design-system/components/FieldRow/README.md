# FieldRow

A field row shows one reading in the summary: a label, a value with its provenance, a certainty chip, and an optional explanation.

## Consumer provides
- `.qs-field__label`: the field name in uppercase, as printed on the doors (MAX GROSS, TARE, ISO CODE).
- `.qs-field__value`: the value in `data` style (mono), then one `ProvenanceTag`. When nothing can be stated, add `qs-field__value--absent` and a plain sentence ("Not visible in this photo") instead of a dash.
- A `CertaintyChip` in the third column.
- `.qs-field__note` (optional) for unresolved items, always as **Best interpretation:** … **What remains uncertain:** …

## Phone
At 480px and below the row regrids: the label and the certainty chip share the first line, and the value with its provenance tag gets the full width beneath, so a long tag (*Decoded from ISO*) never runs under the chip.

## Container details rows
- **ISO CODE** is *Printed*; **LENGTH**, **HEIGHT**, **WIDTH** and **TYPE** are *Decoded from ISO* (45G1 → 40 ft, 9 ft 6 in High Cube, 8 ft standard width, General purpose). A plausible other code goes in the note: "Also possible: 22G0." A code that is printed but unreadable says so with *Can't tell*; no code in the photo is *Not visible in this photo* with *Not seen*. Nothing is decoded from a code that wasn't read.
- **REEFER**, **OPEN TOP**, **TANK** and **FLAT RACK** are separate rows, *Yes* or *No* with the `qs-prov--model` tag (*Model-selected*), or *Not clear from this photo* with *Can't tell*. A check that disagrees with the decoded code keeps its answer, reads no better than *Uncertain*, and explains the disagreement in the note.

## Not assessed
When a run never read a group of fields (a live run that reads the ID only has no size code or weights), don't draw a row per field with *Not seen*: *Not seen* means "in no photo", which isn't what happened. Show the group's card with one plain sentence instead: *Not assessed in this inspection: this run read the container ID only.* When only one group of a card wasn't asked, that group is one sentence under the rows: *Weights: not assessed in this inspection.*

## Rules
- Rows are read-only. No inputs, pickers or edit icons.
- Sort the most useful confident readings first, then caveats. Raw model probabilities go in the expandable technical detail, not here.
- Units and grouping: `32,500 kg`, never the lb value in the kg slot. Keep MAX GROSS, TARE and PAYLOAD as separate rows.
