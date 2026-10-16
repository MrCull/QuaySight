# ContainerSchematic

The schematic is a neutral 3D drawing of the container, shown as **two fixed views side by side**. Each view shows one end, one long side and the roof:

- **Rear and right side**: the door end with locking bars and castings, and the right side.
- **Front and left side**: the plain corrugated front wall, and the left side.

Together they show all six faces. The roof appears in both views but is always **greyed out** (`.qs-c-roof`, lower opacity): it is rarely photographed and must never compete with the faces that were. Tinted zones and drop pins show where the suspected damage is.

## Encoding: four channels, never mixed
- **Where**: a tinted zone (`.qs-region`) over the classified region of the face, plus a pin standing on it.
- **Severity**: the zone tint and the pin head fill, `sev-cosmetic` (lightest), `sev-minor`, `sev-moderate` or `sev-major`; neutral (`qs-region--unrated`, `qs-marker--unrated`) for a component with no severity rating.
- **Certainty**: the pin head outline. Solid is confident, dashed (`qs-pin--likely`) is likely, dotted (`qs-pin--uncertain`) is uncertain.
- **Coverage**: a face that wasn't photographed is hatched and tagged *not seen* in its view, and listed in the `.qs-coverage` strip under both views. A view with no photographed faces says *No photos* in its caption. A face is never shown as clear.

## Drawing
- Both views use the same projection, so they read as one object turned round: in the front-and-left view the long face is the left side and the end on the right is the front wall. Each finding is drawn in the one view that holds its face. Wrap the views in `.qs-schem__views > .qs-schem__views-in`, each in a `figure.qs-schem__view` with a `figcaption`. The views stack one above the other by default; a container query puts them side by side only when the drawing is at least 1280px wide.
- An oblique projection with the length axis at about 10° and depth at about 26°. The faces are drawn flat in their own coordinates (feet) under a `matrix()` transform, so ribs, rails and stencils stay true to the face.
- The long side is `schem-side` with `schem-side-rib` corrugations and `schem-rail` rails and corner posts. The door end is a step darker (`schem-end`, `schem-end-rib`) with `schem-detail` locking bars, keepers and hinges. The roof is the lightest face (`schem-top`). Outer edges and castings use `schem-stroke`. A blurred `schem-shadow` grounds it.
- The 10 × 2 region grid (`schem-grid`, dashed) appears on hover or with `qs-schem--show-grid`, so the drawing stays clean until someone looks closer.
- 40 ft sides use 10 sections and 20 ft sides use 5. When orientation is unknown, draw one face labelled *Image-relative view* instead of naming a side.
- **Image-relative long side.** A live long-side assessment is drawn on one face captioned *Long side, image-relative*, whatever the container's length, with the set's own photo-relative 5 × 2 zone grid (columns from photo left, top and bottom halves of the side sheet) shown and each zone's visibility drawn on it: see `DamageAssessment`. Rails, corner posts and castings are component findings, drawn as bands along that part of the face.

## Consumer provides
The SVG (generated from face geometry), one `g.qs-region[data-finding]` per finding, and one `g.qs-pin[data-finding]` per finding with `role="button"`, `tabindex="0"`, `aria-pressed` and an `aria-label` covering the code, severity, certainty and location. Pins share `data-finding` with the `FindingCard` and the photo area, so selecting any of them selects all three. A selected pin gets a `focus-ring` outline and a slow ripple.

## Motion
Under `.qs-arrived`, zones fade in, then pins drop in one after another (`duration-arrive`, staggered 160ms) and each sends out one ripple. Under reduced motion, everything is simply present.

## Rules
- Draw faces and regions only. Never paint a dent, hole, crack or rust patch onto the drawing.
- Keep the caption: an illustrative drawing with approximate regions, not pixel-precise or certified CEDEX locations.
