# Jev cannot place a seal number

Checked live on 13 November 2026: Jev latest through OpenRouter, resolved `typesafe/jev-1.14-20261014`. One five-photo inspection of RWTU 990633 1: a long side with the doors open, a corner, the rear doors, the front end, and a phone screenshot of a bolt-seal close-up (seal 0154620, two yellow tags, black bars above and below). No recording was kept.

The question: can the seal's close-up in the readings show just the number, rather than the whole seal photo?

## Findings

- **Box on the zoomed seal read.** The `seal_box` question was added to the zoomed seal read (`seal-zoom`) for one run. On the seal photo's zoomed view Jev returned `{top 0.04, bottom 0.97, left 0.04, right 0.96}`: the whole crop, at confidence **0.02**. The same question on the zooms of photos 1, 2 and 4 (no seal there) returned boxes at confidence 0.20, 0.07 and 0.22. All fall below the app's 0.5 (`USABLE_BOX_CONFIDENCE`), so none could frame a close-up. The question was removed again.
- **Numbered regions.** On the seal photo the regions step chose mark 21 (the middle of the photo: the rod and the bolt) for the seal, at probability 0.26, with mark 2 at 0.20 and `none` at 0.21. Its area is a quarter of the photo each way and cut the seal in half, which is why a seal close-up photo is now shown whole (`closeUpSources.ts`).
- **Seal zooms where there is no seal.** The regions step named a seal area on photos 1, 2 and 4, so a zoomed seal read was sent for each (about $0.0007 each). None found a seal number there.
- **Reading.** The number itself was read right, Confident on every character, from the seal photo.

## What this means

With Jev today the app cannot frame the seal number on its own. A seal read from a seal close-up photo shows that whole photo, where the number is readable. A finer location would need another approach (for example a second numbered grid on the zoomed view), and the regions result above suggests Jev's placement is weak there too; test it live before building it.
