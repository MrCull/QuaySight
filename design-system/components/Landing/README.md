# Landing

The first screen. It replaces the `SetupCard` as what a first visit shows. Designed at 1440×900 in Night quay; it follows the app theme and never sets one.

- **Photo.** The bundled JDLU rear-doors sample fills the right, faded into the page ground on its left and bottom edges (`__shade`). It is decoration: the figure is `aria-hidden`, the image has empty `alt`.
- **Outlines.** The areas read from the photo are outlined (`__box`): owner code, serial and check digit (captioned *Owner*, *Serial*, *Check*), the size/type code, the four weight lines and the Super heavy marking. All are solid and in `brand`, with a light tint, a thin `landing-halo` and a soft `landing-glow` (dark halo and teal glow in Night quay; white halo and pale glow in Daylight, where navy alone would vanish into the steel). The captions sit on the same halo. Certainty is carried by the chips, never by the outlines.
- **Reading cards.** A column of five glass cards (`__panel`, `__card`) between the copy and the photo, 22.75rem wide (the Marking card's one-line value needs it). Fixed content:

  | # | Card | Value | Certainty |
  |---|------|-------|-----------|
  | 01 | Container ID | `qs-id qs-id--md` *JDLU 200 690* with the check digit *2* boxed, and `qs-prov qs-prov--calculated` *Check digit valid* | Confident |
  | 02 | Size and type | *22G1* — *20 ft general purpose* | Confident |
  | 03 | Weights | Max gross *32,500 kg*, Tare *2,180 kg*, Payload *30,320 kg*, Cubic capacity *33.2 m³* | Likely (one chip for the card) |
  | 04 | Marking | *Super heavy* — *No DG placard visible* | Confident |
  | 05 | Seal | *Not in this photo* | Not seen |

  The chips, the ID and the provenance tag are the design-system components, never re-coloured. The cards are real text.
- **Leader lines.** One `<svg class="qs-landing__links" aria-hidden="true">` over the page. Each reading (`[data-row]`: a card, or a weight row) is joined to its first outline (`[data-box]` with the same key) by an elbow path: from its card's right edge level with the reading, out, down or up, then across to the outline's left edge at mid-height. Each path is drawn twice, over a wider `__halo` path, so it reads on the steel. Lines that climb turn further out the lower they start, and lines that drop turn further out the higher they start, so no line crosses another or a card. Seal has no line. The app measures the laid-out elements on mount and on resize; there are no stored coordinates for the lines.
- **Copy, left.** The brand (`__brand`: the 46px logo mark in `brand` and *Quay Sight*). One `h1`, two lines: *The whole **Quay**, / in **Sight**.* with the two words in `brand` (`<em>`). The sub line *To OCR, and beyond…* (`__sub`).
- **Field.** The provider choice (a radio group, one option per catalogue provider), the key (`type="password"`, mono) and **Start**, in one pill: `landing-ink` ground with `landing-on-ink` text, the chosen provider inverted, Start in `brand`. Each provider's recommended model is used; the `SettingsChip` on the inspection screen changes it. When the copy column is short of room (below about 1400px wide) the provider choice takes its own line.
- **Start** never looks switched off. Without a key it carries `aria-disabled`, moves focus to the key field and shows *Paste your API key to start.* (`__hint`). A key with the wrong prefix shows the key-format advice in the same place and can still start.
- **Key note** under the field (`__note`): *Never stored. Your key lives in this tab and goes only to your provider.*
- **Demo label** (`__patch`): a light label rotated about −2°, well below the key note: ***No key to hand?** Open a sample container and see what it read. No charge.* with **Try the demo** (`__demo`, demo mode, no key).
- There is no top bar on this screen, so there is no theme toggle; the remembered theme applies. The build stamp stays at the foot. No spend cap, no CSC plate, no caption under the photo.
- **Motion.** The photo fades in, outlines settle, cards rise and lines draw, once. Under `prefers-reduced-motion` (or `qs-reduced-motion`) every animation and transition on the landing is off, hover included.
- **Focus.** Tab order: the provider group, the key, Start, Try the demo. Each takes the standard 2px `focus-ring` outline, offset 2px (the key draws it round the whole pill). The provider options, Start and Try the demo also get a band of `landing-bg` between the control and the ring, so the ring shows on the light pill and label in Night quay and on the dark pill and label in Daylight.
- **Very wide screens.** The photo and cards stay right; the copy and the brand move right too (`--copy-x`) so the copy stays about 8rem from the cards rather than drifting to the far left.
- **Short screens.** The landing is a grid that grows with the copy, so at 1280×720 the page scrolls a little rather than the demo label running into the build stamp. Between 1200 and 1280px wide the photo is narrowed (`--pw` is capped) so the cards never crowd the copy.
- **Narrow screens** (1200px and below). One column in normal flow: brand, headline, sub line, field, key note, demo label, then the photo, then the cards. The photo is cropped to the band holding every outline (x 40–100%, y 20–68% of the photo) inside a rounded figure; `__plate` inside it is the whole photo, so the outlines keep their places. No shade and no leader lines (the app skips measuring). The field wraps: provider choice on one row, key and Start (52px) on the next. The headline scales with `clamp()`, the demo label keeps its tilt inside the column, and a card's gloss may drop to its own line. From 832px the photo and the cards sit side by side under the copy.

## Placing the photo and outlines

The landing is a size container. The app sets `--h` on `__stage` to the landing's measured height; the photo is hung so that its band from 22% to 66% fills that height:

- `--pw` the photo's width, `calc(var(--h) / 0.48 * 0.75)` but capped so the copy keeps its room, and `--ph: calc(var(--pw) / 0.75)` its height (it keeps the 3:4 aspect),
- `--pl`, `--pt` its left and top, and `--list` the cards' left edge, all derived from the same numbers.

Each outline sits inside the figure in percentages of the 1080×1440 photo: `left: x0/1080`, `top: y0/1440`, `width: (x1−x0)/1080`, `height: (y1−y0)/1440`. The app keeps the boxes and the readings in `src/components/landingReadings.ts`.

## Markup

```html
<main class="qs-landing">
  <div class="qs-landing__stage" style="--h: 844px">
    <figure class="qs-landing__photo" aria-hidden="true">
      <div class="qs-landing__plate">
        <img src="…/jdlu-200690-1-rear-doors.jpg" alt="">
        <i class="qs-landing__box" data-box="id" style="--i: 0; left: 59.259%; top: 25.556%; width: 7.778%; height: 3.542%"><b>Owner</b></i>
        …
      </div>
    </figure>
    <i class="qs-landing__shade" aria-hidden="true"></i>
    <p class="qs-landing__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
    <section class="qs-landing__lead">
      <h1 class="qs-landing__title">The whole <em>Quay</em>, <br>in <em>Sight</em>.</h1>
      <p class="qs-landing__sub">To OCR, and beyond…</p>
      <form class="qs-landing__field">
        <div class="qs-landing__pick" role="radiogroup" aria-label="AI provider">
          <button type="button" role="radio" class="qs-landing__opt" aria-checked="true">OpenRouter</button>
          <button type="button" role="radio" class="qs-landing__opt" aria-checked="false" tabindex="-1">OpenAI</button>
        </div>
        <input class="qs-landing__key" type="password" placeholder="API key" aria-label="OpenRouter API key">
        <button type="button" class="qs-landing__go">Start <svg>…</svg></button>
      </form>
      <p class="qs-landing__hint" role="status">Paste your API key to start.</p>
      <p class="qs-landing__note">Never stored. Your key lives in this tab and goes only to your provider.</p>
      <div class="qs-landing__patch">
        <p><b>No key to hand?</b> Open a sample container and see what it read. No charge.</p>
        <button type="button" class="qs-landing__demo">Try the demo <svg>…</svg></button>
      </div>
    </section>
    <svg class="qs-landing__links" aria-hidden="true">
      <g class="qs-landing__link" style="--i: 0"><path class="qs-landing__halo" pathLength="1" d="M… H… V… H…"/><path pathLength="1" d="M… H… V… H…"/><circle r="4" cx="…" cy="…"/></g>
    </svg>
    <section class="qs-landing__panel" aria-label="Read from a sample photo">
      <div class="qs-landing__card qs-landing__card--id" data-row="id">
        <span class="qs-landing__k"><b>01</b>Container ID</span>
        <span class="qs-id qs-id--md" role="img" aria-label="J D L U, 2 0 0, 6 9 0, check digit 2">…</span>
        <span class="qs-landing__meta"><span class="qs-cert qs-cert--confident">…</span><span class="qs-prov qs-prov--calculated">Check digit valid</span></span>
      </div>
      <div class="qs-landing__card" data-row="type">
        <span class="qs-landing__k"><b>02</b>Size and type</span>
        <span class="qs-landing__v qs-landing__v--code">22G1 <small>20 ft general purpose</small></span>
        <span class="qs-cert qs-cert--confident">…</span>
      </div>
      <div class="qs-landing__card qs-landing__card--weights">
        <span class="qs-landing__k"><b>03</b>Weights</span>
        <span class="qs-cert qs-cert--likely">…</span>
        <dl><div data-row="gross"><dt>Max gross</dt><dd>32,500 kg</dd></div>…</dl>
      </div>
      …
    </section>
  </div>
</main>
```

`preview.html` shows the whole screen, with a small script standing in for the app's measuring.

## Tokens

The landing has its own ground and ink: `landing-bg`, `landing-ink`, `landing-ink-muted`, `landing-on-ink`, `landing-halo`, `landing-glow`, `shadow-landing`, `shadow-landing-chip`, and the `font-hero` family (Bricolage Grotesque) for the headline and the brand. Use them nowhere else, and never as a status. `brand` marks the outlines, the leader lines, the headline's two words, the card numbers and Start; it is never a certainty. Tints are `color-mix()` on these tokens.
