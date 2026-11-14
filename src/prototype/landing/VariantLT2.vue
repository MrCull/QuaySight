<script setup lang="ts">
// PROTOTYPE variant LT2, "Light pointers, big photo": the LT1 parts rearranged so the photo is bigger. Brand,
// headline, subheading and key field stand in a left column; the photo runs tall on the right with all the
// cards in one column beside it. "Quay" and "Sight" take the brand colour.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const LEVELS = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen'] as const

// Each painted item, as a rectangle in the photo's own pixels (1080 × 1440), measured on the picture.
const W = 1080
const H = 1440
const BOXES = [
  { key: 'owner', link: 'id', at: [642, 370, 721, 418] },
  { key: 'serial', link: 'id', at: [765, 390, 870, 443] },
  { key: 'check', link: 'id', at: [873, 405, 904, 449] },
  { key: 'type', link: 'type', at: [755, 446, 831, 485] },
  { key: 'gross', link: 'weights', at: [612, 526, 838, 566] },
  { key: 'tare', link: 'weights', at: [618, 568, 848, 610] },
  { key: 'payload', link: 'weights', at: [614, 625, 847, 664] },
  { key: 'cube', link: 'weights', at: [621, 674, 870, 716] },
  { key: 'marking', link: 'marking', at: [802, 797, 890, 892] },
].map((b, i) => {
  const [x0, y0, x1, y1] = b.at as [number, number, number, number]
  return {
    ...b,
    i,
    style: `--i: ${i}; left: ${(x0 / W) * 100}%; top: ${(y0 / H) * 100}%; width: ${((x1 - x0) / W) * 100}%; height: ${((y1 - y0) / H) * 100}%`,
  }
})

