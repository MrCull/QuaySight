# ProvenanceTag

The provenance tag says where a displayed value came from. The spec requires this distinction on every reading.

| Tag | Class | Border | Use for |
| --- | --- | --- | --- |
| Printed | `qs-prov` | solid | Text read from the photo: MAX GROSS, TARE, the ID. |
| Decoded from ISO | `qs-prov` | solid | Properties derived from the size/type code (45G1 → 40 ft High Cube). |
| Estimated from shape | `qs-prov--model` | dotted | The container length judged from a side photo's proportions, panels, gooseneck tunnel and forklift pockets, when no Confident ISO code decided it (40 ft · Estimated from shape). |
| Calculated | `qs-prov--calculated` | solid, `=` prefix | App arithmetic: payload = gross − tare, check digit. |
| Alternative | `qs-prov--candidate` | dashed | A plausible other reading, shown for context. Never observed text. |
| Model-selected | `qs-prov--model` | dotted | A choice the model picked from a constrained list: the yes/no equipment checks (REEFER, TANK…). |
| Read from image | `qs-prov` | solid | The container ID after a manifest check, when the reading came from the photo rather than the list. |
| Matched against manifest | `qs-prov--manifest` | double | The container ID matched an entry in the manifest the presenter pasted (`ManifestRetry`). |
| Not a common owner code | `qs-prov` | solid | Beside the container ID when its three-letter owner code is not in the known list. It says the code is unlisted, never that the ID is wrong. |

## Consumer provides
`<span class="qs-prov [modifier]">Label</span>`, placed after the value in a `FieldRow`. Tags are neutral (`ink-muted`, `line-strong`) on purpose: provenance is information, not a judgement.
