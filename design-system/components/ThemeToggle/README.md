# ThemeToggle

Switches the whole page between **Night quay** (dark, the default) and **Daylight** (light). It is a display setting, nothing more.

## Consumer provides
- One `button.qs-btn.qs-btn--secondary.qs-btn--sm.qs-btn--icon.qs-themetoggle` (`type="button"`), last in the top bar's right-hand zone, so it sits in the top-right corner on every view, including the setup card. On phones it stays on the first row, after *New inspection* when that shows.
- An `<i class="qs-glyph">` showing the theme a press switches to: `qs-glyph--sun` in Night quay, `qs-glyph--moon` in Daylight.
- `aria-label` and `title` that say it in words: *Switch to light theme* / *Switch to dark theme*.

## Behaviour
- Starts on Night quay. The choice sets `data-theme` on `<html>` and is remembered in this browser (browser storage, a per-viewer convenience). The page applies the remembered theme before its first paint, so Daylight users see no dark flash.
- A browser that blocks storage still works: it starts on Night quay and forgets on reload.
- Nothing animates; the tokens swap in place.

## Rules
- Neutral secondary button. Never a certainty, severity or hazard colour.
- No word label in the top bar; the glyph plus the accessible name is enough.
