# ProvenanceTag

The provenance tag says where a displayed value came from. The spec requires this distinction on every reading.

| Tag | Class | Border | Use for |
| --- | --- | --- | --- |
| Printed | `qs-prov` | solid | Text read from the photo: MAX GROSS, TARE, the ID. |
| Decoded from ISO | `qs-prov` | solid | Properties derived from the size/type code (45G1 → 40 ft High Cube). |
| Calculated | `qs-prov--calculated` | solid, `=` prefix | App arithmetic: payload = gross − tare, check digit. |
| Alternative | `qs-prov--candidate` | dashed | A plausible other reading, shown for context. Never observed text. |
| Model-selected | `qs-prov--model` | dotted | A choice the model picked from a constrained list. |
| Manifest match | `qs-prov--manifest` | double | Matched against a list the user supplied. |

## Consumer provides
`<span class="qs-prov [modifier]">Label</span>`, placed after the value in a `FieldRow`. Tags are neutral (`ink-muted`, `line-strong`) on purpose: provenance is information, not a judgement.
