# ManifestRetry

The manifest retry panel is an optional card that lets the presenter paste container numbers from a manifest and check the container ID again. It appears only after an inspection that could not identify the container ID (spec §3.2), sits directly beside or under the `ContainerId` card, and never blocks anything: the rest of the result stays visible and readable.

## Words
- Title **Container ID not identified**, body *If you have the manifest, paste the container numbers and check again.*, kicker *Optional*.
- Field label *Container numbers from the manifest*. Never say the presenter must fix, correct, confirm or enter the number.
- Primary **Check again with this manifest**; secondary **Keep first result** (closes the panel, nothing changes).
- Cost note under the actions: *This runs a new live check on **[provider model]** and adds to the cost total.* Use the provider and model names from the current run, e.g. *OpenAI GPT-6 Luna*.

## Input and live feedback
- `.qs-manifest__input`: a mono text area. Accept one ID per line, commas (CSV), tabs (pasted from a spreadsheet), semicolons, spaces, or a mix. Every separator splits entries; IDs never contain spaces, so `QSIU307428 8` is not a supported form.
- `.qs-manifest__count` (`role="status"`, `aria-live="polite"`) updates as the text changes: *312 container numbers found*, *2 duplicates ignored* (compared ignoring case).
- Over 500 entries: add `.qs-manifest__limit` with the `cross` glyph, *Limit for this demo is 500. Remove some to continue.*, and disable the primary action.
- No messages about check digits or ISO format. Entries are used as pasted.
- Disabled means `aria-disabled="true"` (not the `disabled` attribute), so the button stays in the tab order and its `aria-describedby` reads out the count and the cost note.

## States
1. **Ready**: head, field, count, actions, cost note.
2. **Checking**: replace the field and actions with `StageProgress`: *Checking against manifest*, *Reading the container ID again*, *Updating the result*. No passes, retries or candidates.
3. **Done**: the panel closes (`.is-leaving`, then `hidden`) and the new reading replaces the earlier `ContainerId` in place, landing with the usual `.qs-arrived` settle. Its `ProvenanceTag` reads **Matched against manifest** (`qs-prov--manifest`) when a manifest entry matched, or **Read from image** when the reading came from the photo. The earlier ID result is not kept on screen; it stays in the exported JSON.
4. **Error**: an error `Notice` inside the panel with the provider's message (*OpenAI said: "…"*) and *Your first result is unchanged.*, then **Try again** and **Keep first result**, and the cost note for trying again.

## Rules
- Tokens only. The panel is neutral (`surface`, `line-strong`, `ink`, `ink-muted`, `brand` for the action and the list glyph). Never use certainty, severity or hazard colours on it; the `ContainerId` beside it keeps its own certainty styling.
- No candidate picker, no approve/reject, no confirm step.
- Keyboard order: text area, primary, secondary. After an error, focus moves to *Try again*.
- Motion is limited to the panel leaving and the ID settling; under reduced motion both are instant.
- Desktop-first. Under 480px the padding tightens and both buttons go full width.
- A manifest retry is a live call on the same provider and model; the `CostIndicator` ledger shows it as its own line.
