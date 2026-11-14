<script setup lang="ts">
// PROTOTYPE variant LT3, "Light pointers, live": the LT1 layout with interaction. Pointing at (or focusing) a
// card lights its boxes on the photo and dims the rest, and pointing at a box does the same for its card. On
// load the boxes arrive in reading order with their cards. Plain headline, larger logo mark.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

// The reading being pointed at, if any.
const active = ref<string | null>(null)

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
  const photo = root.querySelector('.lt3__photo')!.getBoundingClientRect()
  paths.value = LINKS.map((key, n) => {
    const rects = [...root.querySelectorAll(`[data-link="${key}"]`)].map((el) =>
      el.getBoundingClientRect(),
    )
    const card = root.querySelector(`.lt3__card--${key}`)!.getBoundingClientRect()
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
  <main class="lt3">
    <header class="lt3__top">
      <p class="lt3__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <p class="lt3__kicker">Container inspection from photos</p>
    </header>

    <section class="lt3__lead">
      <h1 class="lt3__title">The whole Quay,<br />in Sight.</h1>
      <p class="lt3__sub">
        Photograph a container and get an inspection, not a transcript: ID checked, weights read,
        damage mapped, doubt stated.
      </p>
      <ProtoKeyField />
    </section>

    <section
      ref="stage"
      :class="['lt3__stage', { 'lt3__stage--pointing': active }]"
      aria-label="A sample photo with its readings"
    >
      <div class="lt3__col lt3__col--left">
        <div class="lt3__legend">
          <p>Each reading carries one of five certainties</p>
          <ul>
            <li v-for="level in LEVELS" :key="level"><CertaintyChip :level="level" /></li>
          </ul>
        </div>
        <article class="lt3__card lt3__card--seal">
          <header>
            <h2><i class="qs-glyph qs-glyph--padlock" aria-hidden="true"></i>Seal</h2>
            <CertaintyChip level="Not seen" />
          </header>
          <p class="lt3__why">None in view on the handles. A close-up may help.</p>
        </article>
      </div>

      <figure class="lt3__photo">
        <div class="lt3__frame">
          <img :src="doors" alt="Rear doors of a blue freight container on a trailer" />
          <i
            v-for="b in BOXES"
            :key="b.key"
            :class="[`lt3__box lt3__box--${b.key}`, { 'is-on': active === b.link }]"
            :data-link="b.link"
            :style="b.style"
            aria-hidden="true"
            @mouseenter="active = b.link"
            @mouseleave="active = null"
          ></i>
        </div>
        <i class="lt3__sweep" aria-hidden="true"></i>
        <span class="lt3__tag"
          ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded
          reading</span
        >
      </figure>

      <div class="lt3__col lt3__col--right">
        <article
          :class="['lt3__card lt3__card--id', { 'is-on': active === 'id' }]"
          style="--i: 0"
          tabindex="0"
          @mouseenter="active = 'id'"
          @mouseleave="active = null"
          @focus="active = 'id'"
          @blur="active = null"
        >
          <header>
            <h2><i class="qs-glyph qs-glyph--tag" aria-hidden="true"></i>Container ID</h2>
            <CertaintyChip level="Confident" />
          </header>
          <div class="lt3__idrow" aria-label="J D L U, 2 0 0 6 9 0, check digit 2">
            <span class="lt3__part">
              <span class="qs-id lt3__id"
                ><span class="qs-id__group"
                  ><span class="qs-id__ch">J</span><span class="qs-id__ch">D</span
                  ><span class="qs-id__ch">L</span><span class="qs-id__ch">U</span></span
                ></span
              >
              <small>Owner code</small>
            </span>
            <span class="lt3__part">
              <span class="qs-id lt3__id"
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
            <span class="lt3__part">
              <span class="qs-id lt3__id"><span class="qs-id__check">2</span></span>
              <small>Check</small>
            </span>
          </div>
          <p class="lt3__why">Visible check digit read independently. It agrees with the number.</p>
        </article>
        <article
          :class="['lt3__card lt3__card--type', { 'is-on': active === 'type' }]"
          style="--i: 3"
          tabindex="0"
          @mouseenter="active = 'type'"
          @mouseleave="active = null"
          @focus="active = 'type'"
          @blur="active = null"
        >
          <header>
            <h2><i class="qs-glyph qs-glyph--container" aria-hidden="true"></i>Size and type</h2>
            <CertaintyChip level="Confident" />
          </header>
          <p class="lt3__value">22G1 <span>20 ft general purpose</span></p>
        </article>
        <article
          :class="['lt3__card lt3__card--weights', { 'is-on': active === 'weights' }]"
          style="--i: 4"
          tabindex="0"
          @mouseenter="active = 'weights'"
          @mouseleave="active = null"
          @focus="active = 'weights'"
          @blur="active = null"
        >
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
        <article
          :class="['lt3__card lt3__card--marking', { 'is-on': active === 'marking' }]"
          style="--i: 8"
          tabindex="0"
          @mouseenter="active = 'marking'"
          @mouseleave="active = null"
          @focus="active = 'marking'"
          @blur="active = null"
        >
          <header>
            <h2>
              <i class="qs-glyph qs-glyph--hazard lt3__diamond" aria-hidden="true"></i>Marking
            </h2>
            <CertaintyChip level="Likely" />
          </header>
          <p class="lt3__value lt3__value--plain">Super heavy <span>No DG placard visible</span></p>
        </article>
      </div>

      <svg class="lt3__links" aria-hidden="true">
        <g
          v-for="(link, n) in paths"
          :key="link.key"
          :class="[`lt3__link lt3__link--${link.key}`, { 'is-on': active === link.key }]"
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
.lt3 {
  --edge: clamp(var(--space-5), 4vw, calc(var(--space-8) * 1.25));
  --photo-h: clamp(380px, calc(100vh - 432px), 780px);
  --rule: color-mix(in srgb, var(--landing-ink) 14%, transparent);
  flex: 1;
  display: grid;
  grid-template-rows: auto auto 1fr;
  background: var(--landing-bg);
  color: var(--landing-ink);
}

.lt3__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge) 0;
}
.lt3__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2.25rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lt3__brand .qs-logo {
  width: 64px;
  height: 64px;
  color: inherit;
}
.lt3__kicker {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Words and the key field */
.lt3__lead {
  --lp-field-width: 620px;
  display: grid;
  justify-items: center;
  margin-top: calc(var(--space-6) * -1);
  padding: 0 var(--edge) var(--space-4);
  text-align: center;
}
.lt3__title {
  margin: 0;
  font: 700 clamp(2.5rem, 4.3vw, 5.25rem)/0.98 var(--font-hero);
  letter-spacing: -0.05em;
}
.lt3__title u {
  text-decoration: underline;
  text-decoration-color: var(--brand);
  text-decoration-thickness: 0.085em;
  text-underline-offset: 0.11em;
  text-decoration-skip-ink: none;
}
.lt3__sub {
  max-width: 66rem;
  margin: var(--space-4) 0 var(--space-4);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}
.lt3__lead :deep(.lp-key__note) {
  justify-content: center;
  margin-top: var(--space-3);
}

/* Stage: cards, photo, cards */
.lt3__stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: clamp(var(--space-6), 4vw, var(--space-8));
  align-items: end;
  padding: 0 var(--edge);
}
.lt3__photo {
  position: relative;
  width: calc(var(--photo-h) * 1.29);
  height: var(--photo-h);
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-landing);
}
/* The whole 3:4 photo, enlarged and hung so the right door's markings fill the window. The boxes share its
   coordinates, so they stay on the paint at any size. */
