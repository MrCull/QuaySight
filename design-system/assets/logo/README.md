# Logo

The Quay Sight mark is the **corner casting**: the cast steel corner every container is lifted and locked by, with its oval aperture read as an eye. Freight, and looking.

| File | Use |
| --- | --- |
| `quay-sight-mark.svg` | The mark in `brand` teal for light grounds (Daylight), `#007f7a`. |
| `quay-sight-mark-on-dark.svg` | The mark in `brand` teal for dark grounds (Night quay), `#2ed3c6`. |
| `quay-sight-mark-black.svg` | One-colour `ink` (`#0f1722`) for print and single-colour use on light grounds. |
| `quay-sight-mark-white.svg` | One-colour white for photos and dark single-colour use. |
| `quay-sight-app-icon.svg` | The mark in white on a rounded `brand` tile: home-screen and app icons. |
| `favicon.svg` | Browser-tab icon; switches between the two teals with the browser's colour scheme. |

In the interface, use the `.qs-logo` class from `components/bundle.css` instead of these files: it is the same mark as a mask in `currentColor`, `brand` by default (`.qs-logo--ink` for ink, `--sm` 20px, `--lg` 64px). `.qs-brand` sets the mark beside the name.

## Rules
- The lockup is the mark followed by "Quay Sight" in Barlow Condensed 600, with `space-2` between them at 28px; the mark is about 1.15 times the cap height.
- Keep clear space of a quarter of the mark's width on every side. Smallest size 16px.
- One colour only: `brand`, `ink` or white, and `on-brand` inside a `brand` tile. Never green, a gradient, or a certainty, severity or hazard colour. Don't outline, rotate, stretch or add effects.
