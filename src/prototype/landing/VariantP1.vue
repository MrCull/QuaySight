<script setup lang="ts">
// PROTOTYPE variant P1, "Pointers, fanned": headline and key field centred, then one sample photo standing on
// the foot of the page with every reading outlined where it is painted and a connector to its card, cards
// fanning out on both sides. Seven areas are pointed at; each card carries its certainty.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const LEVELS = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen'] as const

// Elbow connectors from each outlined area to its card, measured from the laid-out elements.
const LINKS = [
  { key: 'id', side: 'right' },
  { key: 'type', side: 'right' },
  { key: 'weights', side: 'right' },
  { key: 'cube', side: 'right' },
  { key: 'marking', side: 'right' },
  { key: 'plate', side: 'left' },
  { key: 'seal', side: 'left' },
] as const
const stage = useTemplateRef<HTMLElement>('stage')
const paths = ref<{ key: string; d: string; x: number; y: number }[]>([])
function measure() {
  const root = stage.value
  if (!root) return
  const origin = root.getBoundingClientRect()
  const photo = root.querySelector('.lp1__photo')!.getBoundingClientRect()
  let nRight = 0
  let nLeft = 0
  paths.value = LINKS.map(({ key, side }) => {
    const box = root.querySelector(`.lp1__box--${key}`)!.getBoundingClientRect()
    const card = root.querySelector(`.lp1__card--${key}`)!.getBoundingClientRect()
    const y0 = box.top + box.height / 2 - origin.top
    const y1 = Math.min(Math.max(y0, card.top - origin.top + 18), card.bottom - origin.top - 18)
    if (side === 'right') {
      const x0 = box.right - origin.left
      const x1 = card.left - origin.left
      const bend = photo.right - origin.left + 12 + nRight++ * 7
      return { key, d: `M${x0} ${y0}H${bend}V${y1}H${x1}`, x: x1, y: y1 }
    }
    const x1 = card.right - origin.left
    const bend = photo.left - origin.left - 12 - nLeft++ * 9
    if (key === 'seal') {
      // Drops below the plate's outline before turning, so the two never cross.
      const cx = box.left + box.width / 2 - origin.left
      const under = box.bottom - origin.top + 18
      return { key, d: `M${cx} ${box.bottom - origin.top}V${under}H${bend}V${y1}H${x1}`, x: x1, y: y1 }
    }
    const x0 = box.left - origin.left
    return { key, d: `M${x0} ${y0}H${bend}V${y1}H${x1}`, x: x1, y: y1 }
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
  <main class="lp1">
    <header class="lp1__top">
      <p class="lp1__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <p class="lp1__kicker">Container inspection from photos</p>
    </header>

    <section class="lp1__lead">
      <h1 class="lp1__title">Everything on the quay, in sight.</h1>
      <p class="lp1__sub">
        Photograph a container. Quay Sight reads what is painted on it, points to where it read
        it, and tells you how sure it is.
      </p>
      <ProtoKeyField />
    </section>

    <section ref="stage" class="lp1__stage" aria-label="A sample photo with its readings">
      <div class="lp1__col lp1__col--left">
        <div class="lp1__legend">
          <p>Each reading carries one of five certainties</p>
          <ul>
            <li v-for="level in LEVELS" :key="level"><CertaintyChip :level="level" /></li>
          </ul>
        </div>
        <article class="lp1__card lp1__card--plate" style="--i: 5">
          <header>
            <h2><i class="qs-glyph qs-glyph--document" aria-hidden="true"></i>CSC plate</h2>
            <CertaintyChip level="Can't tell" />
          </header>
          <p class="lp1__why">In the photo, not clear enough to read.</p>
        </article>
        <article class="lp1__card lp1__card--seal" style="--i: 6">
          <header>
            <h2><i class="qs-glyph qs-glyph--padlock" aria-hidden="true"></i>Seal</h2>
            <CertaintyChip level="Not seen" />
          </header>
          <p class="lp1__why">None in view on the handles. A close-up may help.</p>
        </article>
      </div>

      <figure class="lp1__photo">
        <div class="lp1__frame">
          <img :src="doors" alt="Rear doors of a blue freight container on a trailer" />
          <i class="lp1__box lp1__box--id" style="--i: 0" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--type" style="--i: 1" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--weights" style="--i: 2" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--cube" style="--i: 3" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--marking" style="--i: 4" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--plate" style="--i: 5" aria-hidden="true"></i>
          <i class="lp1__box lp1__box--seal" style="--i: 6" aria-hidden="true"></i>
        </div>
        <i class="lp1__sweep" aria-hidden="true"></i>
        <span class="lp1__tag"
          ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded
          reading</span
        >
      </figure>

      <div class="lp1__col lp1__col--right">
        <article class="lp1__card lp1__card--id" style="--i: 0">
          <header>
            <h2><i class="qs-glyph qs-glyph--tag" aria-hidden="true"></i>Container ID</h2>
            <CertaintyChip level="Confident" />
          </header>
          <p class="lp1__value">JDLU 200690 <b>2</b></p>
        </article>
        <article class="lp1__card lp1__card--type" style="--i: 1">
          <header>
            <h2><i class="qs-glyph qs-glyph--container" aria-hidden="true"></i>Size and type</h2>
            <CertaintyChip level="Confident" />
          </header>
          <p class="lp1__value">22G1 <span>20 ft general purpose</span></p>
        </article>
        <article class="lp1__card lp1__card--weights" style="--i: 2">
          <header>
            <h2><i class="qs-glyph qs-glyph--weight" aria-hidden="true"></i>Weights</h2>
            <CertaintyChip level="Confident" />
          </header>
          <dl>
            <div><dt>Max gross</dt><dd>32,500 kg</dd></div>
            <div><dt>Tare</dt><dd>2,180 kg</dd></div>
            <div><dt>Payload</dt><dd>30,320 kg</dd></div>
          </dl>
        </article>
        <article class="lp1__card lp1__card--cube" style="--i: 3">
          <header>
            <h2><i class="qs-glyph qs-glyph--cube" aria-hidden="true"></i>Cubic capacity</h2>
            <CertaintyChip level="Confident" />
          </header>
          <p class="lp1__value">33.2 m³</p>
        </article>
        <article class="lp1__card lp1__card--marking" style="--i: 4">
          <header>
            <h2>
              <i class="qs-glyph qs-glyph--hazard lp1__diamond" aria-hidden="true"></i>Marking
            </h2>
            <CertaintyChip level="Likely" />
          </header>
          <p class="lp1__value lp1__value--plain">Super heavy <span>No DG placard visible</span></p>
        </article>
      </div>

      <svg class="lp1__links" aria-hidden="true">
        <g v-for="(link, n) in paths" :key="link.key" :class="`lp1__link lp1__link--${link.key}`" :style="`--i: ${n}`">
          <path :d="link.d" pathLength="1" />
          <circle :cx="link.x" :cy="link.y" r="3.5" />
        </g>
      </svg>
    </section>
  </main>
</template>

<style scoped>
.lp1 {
  --edge: clamp(var(--space-5), 4vw, calc(var(--space-8) * 1.25));
  --photo-h: clamp(340px, calc(100vh - 408px), 780px);
  --rule: color-mix(in srgb, var(--landing-ink) 14%, transparent);
  flex: 1;
  display: grid;
  grid-template-rows: auto auto 1fr;
  background: var(--landing-bg);
  color: var(--landing-ink);
}

.lp1__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge) 0;
}
.lp1__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lp1__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.lp1__kicker {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Words and the key field */
.lp1__lead {
  --lp-field-width: 620px;
  display: grid;
  justify-items: center;
  padding: var(--space-2) var(--edge) var(--space-5);
  text-align: center;
}
.lp1__title {
  margin: 0;
  font: 700 clamp(2.5rem, 4.9vw, 5.5rem)/1 var(--font-hero);
  letter-spacing: -0.05em;
  text-wrap: balance;
}
.lp1__sub {
  max-width: 60rem;
  margin: var(--space-3) 0 var(--space-4);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}
.lp1__lead :deep(.lp-key__note) {
  justify-content: center;
  margin-top: var(--space-3);
}

/* Stage: cards, photo, cards */
.lp1__stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: clamp(var(--space-6), 4vw, var(--space-8));
  align-items: end;
  padding: 0 var(--edge);
}
.lp1__photo {
  position: relative;
  width: calc(var(--photo-h) * 1.29);
  height: var(--photo-h);
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-landing);
}
/* The whole 3:4 photo, hung so the doors fill the window. */
.lp1__frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  aspect-ratio: 3 / 4;
  transform: translateY(-14.5%);
}
.lp1__frame img {
  display: block;
  width: 100%;
  height: 100%;
}
.lp1__tag {
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
.lp1__sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.lp1__sweep::after {
  content: '';
  position: absolute;
  inset: -30% 0 auto;
  height: 30%;
  border-bottom: 1px solid color-mix(in srgb, var(--landing-surface) 80%, transparent);
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--landing-surface) 36%, transparent));
  animation: lp1-sweep 1100ms cubic-bezier(0.4, 0, 0.2, 1) 150ms both;
}

