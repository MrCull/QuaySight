# DamageAssessment

How the damage view shows one damage set's assessment of one photo: the long side (zone grid of 5 or 10 columns by 2) and the door end (two leaves × top, middle, bottom thirds). It is the `ContainerSchematic` and `FindingCard`s, plus the set's own checks above them. The face the photo shows chooses the set; the presenter is never asked.

## Anatomy
- **Photo checks** (`ul.qs-damage-facts`, one `li` per check, a `span` label then the value): *Photo quality* (Good, Limited, Poor), how much of the face is visible (*Side sheet visible* on a long side, *Door end visible* on the door end: Full, Most, Partial) and the door end, shown only when the photo shows it directly (*Door end*: At photo left, At photo right). Neutral chips: never a certainty, severity or hazard colour. A check the reply did not answer is left out, never shown as good.
- **Significance** (`p.qs-significant`): *Potentially significant damage, closer inspection advised*, shown only when the model says so. It sits on the severity axis (`damage-bg`, `damage-fg`, a `sev-moderate` edge) and is never a repair verdict: no *Repair required*, *Fails inspection* or *Unserviceable*.
- **Zone grid** on the long side (add `qs-schem--show-grid` so it stays visible): one `g.qs-c-zone` per zone with a `title` in words.
  - clearly visible: plain dashed `schem-grid` edge;
  - `qs-c-zone--partial`: partly visible, a longer dashed edge in `cert-unseen-fg`;
  - `qs-c-zone--unseen`: not visible, hatched (`qs-c-unseen-face`) and tagged *Not seen* (`g.qs-c-zone__tag`); a zone the reply left unanswered is hatched and tagged *Can't tell*.
  An unseen zone is never shown as clean, and a zone with severity *none* simply has no finding.
- **Door-end grid**, drawn on the end face of the *Rear and right side* view of the `ContainerSchematic` (the same `qs-c-zone` markup and visibility treatment as the long side, projected onto the end): two door leaves, *photo-left* and *photo-right*, each in three bands (top, middle and bottom third). Corner posts frame the face at each edge, the door header runs above the leaves and the door sill below them. Zone titles say the leaf and band in words ("Photo-right door leaf, bottom third: clearly visible"). The *Not seen* and *Can't tell* tags are the narrower 56px variant so two tags sit side by side on the end. Leaves are labelled photo-left and photo-right because the photo does not say which side of the container is which; never "left door" or "right door".
- **Panel findings** tint their zone (`qs-region--{severity}`) and stand a pin on it. **Component findings** (rails, corner posts, castings; on the doors, locking bars, hinges, header, sill and corner posts, each a band on that part of the end; cams, gaskets and castings have no place on the drawing, so a card and no pin) tint a band along that part of the face, with `qs-region--unrated` and `qs-marker--unrated` when the photo gives the part no severity. A component whose place is not said (one of the castings, a cam, a gasket) has a card but no pin.
- **Not assessed for this view**: when the photo shows no face a set covers (roof, close-up, unknown view, front end), or the set's own coverage check says its face is not inspectable, the view shows a `qs-notice` with the *unseen* glyph, the title *Damage not assessed for this view* and the reason as its body. No drawing, no cards.

## In the app
The previews show only the figure that carries the findings. In the app, a long-side photo is drawn on the fixed view for its side, found from where the doors are in the photo (doors at photo-left: left side; doors at photo-right: right side). When the doors don't settle it, the damage is drawn on the *Rear and right side* view with a visible note that the side is not certain. A fixed view with no photographed face is hidden and replaced by one line saying that side was not photographed. The `.qs-coverage` strip stays under the views.

## Copy
- Locations are photo-relative words: "Photo column 2 of 5 from the left, lower half of the side sheet"; "Photo-right door leaf, bottom third". Never a CEDEX location code: orientation is unknown.
- Damage types are CEDEX damage types with their names (DT Dent, BT Bent, BW Bowed, HO Holed, CK Cracked, CW Cracked weld, CO Corroded, CH Corroded and holed, BR Broken).
- Severity is *apparent*: "apparent moderate dent". Door panel findings read "Dent in the door panel", component findings "Damage to the door sill".

## Don't
- Don't show passes, questions or sets: the view shows findings, their certainty and severity, and the checks above.
- Don't colour the photo checks by quality (no green Good, no red Poor).