// Connectors from each item (or stack of rows) to its card, measured from the laid-out elements.
const LINKS = ['id', 'type', 'weights', 'marking'] as const
const stage = useTemplateRef<HTMLElement>('stage')
const paths = ref<{ key: string; d: string; x: number; y: number }[]>([])
function measure() {
  const root = stage.value
  if (!root) return
  const origin = root.getBoundingClientRect()
  const photo = root.querySelector('.lt2__photo')!.getBoundingClientRect()
  paths.value = LINKS.map((key, n) => {
    const rects = [...root.querySelectorAll(`[data-link="${key}"]`)].map((el) =>
      el.getBoundingClientRect(),
    )
    const card = root.querySelector(`.lt2__card--${key}`)!.getBoundingClientRect()
    const mids = rects.map((r) => r.top + r.height / 2 - origin.top)
    const stacked = key === 'weights'
    const right = Math.max(...rects.map((r) => r.right)) - origin.left
    const last = rects[rects.length - 1]!
    // A stack of rows is gathered on a short spine; a row of parts leaves from its last part.
    const spine = right + 7
    const y0 = stacked
      ? (mids[0]! + mids[mids.length - 1]!) / 2
      : last.top + last.height / 2 - origin.top
    const x0 = stacked ? spine : last.right - origin.left
    const x1 = card.left - origin.left
    const y1 = Math.min(Math.max(y0, card.top - origin.top + 18), card.bottom - origin.top - 18)
    const bend = photo.right - origin.left + 12 + n * 7
    const ticks = stacked
      ? rects.map((r, k) => `M${r.right - origin.left} ${mids[k]}H${spine}`).join('') +
        `M${spine} ${mids[0]}V${mids[mids.length - 1]}`
      : ''
    return { key, d: `${ticks}M${x0} ${y0}H${bend}V${y1}H${x1}`, x: x1, y: y1 }
  })
}
let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && stage.value) {
    observer = new ResizeObserver(measure)
    observer.observe(stage.value)
  }
  void document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main class="lt2">
    <section class="lt2__copy">
      <p class="lt2__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <div class="lt2__lead">
        <p class="lt2__kicker">Container inspection from photos</p>
        <h1 class="lt2__title">The whole <em>Quay</em>,<br />in <em>Sight</em>.</h1>
        <p class="lt2__sub">
          It reads the doors, checks the sums, maps the dents, and never pretends to be sure.
        </p>
        <ProtoKeyField />
      </div>
      <div class="lt2__legend">
        <p>Each reading carries one of five certainties</p>
        <ul>
          <li v-for="level in LEVELS" :key="level"><CertaintyChip :level="level" /></li>
        </ul>
      </div>
    </section>

    <section ref="stage" class="lt2__stage" aria-label="A sample photo with its readings">
      <figure class="lt2__photo">
        <div class="lt2__frame">
          <img :src="doors" alt="Rear doors of a blue freight container on a trailer" />
          <i
            v-for="b in BOXES"
            :key="b.key"
            :class="`lt2__box lt2__box--${b.key}`"
            :data-link="b.link"
            :style="b.style"
            aria-hidden="true"
          ></i>
        </div>
        <i class="lt2__sweep" aria-hidden="true"></i>
        <span class="lt2__tag"
          ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded
          reading</span
        >
      </figure>

      <div class="lt2__col">
        <article class="lt2__card lt2__card--id" style="--i: 0">
          <header>
            <h2><i class="qs-glyph qs-glyph--tag" aria-hidden="true"></i>Container ID</h2>
            <CertaintyChip level="Confident" />
          </header>
          <div class="lt2__idrow" aria-label="J D L U, 2 0 0 6 9 0, check digit 2">
            <span class="lt2__part">
              <span class="qs-id lt2__id"
                ><span class="qs-id__group"
                  ><span class="qs-id__ch">J</span><span class="qs-id__ch">D</span
                  ><span class="qs-id__ch">L</span><span class="qs-id__ch">U</span></span
                ></span
              >
              <small>Owner code</small>
            </span>
            <span class="lt2__part">
              <span class="qs-id lt2__id"
                ><span class="qs-id__group"
                  ><span class="qs-id__ch">2</span><span class="qs-id__ch">0</span
                  ><span class="qs-id__ch">0</span></span
                ><span class="qs-id__group"
                  ><span class="qs-id__ch">6</span><span class="qs-id__ch">9</span
                  ><span class="qs-id__ch">0</span></span
                ></span
              >
              <small>Serial</small>
            </span>
            <span class="lt2__part">
              <span class="qs-id lt2__id"><span class="qs-id__check">2</span></span>
              <small>Check</small>
            </span>
          </div>
          <p class="lt2__why">Visible check digit read independently. It agrees with the number.</p>
        </article>
        <article class="lt2__card lt2__card--type" style="--i: 3">
          <header>
            <h2><i class="qs-glyph qs-glyph--container" aria-hidden="true"></i>Size and type</h2>
            <CertaintyChip level="Confident" />
          </header>
          <p class="lt2__value">22G1 <span>20 ft general purpose</span></p>
        </article>
        <article class="lt2__card lt2__card--weights" style="--i: 4">
          <header>
            <h2><i class="qs-glyph qs-glyph--weight" aria-hidden="true"></i>Weights</h2>
            <CertaintyChip level="Confident" />
          </header>
          <dl>
            <div>
              <dt>Max gross</dt>
              <dd>32,500 kg</dd>
            </div>
            <div>
              <dt>Tare</dt>
              <dd>2,180 kg</dd>
            </div>
            <div>
              <dt>Payload</dt>
              <dd>30,320 kg</dd>
            </div>
            <div>
              <dt>Cubic capacity</dt>
              <dd>33.2 m³</dd>
            </div>
          </dl>
        </article>
        <article class="lt2__card lt2__card--marking" style="--i: 8">
          <header>
            <h2>
              <i class="qs-glyph qs-glyph--hazard lt2__diamond" aria-hidden="true"></i>Marking
            </h2>
            <CertaintyChip level="Likely" />
          </header>
          <p class="lt2__value lt2__value--plain">Super heavy <span>No DG placard visible</span></p>
        </article>
        <article class="lt2__card lt2__card--seal" style="--i: 9">
          <header>
            <h2><i class="qs-glyph qs-glyph--padlock" aria-hidden="true"></i>Seal</h2>
            <CertaintyChip level="Not seen" />
          </header>
          <p class="lt2__why">None in view on the handles. A close-up may help.</p>
        </article>
      </div>

      <svg class="lt2__links" aria-hidden="true">
        <g
          v-for="(link, n) in paths"
          :key="link.key"
          :class="`lt2__link lt2__link--${link.key}`"
          :style="`--i: ${n}`"
        >
          <path :d="link.d" />
          <circle :cx="link.x" :cy="link.y" r="3.5" />
        </g>
      </svg>
    </section>
  </main>
