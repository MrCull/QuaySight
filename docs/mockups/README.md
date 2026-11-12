# Result-screen mock-ups: three visual directions

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
