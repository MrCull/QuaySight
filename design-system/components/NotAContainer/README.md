# NotAContainer

The screen for an inspection where **every** photo is something other than a container. It replaces the photo strip and the results. It is the one place in Quay Sight that jokes: someone who uploads a non-container is usually testing the app, so the screen plays along, then sends them back to a real container.

If even one photo shows a container, the normal results show instead, and each non-container photo is dropped as usual ("Photo N doesn't show a container").

The model can only say a photo is *not a container*. It never says what the photo shows, so nothing on this screen names the subject.

## Consumer provides
- `section.qs-nac` with `--cols` (the photo count, at most 3: photo columns on a phone) and `--rest` (the count less one, at least 1: the columns under the first photo on a wide screen) set inline. Add `data-several` when there is more than one photo. Label it with a visually hidden `h2.qs-nac__title`.
- `div.qs-nac__photos`: one `figure.qs-nac__photo` per photo, holding the `img`, a `span.qs-nac__num` (several photos only) and a `span.qs-nac__stamp` with `--i` set to its position. Stamps read **REJECTED**, then **REJECTED**, **ALSO NO**, **STILL NO**, **NOPE** for photos 2 to 5. With several photos, a `p.qs-nac__tally` follows: *3 photos · 0 containers · 3 rejections*.
- `div.qs-nac__side`, in this order:
  1. A `div.qs-nac__tile` with the Container ID: `span.qs-nac__label` *Container ID*, a Confident `CertaintyChip`, the made-up ID **TROL 000006 7** in `ContainerId` markup, and `span.qs-nac__tag`s *Owner: TROL*, *Registered: just now* (or *twice*, *three times*…) and *6-7*.
  2. A `div.qs-nac__tile.qs-nac__ach`: the badge (`svg.qs-nac__badge`, the logo mark in a hexagon), *Achievement unlocked*, **Wannabe QA** (several: **Wannabe QA x3** with the `span.qs-nac__combo` sticker *COMBO x3*), the caption, the level line and `+N XP` over `div.qs-nac__xp` (`--xp` is 5% per photo).
  3. A `div.qs-nac__next`: a locked `span.qs-nac__lock`, **Next up: Banana skin** and, in `span.qs-nac__mock` (the troll font), the mocking-case line: *wHaT aRe YoU gOiNg To Do NeXt, A bAnAnA sKiN?* (several: *fIvE pHoToS oF bAnAnA sKiNs?*; five: *the limit is five*). Give it an `aria-label` with the plain sentence.
  4. `button.qs-btn.qs-btn--primary.qs-btn--lg.qs-nac__respawn`: **Respawn with a real container**. It does what New inspection does.
- `p.qs-nac__egg` (`aria-hidden`): *↑ ↑ ↓ ↓ ← → ← → B A also does nothing*.

## The banana skin Easter egg
The survey asks one extra yes/no question of every photo: does it show a banana or a banana skin? It counts only on a photo that is not a container. When any photo of the screen has one, add `qs-nac--banana` and the screen turns gold (`banana-fg`, `banana-bg`, never the troll red):
- the banana photos' stamps read **A-PEEL DENIED** (`span.qs-nac__stamp.qs-nac__stamp--banana`); other photos keep theirs;
- `p.qs-nac__taunt` under the photos: *oKaY yOu AcTuAlLy DiD iT* (with the plain sentence as `aria-label`);
- the ID is **PEEL 000006 7**, tagged *Owner: PEEL*, *Potassium: high*, *Slip risk: Confident*;
- the achievement shows `span.qs-nac__rarity` **Legendary** in place of *Achievement unlocked*, a banana in the badge (`g.qs-nac__peel`), **Banana skin**, *We dared you. You did it. We regret everything.*, *Level 2 · Banana pro* and a full bar at **+10 XP**;
- Next up is **An actual container**, *The final boss. Nobody has beaten it.*, in plain text;
- the button reads **Slip back to a real container**, and the egg *this screen is bananas. no containers were harmed.*

Checked live on Jev (13 Nov 2026): four banana and banana-skin photos answered yes (0.96 where shown), a photo of a car 0.02.

## Its own rules
This screen is allowed things the rest of the system is not: mocking case, a question mark and exclamation tone, the troll font (`font-troll`, Comic Neue) and the troll red (`troll-fg`, `troll-bg`). They stay on this screen. The troll red is never an error, a finding or a certainty colour, and the Confident chip on the made-up ID is part of the joke: the ID never reaches an export.

## Arrival
Under `.qs-arrived` each stamp thunks down in turn (`qs-stamp`, 160ms apart), and the tiles rise with `qs-rise`. Under reduced motion it all simply appears.

## Layout
Stacked on a phone: photos, then the tiles. From 960px the photos lead on the left (the first one large, the rest in a row beneath it) and the tiles sit on the right.