/* Where each reading was read */
.lp1__box {
  --c: var(--cert-confident-line);
  position: absolute;
  border: 2px solid var(--c);
  border-radius: var(--radius-sm);
  box-shadow:
    0 0 0 1px var(--landing-surface),
    inset 0 0 0 1px var(--landing-surface);
  animation: lp1-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(900ms + var(--i) * 130ms);
}
.lp1__box--id { left: 58.4%; top: 26.5%; width: 26.2%; height: 4.7%; }
.lp1__box--type { left: 68.6%; top: 31.4%; width: 9.8%; height: 3.3%; }
.lp1__box--weights { left: 55.8%; top: 36.5%; width: 26.4%; height: 10.8%; }
.lp1__box--cube { left: 56.6%; top: 47.6%; width: 26.4%; height: 4.1%; }
.lp1__box--marking { --c: var(--cert-likely-line); left: 73.6%; top: 55%; width: 9.4%; height: 7.4%; }
.lp1__box--plate { --c: var(--cert-unknown-line); left: 11.4%; top: 53.2%; width: 12.2%; height: 10%; border-style: dashed; }
.lp1__box--seal { --c: var(--line-strong); left: 28%; top: 53.4%; width: 16.4%; height: 9.6%; border-style: dashed; border-radius: var(--radius-pill); }