</template>

<style scoped>
.lt2 {
  --edge: clamp(var(--space-5), 4vw, calc(var(--space-8) * 1.25));
  --photo-h: clamp(460px, min(calc(100vh - 150px), 44vw), 920px);
  --rule: color-mix(in srgb, var(--landing-ink) 14%, transparent);
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: clamp(var(--space-6), 3.8vw, var(--space-8));
  align-items: center;
  padding: var(--space-5) var(--edge);
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* Words and the key field */
.lt2__copy {
  --lp-align: start;
  --lp-field-width: 100%;
  --lp-field-wrap: wrap;
  --lp-pick-flex: 1 1 100%;
  --lp-opt-flex: 1;
  --lp-field-radius: var(--radius-lg);
  --lp-field-inner-radius: var(--radius-md);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  align-self: stretch;
  max-width: 640px;
}
.lt2__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lt2__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.lt2__lead {
  align-self: center;
  padding-block: var(--space-5);
}
.lt2__kicker {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0 0 var(--space-4);
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lt2__kicker::before {
  content: '';
  width: var(--space-5);
  height: 1.5px;
  background: currentColor;
}
.lt2__title {
  margin: 0;
  font: 700 clamp(2.5rem, 3.8vw, 5rem)/0.96 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.lt2__title em {
  color: var(--brand);
  font-style: normal;
}
.lt2__sub {
  max-width: 30rem;
  margin: var(--space-5) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}

/* Stage: the photo, then the cards */
.lt2__stage {
  position: relative;
  display: flex;
  gap: var(--space-7);
}
.lt2__photo {
  position: relative;
  flex: none;
  width: calc(var(--photo-h) * 0.78);
  height: var(--photo-h);
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-landing);
}
/* The whole 3:4 photo, enlarged and hung so the right door's markings fill the window. The boxes share its
   coordinates, so they stay on the paint at any size. */
.lt2__frame {
  position: absolute;
  left: -47%;
  top: 0;
  width: 150%;
  aspect-ratio: 3 / 4;
  transform: translateY(-14%);
}
.lt2__frame img {
  display: block;
  width: 100%;
  height: 100%;
}
.lt2__tag {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  font: 500 0.75rem/1.25rem var(--font-sans);
  box-shadow: var(--shadow-landing-chip);
}
.lt2__sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.lt2__sweep::after {
  content: '';
  position: absolute;
  inset: -30% 0 auto;
  height: 30%;
  border-bottom: 1px solid color-mix(in srgb, var(--landing-surface) 80%, transparent);
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--landing-surface) 36%, transparent)
  );
  animation: lt2-sweep 1100ms cubic-bezier(0.4, 0, 0.2, 1) 150ms both;
}

/* Each painted item, squared off: outline in the certainty colour, a light keyline inside and out, a tint */
.lt2__box {
  --c: var(--cert-confident-line);
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--c);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--c) 20%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--landing-surface) 90%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--landing-surface) 75%, transparent);
  outline: 1px solid transparent;
  outline-offset: 0;
  animation: lt2-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(900ms + var(--i) * 110ms);
}
.lt2__box--marking {
  --c: var(--cert-likely-line);
}

