# FieldRow

A field row shows one reading in the summary: a label, a value with its provenance, a certainty chip, and an optional explanation.

## Consumer provides
- `.qs-field__label`: the field name in uppercase, as printed on the doors (MAX GROSS, TARE, ISO CODE).
- `.qs-field__value`: the value in `data` style (mono), then one `ProvenanceTag`. When nothing can be stated, add `qs-field__value--absent` and a plain sentence ("Not visible in this photo") instead of a dash.
- A `CertaintyChip` in the third column.
- `.qs-field__note` (optional) for unresolved items, always as **Best interpretation:** … **What remains uncertain:** …

## Rules
- Rows are read-only. No inputs, pickers or edit icons.
- Sort the most useful confident readings first, then caveats. Raw model probabilities go in the expandable technical detail, not here.
- Units and grouping: `32,500 kg`, never the lb value in the kg slot. Keep MAX GROSS, TARE and PAYLOAD as separate rows.