.lt3__frame {
  position: absolute;
  left: -40.6%;
  top: 0;
  width: 145%;
  aspect-ratio: 3 / 4;
  transform: translateY(-23.4%);
}
.lt3__frame img {
  display: block;
  width: 100%;
  height: 100%;
}
.lt3__tag {
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
.lt3__sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.lt3__sweep::after {
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
  animation: lt3-sweep 1100ms cubic-bezier(0.4, 0, 0.2, 1) 150ms both;
}

/* Each painted item, squared off: outline in the certainty colour, a light keyline inside and out, a tint */
.lt3__box {
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
  animation: lt3-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(900ms + var(--i) * 110ms);
}
.lt3__box--marking {
  --c: var(--cert-likely-line);
}

.lt3__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.lt3__link {
  --c: var(--cert-confident-line);
  animation: lt3-fade var(--duration-arrive) ease-out both;
  animation-delay: calc(1300ms + var(--i) * 160ms);
}
.lt3__link path {
  fill: none;
  stroke: var(--c);
  stroke-width: 1.75;
  stroke-linejoin: round;
}
.lt3__link circle {
  fill: var(--c);
  stroke: var(--landing-bg);
  stroke-width: 2;
}
.lt3__link--marking {
  --c: var(--cert-likely-line);
}

/* Cards */
.lt3__col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  height: var(--photo-h);
  padding-bottom: var(--space-4);
  box-sizing: border-box;
}
.lt3__col--left {
  align-items: flex-end;
  justify-content: flex-end;
}
.lt3__col--right {
  align-items: flex-start;
}
.lt3__card {
  display: grid;
  gap: var(--space-1);
  box-sizing: border-box;
  width: min(100%, 348px);
  padding: var(--space-2) var(--space-4) var(--space-3);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--landing-surface);
  box-shadow: var(--shadow-landing);
  animation: lt3-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1000ms + var(--i, 9) * 110ms);
}
.lt3__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.lt3__card h2 {
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
.lt3__diamond {
  color: var(--hazard-fg);
}

/* The ID, set out as it is painted: owner code, serial, check digit in its box */
.lt3__card--id {
  padding-bottom: var(--space-3);
  border-color: color-mix(in srgb, var(--cert-confident-line) 55%, transparent);
}
.lt3__idrow {
  display: flex;
  align-items: flex-start;
  gap: clamp(var(--space-2), 0.9vw, var(--space-4));
  margin-top: var(--space-1);
}
.lt3__part {
  display: grid;
  justify-items: start;
}
.lt3__part small {
  color: var(--landing-ink-muted);
  font: 500 0.625rem/1rem var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lt3__id.qs-id {
  gap: 0.34em;
  color: var(--landing-ink);
  font-size: clamp(1.25rem, 1.8vw, 2rem);
  line-height: 1.3;
}
.lt3__id .qs-id__group {
  gap: 0.06em;
}
.lt3__id .qs-id__ch {
  padding-bottom: 0.2em;
}
.lt3__id .qs-id__check {
  margin-bottom: 0.2em;
  border-width: 2px;
  border-color: var(--landing-ink);
}
.lt3__value {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin: 0;
  font: 500 1.1875rem/1.625rem var(--font-mono);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lt3__value--plain {
  font: 600 1.0625rem/1.625rem var(--font-sans);
  letter-spacing: 0;
}
.lt3__value span,
.lt3__why {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
  letter-spacing: 0;
}
.lt3__card dl {
  display: grid;
  margin: 0;
}
.lt3__card dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.lt3__card dt {
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.lt3__card dd {
  margin: 0;
  font: 500 0.9375rem/1.25rem var(--font-mono);
}

.lt3__legend {
  width: min(100%, 348px);
  margin-bottom: auto;
  padding-top: var(--space-2);
}
.lt3__legend p {
  margin: 0 0 var(--space-3);
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.lt3__legend ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Pointing: the reading in hand stays lit, the rest stand back */
.lt3__box {
  cursor: pointer;
  transition:
    opacity var(--duration-base),
    background-color var(--duration-base),
    box-shadow var(--duration-base);
}
.lt3__card,
.lt3__link {
  transition:
    opacity var(--duration-base),
    border-color var(--duration-base),
    translate var(--duration-base);
}
.lt3__card:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.lt3__stage--pointing .lt3__box:not(.is-on),
.lt3__stage--pointing .lt3__link:not(.is-on) {
  opacity: 0.22;
}
.lt3__stage--pointing .lt3__col--right .lt3__card:not(.is-on) {
  opacity: 0.45;
}
.lt3__box.is-on {
  background: color-mix(in srgb, var(--c) 34%, transparent);
  box-shadow:
    0 0 0 1px var(--landing-surface),
    0 0 0 5px color-mix(in srgb, var(--c) 45%, transparent),
    inset 0 0 0 1px var(--landing-surface);
}
.lt3__card.is-on {
  border-color: var(--cert-confident-line);
  translate: calc(var(--space-1) * -1) 0;
}
.lt3__card--marking.is-on {
  border-color: var(--cert-likely-line);
}
.lt3__link.is-on path {
  stroke-width: 2.5;
}

@keyframes lt3-sweep {
  to {
    transform: translateY(440%);
    opacity: 0;
  }
}
/* Opacity and outline only: a transform here would throw the connector measurements off. */
@keyframes lt3-box {
  from {
    opacity: 0;
    outline: 1px solid var(--c);
    outline-offset: 10px;
  }
}
@keyframes lt3-fade {
  from {
    opacity: 0;
  }
}
@keyframes lt3-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lt3 *,
  .lt3 *::after {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 1000px) {
  .lt3 {
    --photo-h: min(74vw, 520px);
  }
  .lt3__lead {
    margin-top: var(--space-4);
  }
  .lt3__kicker,
  .lt3__links,
  .lt3__legend {
    display: none;
  }
  .lt3__stage {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    padding-bottom: var(--space-6);
  }
  .lt3__photo {
    order: -1;
    width: 100%;
    border-radius: var(--radius-lg);
  }
  .lt3__col {
    align-items: stretch;
    width: 100%;
    height: auto;
    padding: 0;
  }
  .lt3__card {
    width: 100%;
  }
}
</style>
