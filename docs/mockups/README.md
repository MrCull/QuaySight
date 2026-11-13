# Result-screen mock-ups

Static pages, not app code. Open the `.html` files in a browser from the repo; each has a `.png` capture at 1440px.

## Round 2: five directions (desktop only)

Brief from the owner after round 1: keep the door face drawn with the readings on it, keep a 3D-style damage view, desktop only, and do not point back at the photographs for the ID, seal or other writing.

| Direction | Page | In one line |
| --- | --- | --- |
| 1. Atlas | `v2-1-atlas.html` | Bright, quiet, centred. The door in marine blue is the only colour. |
| 2. Nocturne | `v2-2-nocturne.html` | Dark glass dashboard, graphite door, one teal light. Everything on one screen. |
| 3. Blueprint | `v2-3-blueprint.html` | An engineering drawing sheet: line work on deep blue, elevation, two views, schedule of findings. |
| 4. Cobalt | `v2-4-cobalt.html` | Printed-report elegance: porcelain white, one cobalt ink, a serif for the big words, summary column on the left. |
| 5. Signal | `v2-5-signal.html` | Black and white, hard grid, very large type; the door in bare steel on a black band. |

All five share two new drawings (`v2.js`, styled by `v2.css`, coloured per page through CSS variables):

- **Door face**: frame, corner castings, two pressed leaves, four lock rods with keepers, guides and handles, hinges, the painted ID with boxed check digit, size and type, the weights decal, the placard, the bolt seal and the CSC plate. Each reading is called out beside the door with its certainty; leaders never cross.
- **3D container**: an end, a long side and the roof, with corrugation, rails, corner castings, fork pockets, five numbered sections, the roof hatched when it was not photographed, damage areas and numbered pins. Two views: door end with right side, blank end with left side.

The photographs appear only as a small strip of what was inspected.

## Round 1: three directions (superseded)

Static pages, not app code. Each shows the same five-photo inspection (JDLU 200690 2) so the directions can be compared like for like. Open the `.html` files in a browser from the repo; the `.png` files are captures at 1440px and 390px.

| Direction | Page | Desktop | Phone |
| --- | --- | --- | --- |
| A. Night console | `direction-a-console.html` | `direction-a-console.png` | `direction-a-console-phone.png` |
| B. Door markings | `direction-b-door-markings.html` | `direction-b-door-markings.png` | `direction-b-door-markings-phone.png` |
| C. Bright tiles | `direction-c-bento.html` | `direction-c-bento.png` | `direction-c-bento-phone.png` |

- **A. Night console.** Dark, one screen, no page scroll on desktop. The photo is the stage with readings and findings called out from it; the container is unfolded flat along the bottom; one inspector column on the right.
- **B. Door markings.** A steel-blue band laid out like a real container door: stencilled ID with boxed check digit, size and type beneath, the weights decal in kg and lb. Photos sit over the band's edge like prints; Damage and Readings follow as plain report sections.
- **C. Bright tiles.** Light and friendly. A few large borderless tiles of different sizes; the ID is the one dark tile and each other tile answers one question in big type.

Shared by all three (`mock.css`, `mock.js`):

- A new flat container drawing: door end, right side, blank end and left side unfolded, with lock rods, corrugation, five numbered sections a side, damage areas and numbered pins.
- Certainty as one glyph whose fill says how sure, plus the fixed word. Certainty, damage and hazard keep separate colours; nothing is green.

The ID, size and type, weights and seal number are what is painted in the photos. Outlines, pins, the six findings and their wording are placed by hand. Fonts and colours here are proposals: none of them are in `design-system/tokens.json` yet.
