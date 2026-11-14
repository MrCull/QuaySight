# Landing

The first screen. It replaces the `SetupCard` as what a first visit shows. Designed at 1440×900 in Night quay; it follows the app theme and never sets one.

- **Photo.** The bundled JDLU rear-doors sample fills the right, faded into the page ground on its left and bottom edges (`__shade`). It is decoration: the figure is `aria-hidden`, the image has empty `alt`.
- **Outlines.** The areas read from the photo are outlined (`__box`): owner code, serial and check digit (captioned *Owner*, *Serial*, *Check*), the size/type code, the four weight lines and the Super heavy marking. All are solid and in `brand`, with a light tint, a dark halo and a soft glow. Certainty is carried by the chips, never by the outlines.
- **Reading cards.** A column of five glass cards (`__panel`, `__card`) between the copy and the photo, about 21.5rem wide. Fixed content:

  | # | Card | Value | Certainty |
  |---|------|-------|-----------|
  | 01 | Container ID | `qs-id qs-id--md` *JDLU 200 690* with the check digit *2* boxed, and `qs-prov qs-prov--calculated` *Check digit valid* | Confident |
  | 02 | Size and type | *22G1* — *20 ft general purpose* | Confident |
  | 03 | Weights | Max gross *32,500 kg*, Tare *2,180 kg*, Payload *30,320 kg*, Cubic capacity *33.2 m³* | Likely (one chip for the card) |
  | 04 | Marking | *Super heavy* — *No DG placard visible* | Confident |
  | 05 | Seal | *Not in this photo* | Not seen |

  The chips, the ID and the provenance tag are the design-system components, never re-coloured. The cards are real text.
- **Leader lines.** One `<svg class="qs-landing__links" aria-hidden="true">` over the page. Each reading (`[data-row]`: a card, or a weight row) is joined to its first outline (`[data-box]` with the same key) by an elbow path: from the panel's right edge level with the reading, out, down or up, then across to the outline's left edge at mid-height. Seal has no line. The app measures the laid-out elements on mount and on resize; there are no stored coordinates for the lines.
- **Copy, left.** The brand (`__brand`: the 46px logo mark in `brand` and *Quay Sight*). One `h1`, two lines: *The whole **Quay**, / in **Sight**.* with the two words in `brand` (`<em>`). The sub line *To OCR, and beyond…* (`__sub`).
- **Field.** The provider choice (a radio group, one option per catalogue provider), the key (`type="password"`, mono) and **Start**, in one pill: `landing-ink` ground with `landing-on-ink` text, the chosen provider inverted, Start in `brand`. Each provider's recommended model is used; the `SettingsChip` on the inspection screen changes it. When the copy column is short of room (below about 1400px wide) the provider choice takes its own line.
- **Start** never looks switched off. Without a key it carries `aria-disabled`, moves focus to the key field and shows *Paste your API key to start.* (`__hint`). A key with the wrong prefix shows the key-format advice in the same place and can still start.
- **Key note** under the field (`__note`): *Never stored. Your key lives in this tab and goes only to your provider.*
- **Demo label** (`__patch`): a light label rotated about −2°, well below the key note: ***No key to hand?** Open a sample container and see what it read. No charge.* with **Try the demo** (`__demo`, demo mode, no key).
- There is no top bar on this screen, so there is no theme toggle; the remembered theme applies. The build stamp stays at the foot. No spend cap, no CSC plate, no caption under the photo.
- **Motion.** The photo fades in, outlines settle, cards rise and lines draw, once. All of it stops under reduced motion.
- **Narrow screens** (below 1000px) stack the copy, then the cards, with no photo and no lines (to be finished in a later ticket).

## Placing the photo and outlines

The landing is a size container. The app sets `--h` on `__stage` to the landing's measured height; the photo is hung so that its band from 22% to 66% fills that height:

- `--ph: calc(var(--h) / 0.48)` the photo's height, `--pw: calc(var(--ph) * 0.75)` its width (it keeps the 3:4 aspect),
- `--pl`, `--pt` its left and top, and `--list` the cards' left edge, all derived from the same numbers.

Each outline sits inside the figure in percentages of the 1080×1440 photo: `left: x0/1080`, `top: y0/1440`, `width: (x1−x0)/1080`, `height: (y1−y0)/1440`. The app keeps the boxes and the readings in `src/components/landingReadings.ts`.

## Markup

```html
<main class="qs-landing">
  <div class="qs-landing__stage" style="--h: 844px">
    <figure class="qs-landing__photo" aria-hidden="true">
      <img src="…/jdlu-200690-1-rear-doors.jpg" alt="">
      <i class="qs-landing__box" data-box="id" style="--i: 0; left: 59.259%; top: 25.556%; width: 7.778%; height: 3.542%"><b>Owner</b></i>
      …
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
      <g class="qs-landing__link" style="--i: 0"><path pathLength="1" d="M… H… V… H…"/><circle r="4" cx="…" cy="…"/></g>
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

The landing has its own ground and ink: `landing-bg`, `landing-surface`, `landing-ink`, `landing-ink-muted`, `landing-on-ink`, `shadow-landing`, `shadow-landing-chip`, and the `font-hero` family (Bricolage Grotesque) for the headline and the brand. Use them nowhere else, and never as a status. `brand` marks the outlines, the leader lines, the headline's two words, the card numbers and Start; it is never a certainty. Tints are `color-mix()` on these tokens.