.lp1__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.lp1__link {
  --c: var(--cert-confident-line);
}
.lp1__link path {
  fill: none;
  stroke: var(--c);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: lp1-line var(--duration-arrive) ease-out both;
  animation-delay: calc(1000ms + var(--i) * 130ms);
}
.lp1__link circle {
  fill: var(--c);
  stroke: var(--landing-bg);
  stroke-width: 2;
  animation: lp1-fade var(--duration-base) ease-out both;
  animation-delay: calc(1350ms + var(--i) * 130ms);
}
.lp1__link--marking { --c: var(--cert-likely-line); }
.lp1__link--plate { --c: var(--cert-unknown-line); }
.lp1__link--seal { --c: var(--line-strong); }
.lp1__link--plate path,
.lp1__link--seal path {
  stroke-dasharray: 0.02 0.014;
  animation-name: lp1-fade;
}

/* Cards */
.lp1__col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  height: var(--photo-h);
  padding-bottom: var(--space-4);
  box-sizing: border-box;
}
.lp1__col--left {
  align-items: flex-end;
  justify-content: flex-end;
}
.lp1__col--right {
  align-items: flex-start;
}
.lp1__card {
  display: grid;
  gap: var(--space-1);
  box-sizing: border-box;
  width: min(100%, 340px);
  padding: var(--space-2) var(--space-4) var(--space-3);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--landing-surface);
  box-shadow: var(--shadow-landing);
  animation: lp1-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1100ms + var(--i) * 130ms);
}
.lp1__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.lp1__card h2 {
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
.lp1__diamond {
  color: var(--hazard-fg);
}
.lp1__value {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin: 0;
  font: 500 1.1875rem/1.625rem var(--font-mono);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lp1__value--plain {
  font: 600 1.0625rem/1.625rem var(--font-sans);
  letter-spacing: 0;
}
.lp1__value span,
.lp1__why {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
  letter-spacing: 0;
}
.lp1__value b {
  display: inline-block;
  margin-left: calc(var(--space-3) * -1 + 0.4em);
  padding: 0 var(--space-1);
  border: 1.5px solid currentColor;
  border-radius: var(--radius-xs);
  font-weight: 500;
  line-height: 1.25;
}
.lp1__card dl {
  display: grid;
  margin: 0;
}
.lp1__card dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.lp1__card dt {
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.lp1__card dd {
  margin: 0;
  font: 500 0.9375rem/1.25rem var(--font-mono);
}

.lp1__legend {
  width: min(100%, 340px);
  margin-bottom: auto;
  padding-top: var(--space-2);
}
.lp1__legend p {
  margin: 0 0 var(--space-3);
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.lp1__legend ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

@keyframes lp1-sweep {
  to {
    transform: translateY(440%);
    opacity: 0;
  }
}
@keyframes lp1-box {
  from {
    opacity: 0;
    transform: scale(1.18);
  }
}
@keyframes lp1-line {
  from {
    stroke-dashoffset: 1;
  }
}
@keyframes lp1-fade {
  from {
    opacity: 0;
  }
}
@keyframes lp1-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp1 *,
  .lp1 *::after {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lp1 {
    --photo-h: min(74vw, 520px);
  }
  .lp1__kicker,
  .lp1__links,
  .lp1__legend {
    display: none;
  }
  .lp1__stage {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    padding-bottom: var(--space-6);
  }
  .lp1__photo {
    order: -1;
    width: 100%;
    border-radius: var(--radius-lg);
  }
  .lp1__col {
    align-items: stretch;
    width: 100%;
    height: auto;
    padding: 0;
  }
  .lp1__card {
    width: 100%;
  }
}
</style>
