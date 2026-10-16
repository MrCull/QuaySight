# ContainerSchematic

The schematic is a neutral 3D drawing of the container, shown as **two fixed views**. Each view shows one end, one long side and the roof:

- **Rear and right side**: the door end with locking bars and castings, and the right side.
- **Front and left side**: the plain corrugated front wall, and the left side.

Together they show all six faces. The roof appears in both views but is always **greyed out** (`.qs-c-roof`, lower opacity): it is rarely photographed and must never compete with the faces that were. Tinted zones and drop pins show where the suspected damage is.

## Encoding: four channels, never mixed
- **Where**: a tinted zone (`.qs-region`) over the classified region of the face, plus a pin standing on it.
- **Severity**: the zone tint and the pin head fill, `sev-cosmetic` (lightest), `sev-minor`, `sev-moderate` or `sev-major`; neutral (`qs-region--unrated`, `qs-marker--unrated`) for a component with no severity rating.
- **Certainty**: the pin head outline. Solid is confident, dashed (`qs-pin--likely`) is likely, dotted (`qs-pin--uncertain`) is uncertain.
- **Coverage**: a face that wasn't photographed is hatched and tagged *not seen* in its view, and listed in the `.qs-coverage` strip under both views. A fixed view with no photographed face is hidden, replaced by one line saying that side was not photographed. A face is never shown as clear.

## Drawing
- Both views use the same projection, so they read as one object turned round: in the front-and-left view the long face is the left side and the end on the right is the front wall. Each finding is drawn in the one view that holds its face. Wrap the views in `.qs-schem__views > .qs-schem__views-in`, each in a `figure.qs-schem__view` with a `figcaption`. The views stack one above the other by default; a container query puts them side by side only when the drawing is at least 1280px wide.
- An oblique projection with the length axis at about 10° and depth at about 26°. The faces are drawn flat in their own coordinates (feet) under a `matrix()` transform, so ribs, rails and stencils stay true to the face.
- The long side is `schem-side` with `schem-side-rib` corrugations and `schem-rail` rails and corner posts. The door end is a step darker (`schem-end`, `schem-end-rib`) with `schem-detail` locking bars, keepers and hinges. The roof is the lightest face (`schem-top`). Outer edges and castings use `schem-stroke`. A blurred `schem-shadow` grounds it.
- The 10 × 2 region grid (`schem-grid`, dashed) appears on hover or with `qs-schem--show-grid`, so the drawing stays clean until someone looks closer.
- The drawing is to the container's length: 20, 40 or 45 ft (from the Confident ISO size-type code, else the survey answer, else 40 ft). The long side uses the CEDEX/IICL sections: 5 for 20 ft, 10 for 40 and 45 ft, no extra note for 45 ft.
- **Long side.** A live long-side assessment is drawn on the matching fixed view: doors at photo-left means the left side, doors at photo-right the right side. When the doors don't settle it, it is drawn on the top view (*Rear and right side*) with a visible note that the side is not certain. There is no separate image-relative figure. Photo-left is the start of the face and photo-right its end on both views, so the zones are not mirrored: with doors at photo-left the first column is by the doors (left side), with doors at photo-right the last column is by the doors and the rear end (right side). The chosen side is photographed and the other is *Not seen*; a defaulted side is labelled "Right side · side Uncertain". The export records the side and whether it was inferred or defaulted. The set's photo-relative zone grid (columns from photo left, top and bottom halves of the side sheet) is shown with each zone's visibility: see `DamageAssessment`. Rails, corner posts and castings are component findings, drawn as bands along that part of the face.

- **Door end.** A live door-end assessment is drawn on the end face of the *Rear and right side* view: the set's six photo-relative regions (two door leaves, each in top, middle and bottom thirds) with their visibility, and bands for the locking bars, hinges, header, sill and corner posts. See `DamageAssessment`. The face is a fraction layout (posts 0 to 0.05 and 0.95 to 1, header 0 to 0.06, sill 0.94 to 1, leaves between), not a measured door.

## Consumer provides
The SVG (generated from face geometry), one `g.qs-region[data-finding]` per finding, and one `g.qs-pin[data-finding]` per finding with `role="button"`, `tabindex="0"`, `aria-pressed` and an `aria-label` covering the code, severity, certainty and location. Pins share `data-finding` with the `FindingCard` and the photo area, so selecting any of them selects all three. A selected pin gets a `focus-ring` outline and a slow ripple.

## Motion
Under `.qs-arrived`, zones fade in, then pins drop in one after another (`duration-arrive`, staggered 160ms) and each sends out one ripple. Under reduced motion, everything is simply present.

## Rules
- Draw faces and regions only. Never paint a dent, hole, crack or rust patch onto the drawing.
- Keep the caption: an illustrative drawing with approximate regions, not pixel-precise or certified CEDEX locations.
