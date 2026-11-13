# Jev cannot place a seal number

Checked live on 13 November 2026: Jev latest through OpenRouter, resolved `typesafe/jev-1.14-20261014`. One five-photo inspection of RWTU 990633 1: a long side with the doors open, a corner, the rear doors, the front end, and a phone screenshot of a bolt-seal close-up (seal 0154620, two yellow tags, black bars above and below). No recording was kept.

The question: can the seal's close-up in the readings show just the number, rather than the whole seal photo?

## Findings

- **Box on the zoomed seal read.** The `seal_box` question was added to the zoomed seal read (`seal-zoom`) for one run. On the seal photo's zoomed view Jev returned `{top 0.04, bottom 0.97, left 0.04, right 0.96}`: the whole crop, at confidence **0.02**. The same question on the zooms of photos 1, 2 and 4 (no seal there) returned boxes at confidence 0.20, 0.07 and 0.22. All fall below the app's 0.5 (`USABLE_BOX_CONFIDENCE`), so none could frame a close-up. The question was removed again.
- **Numbered regions.** On the seal photo the regions step chose mark 21 (the middle of the photo: the rod and the bolt) for the seal, at probability 0.26, with mark 2 at 0.20 and `none` at 0.21. Its area is a quarter of the photo each way and cut the seal in half, which is why a seal close-up photo is now shown whole (`closeUpSources.ts`).
- **Seal zooms where there is no seal.** The regions step named a seal area on photos 1, 2 and 4, so a zoomed seal read was sent for each (about $0.0007 each). None found a seal number there.
- **Reading.** The number itself was read right, Confident on every character, from the seal photo.

- **The container ID's own box.** On the same run (and a repeat), Jev's `container_box` was usable only on the rear-door photo: `{top 0.25, bottom 0.35, left 0.59 to 0.62, right 0.79}` at confidence 0.50 to 0.52, inside the grid area the regions step chose (mark 19). On the other photos it was 0.12 to 0.24 and misplaced. The grid area alone cut the first letters off (`TU 990633`); the box with a 0.35 margin framed `RWTU 990633 1` and `25G1` whole. The app now frames the ID with the model's box only where it lies inside the found area, and otherwise shows the area with the zoomed read's 0.25 margin.
- **The ISO code's grid area** on a photo other than the ID's landed on a long side's logo. The ISO close-up is left out when the ID close-up's photo also read the code.

## Reading parts of the photo instead (same day)

Jev reads well where it places badly, so the place can be found by reading. Each part is a crop sent with the usual questions (the seal number, or the ISO size/type code alone).

- **ISO code, rear-door photo.** Of four overlapping quarter tiles, only the one holding the code read `25G1` (probability 1.00); the other three answered `not_visible` at 0.93 to 0.99. Starting from the ID's grid area grown by 0.25, two rounds of cutting each side back by a quarter (four parts a round, every cut that still read `25G1` kept) ended on `{left 0.656, top 0.203, right 0.797, bottom 0.344}`: the code, with the end of the ID above it.
- **Seal, close-up photo.** Square tiles cut the number at their edges (`015462?`, `46220`). Three overlapping bands across the photo (0 to 0.4, 0.3 to 0.7, 0.6 to 1) found the top and bottom tags (the middle band, the rod, read nothing). Jev read `01546220` in a band, one character more than the number: a part counts when its reading is within one character of the photo's number and Likely or better. Three rounds of cuts on the top band ended on the tag itself, `SEALED 0154620`, with little else.
- **In the app** (a five-photo run): 19 more requests (11 for the seal: 3 bands and two rounds; 8 for the ISO code), 46 requests in all against the cap of 50, about $0.008 more ($0.0287 for the inspection). The searches start only after every other request for their photo has settled.

## What this means

With Jev today neither its boxes nor the numbered regions can frame the seal number; reading parts of the photo can (above), and the app now does that. A seal read from a seal close-up photo shows that whole photo, where the number is readable. A finer location would need another approach (for example a second numbered grid on the zoomed view), and the regions result above suggests Jev's placement is weak there too; test it live before building it.
