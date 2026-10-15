# CertaintyChip

The certainty chip tells the audience, in everyday words, how sure Quay Sight is about one reading or finding.

| Label | Class | Glyph | What it tells the audience |
| --- | --- | --- | --- |
| Confident | `qs-cert--confident` | full disc | Clearly visible, and everything checks out. |
| Likely | `qs-cert--likely` | ¾ disc, dashed edge | Probably right, but not certain. |
| Uncertain | `qs-cert--uncertain` | ½ disc | Could be one of a few things. The alternatives are shown. |
| Can't tell | `qs-cert--unknown` | ring with a bar | In the photo, but not clear enough to say. |
| Not seen | `qs-cert--unseen` | dashed ring, hatched | Not in any photo, so nothing can be said about it. Never "clear". |

The disc fills as confidence rises, so the glyph alone carries the level on a projector, for colour-blind viewers and in greyscale.

## Why these words
Each label answers "how sure are we?" in words a non-specialist reads the same way. *Supported* and *Not established* were dropped because they are evidence jargon and mean different things to different people. When the chip stands alone, a tooltip or `aria-label` gives the full sentence from the table above.

## Consumer provides
A `<span class="qs-cert qs-cert--{level}">` holding `<i class="qs-glyph qs-glyph--{level}"></i>` and the exact label above. When the chip is the only signal in a row, add `aria-label="Certainty: Likely, probably right but not certain"`.

## Don't
- Never write *Confirmed*, *Certified*, *Safe*, *Verified*, *Supported* or *User review required*.
- Never colour a chip green. A 100% model probability is still **Confident** at most.
- Don't use a certainty chip for damage severity. Severity uses `SeverityBadge`, a different scale.
- Don't turn a missing probability into Confident or Can't tell. If the provider gave no metric, say so in the field note.