.lt2__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.lt2__link {
  --c: var(--cert-confident-line);
  animation: lt2-fade var(--duration-arrive) ease-out both;
  animation-delay: calc(1300ms + var(--i) * 160ms);
}
.lt2__link path {
  fill: none;
  stroke: var(--c);
  stroke-width: 1.75;
  stroke-linejoin: round;
}
.lt2__link circle {
  fill: var(--c);
  stroke: var(--landing-bg);
  stroke-width: 2;
}
.lt2__link--marking {
  --c: var(--cert-likely-line);
}

/* Cards */
.lt2__col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-3);
  box-sizing: border-box;
  width: clamp(284px, 20vw, 360px);
  height: var(--photo-h);
}
.lt2__card {
  display: grid;
  gap: var(--space-1);
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--landing-surface);
  box-shadow: var(--shadow-landing);
  animation: lt2-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1000ms + var(--i, 9) * 110ms);
}
.lt2__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.lt2__card h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lt2__diamond {
  color: var(--hazard-fg);
}

/* The ID, set out as it is painted: owner code, serial, check digit in its box */
.lt2__card--id {
  padding-bottom: var(--space-3);
  border-color: color-mix(in srgb, var(--cert-confident-line) 55%, transparent);
}
.lt2__idrow {
  display: flex;
  align-items: flex-start;
  gap: clamp(var(--space-2), 0.9vw, var(--space-4));
  margin-top: var(--space-1);
}
.lt2__part {
  display: grid;
  justify-items: start;
}
.lt2__part small {
  color: var(--landing-ink-muted);
  font: 500 0.625rem/1rem var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lt2__id.qs-id {
  gap: 0.34em;
  color: var(--landing-ink);
  font-size: clamp(1.25rem, 1.8vw, 2rem);
  line-height: 1.3;
}
.lt2__id .qs-id__group {
  gap: 0.06em;
}
.lt2__id .qs-id__ch {
  padding-bottom: 0.2em;
}
.lt2__id .qs-id__check {
  margin-bottom: 0.2em;
  border-width: 2px;
  border-color: var(--landing-ink);
}
.lt2__value {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin: 0;
  font: 500 1.1875rem/1.625rem var(--font-mono);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lt2__value--plain {
  font: 600 1.0625rem/1.625rem var(--font-sans);
  letter-spacing: 0;
}
.lt2__value span,
.lt2__why {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
  letter-spacing: 0;
}
.lt2__card dl {
  display: grid;
  margin: 0;
}
.lt2__card dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.lt2__card dt {
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.lt2__card dd {
  margin: 0;
  font: 500 0.9375rem/1.25rem var(--font-mono);
}

.lt2__legend {
  padding-top: var(--space-4);
  border-top: 1px solid var(--rule);
}
.lt2__legend p {
  margin: 0 0 var(--space-3);
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.lt2__legend ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

@keyframes lt2-sweep {
  to {
    transform: translateY(440%);
    opacity: 0;
  }
}
/* Opacity and outline only: a transform here would throw the connector measurements off. */
@keyframes lt2-box {
  from {
    opacity: 0;
    outline: 1px solid var(--c);
    outline-offset: 10px;
  }
}
@keyframes lt2-fade {
  from {
    opacity: 0;
  }
}
@keyframes lt2-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lt2 *,
  .lt2 *::after {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lt2 {
    --photo-h: min(118vw, 640px);
    grid-template-columns: minmax(0, 1fr);
  }
  .lt2__title {
    white-space: normal;
  }
  .lt2__links,
  .lt2__legend {
    display: none;
  }
  .lt2__stage {
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .lt2__photo {
    width: 100%;
  }
  .lt2__col {
    width: 100%;
    height: auto;
  }
}
</style>
