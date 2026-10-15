# ContainerSchematic

The schematic is a neutral 3D drawing of the container: corrugated side, door end with locking bars and castings, roof. Tinted zones and drop pins on it show where the suspected damage is.

## Encoding: four channels, never mixed
- **Where**: a tinted zone (`.qs-region`) over the classified region of the face, plus a pin standing on it.
- **Severity**: the zone tint and the pin head fill, `sev-minor`, `sev-moderate` or `sev-major`.
- **Certainty**: the pin head outline. Solid is confident, dashed (`qs-pin--likely`) is likely, dotted (`qs-pin--uncertain`) is uncertain.
- **Coverage**: a face that wasn't photographed is hatched and tagged *not seen* on the drawing. Faces the drawing can't show (left side, front end) are listed in the `.qs-coverage` strip below it. A face is never shown as clear.

## Drawing
- An oblique projection with the length axis at about 10° and depth at about 26°. The faces are drawn flat in their own coordinates (feet) under a `matrix()` transform, so ribs, rails and stencils stay true to the face.
- The long side is `schem-side` with `schem-side-rib` corrugations and `schem-rail` rails and corner posts. The door end is a step darker (`schem-end`, `schem-end-rib`) with `schem-detail` locking bars, keepers and hinges. The roof is the lightest face (`schem-top`). Outer edges and castings use `schem-stroke`. A blurred `schem-shadow` grounds it.
- The 10 × 2 region grid (`schem-grid`, dashed) appears on hover or with `qs-schem--show-grid`, so the drawing stays clean until someone looks closer.
- 40 ft sides use 10 sections and 20 ft sides use 5. When orientation is unknown, draw one face labelled *Image-relative view* instead of naming a side.

## Consumer provides
The SVG (generated from face geometry), one `g.qs-region[data-finding]` per finding, and one `g.qs-pin[data-finding]` per finding with `role="button"`, `tabindex="0"`, `aria-pressed` and an `aria-label` covering the code, severity, certainty and location. Pins share `data-finding` with the `FindingCard` and the photo area, so selecting any of them selects all three. A selected pin gets a `focus-ring` outline and a slow ripple.

## Motion
Under `.qs-arrived`, zones fade in, then pins drop in one after another (`duration-arrive`, staggered 160ms) and each sends out one ripple. Under reduced motion, everything is simply present.

## Rules
- Draw faces and regions only. Never paint a dent, hole, crack or rust patch onto the drawing.
- Keep the caption: an illustrative drawing with approximate regions, not pixel-precise or certified CEDEX locations.
