# SealCard

The Seal card sits directly under the container ID. It says whether a seal is visible and, when one is, what its number reads, character by character as `ContainerId` does, with an enlarged crop of where it was read.

## Anatomy
- Card head: the `rs-k` label "Seal" and the overall `CertaintyChip`.
- The number: `qs-id qs-id--md` with one `.qs-id__group` of `.qs-id__ch`. Each character carries its own `data-c` (none for confident, `likely`, `uncertain`, `unknown`). A character that was not read is `·` with `data-c="unknown"`; never fill it in. A seal number has no fixed length, so the group is as long as the number.
- The crop: the same enlarged crop as the ID's (`PhotoCrop`), captioned "Where we read the seal". It is cut from the photo on screen and shown only when the model gave a usable box.

## States
- **Read**: the number, the chip (the number's weakest character; no better than Uncertain while a character is unread), the crop.
- **Partly read**: the unread characters are `·`; the chip is Uncertain or lower.
- **No seal visible**: the chip says **Not seen** and the card says "No seal visible in this photo". No number, no crop.
- **Seen, number not read**: the chip says **Can't tell** and the card says the number is not readable.
- **Not assessed** (the survey did not answer): the card is absent. Absent means not asked, never Not seen.

## Rules
- Statuses are the fixed words only. Never say a seal is "sealed", "intact", "safe" or "verified": the card reports what is seen and read, not the condition of the seal.
- Seals have no check digit: no box around the last character, no check-digit line, no "valid" tag.
- The number is set through `qs-id` (IBM Plex Mono), never in the display or sans face.
- Tokens only; don't re-colour `qs-*` parts locally. Arrives as a `qs-rise` card; the characters settle with `.qs-arrived` like the ID's.
