# WhatWeFound

The plain-words summary at the top of every result, live or recorded (spec 8.1). It is the one place the app speaks as "we". It reads the inspection record and nothing else: the container ID and how sure we are of it, the container type, the key weights, any operational markings and the DG placard, and the damage verdict for the face seen. Use it as the first card of the readings column, above `ContainerId`.

## Consumer provides
- A `section.qs-found` with `aria-labelledby` pointing at its heading, wrapped in `qs-rise` (with `--i`) so it arrives with the rest. A part that lands while the run is still going adds `qs-arrived` to the card itself.
- `h2.qs-found__k.qs-type-label`: the words *What we found*.
- `p.qs-found__headline.qs-type-display-md`: one line (below).
- Optional `div.qs-found__block` with `div.qs-found__label.qs-type-label` and a `ul.qs-found__list.qs-type-body`: **What remains uncertain** (caveats), then the same block with **What is missing** when a run is partial.
- `ul.qs-found__facts` of `li.qs-found__fact`, each a `span.qs-found__topic.qs-type-label` (ID, Type, Weights, Markings, Damage) and a `p.qs-type-body`: what was found.

## Order and wording
1. **Caveats first.** When anything is uncertain the headline says so (*Some of what we found is uncertain*) and the caveat block comes straight after it, above everything found. A caveat names the thing, says why in the evidence's own words and ends with its status word: *The container ID is Uncertain. Best reading: COYU 266813 0. Also possible: COYU 266818 0.*
2. **Then what is missing**, on a partial or cancelled result: *Not finished: damage.* / *Could not be read: container details.* / *Still arriving: damage.* A part that has not arrived is left out and named here; it is never reported as *Not seen*.
3. **Then what was found**, one row per topic. A part whose whole content is already a caveat (an uncertain ID, a size code that cannot be read) is not repeated here.
4. **Headline.** Nothing uncertain: the container and its type (*COYU 266813 0: 20 ft standard height, general purpose*). Otherwise *Some of what we found is uncertain*, or, with only gaps, *Here is what arrived* (*Here is what has arrived so far* while a run is still going).

Each sentence carries one of the fixed words, in brackets after the reading: **Confident**, **Likely**, **Uncertain**, **Can't tell**, **Not seen**. A reading that is only calculated says so (*calculated*). Never *supported*, *verified*, *safe*, *undamaged*.

## Rules
- **Three axes, never mixed.** The card is plain ink on `surface`, with the caveat block on `surface-sunken`. No certainty disc colours, no severity colours, no hazard orange: the words carry the meaning. Nothing is green.
- **Weights in the units the toggle shows** (`32,500 kg` or `71,650 lb`). A maximum is *a rating, not the cargo weight*; payload is *the most it may carry*. Kg and lb readings that disagree are a caveat that gives both readings, whichever unit is showing.
- **Absence is not a result.** *No DG placard visible, which says nothing about the cargo.* A marking not seen is not called absent. A face the photo did not show is *not in the photo, so we have not seen it*, never clear. A part the run did not look at says *not assessed in this inspection* (recorded samples have no markings, equipment or door checks).
- **The damage verdict is for the face seen**, in the words of the damage view: the number of suspected findings and the most certain ones (title, apparent severity, status word), *Potentially significant damage, closer inspection advised* when flagged, or *Damage not assessed for this view* with the reason.
- **Never machinery.** No passes, refinement, candidates, retries or question names.
- Read only. Nothing here asks the presenter to confirm, correct or choose.

## Motion
The card is one `qs-rise` item: it rises in with the readings. A card that lands while the run is still going carries `qs-arrived` itself. Under `prefers-reduced-motion` (or `qs-reduced-motion`) it simply appears.

## Phone
The topic column folds above its sentence below 480px; padding drops to `space-4`.
