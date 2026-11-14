<script setup lang="ts">
// PROTOTYPE variant A, "Annotated photo": the product shown at work. One sample photo with the readings
// drawn where they were read, each with its certainty, beside the headline and the key field.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const LEVELS = ['Confident', 'Likely', 'Uncertain', "Can't tell", 'Not seen'] as const

// Elbow connectors from each outlined area of the photo to its card, measured from the laid-out elements.
const LINKS = ['id', 'weights', 'marking'] as const
const stage = useTemplateRef<HTMLElement>('stage')
const paths = ref<{ key: string; d: string }[]>([])
function measure() {
  const root = stage.value
  if (!root) return
  const origin = root.getBoundingClientRect()
  const photo = root.querySelector('.la__photo')!.getBoundingClientRect()
  paths.value = LINKS.map((key, n) => {
    const box = root.querySelector(`.la__box--${key}`)!.getBoundingClientRect()
    const card = root.querySelector(`.la__card--${key}`)!.getBoundingClientRect()
    const x0 = box.right - origin.left
    const y0 = box.top + box.height / 2 - origin.top
    const x1 = card.left - origin.left
    const y1 = Math.min(Math.max(y0, card.top - origin.top + 20), card.bottom - origin.top - 20)
    const bend = photo.right - origin.left + 4 + n * 4
    return { key, d: `M${x0} ${y0}H${bend}V${y1}H${x1}` }
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
  <main class="la">
    <section class="la__copy">
      <span class="la__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
      <div class="la__lead">
        <h1 class="la__title">Read any container from a photo.</h1>
        <p class="la__sub">
          Photograph the doors. Quay Sight reads the ID, weights, seal and placards, marks any
          damage it suspects, and tells you how sure it is of every one.
        </p>
        <ProtoKeyField />
      </div>
      <div class="la__legend">
        <p>Five words for how sure it is</p>
        <ul>
          <li v-for="level in LEVELS" :key="level"><CertaintyChip :level="level" /></li>
        </ul>
      </div>
    </section>

    <section ref="stage" class="la__stage" aria-label="A sample photo with its readings">
      <figure class="la__photo">
        <img :src="doors" alt="Rear doors of a blue freight container on a trailer" />
        <i class="la__sweep" aria-hidden="true"></i>
        <span class="la__tag"
          ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded
          reading</span
        >

        <i class="la__box la__box--id" style="--i: 0" aria-hidden="true"></i>
        <i class="la__box la__box--weights" style="--i: 1" aria-hidden="true"></i>
        <i class="la__box la__box--marking" style="--i: 2" aria-hidden="true"></i>
        <i class="la__box la__box--plate" style="--i: 3" aria-hidden="true"></i>

        <article class="la__card la__card--plate" style="--i: 3">
          <h2><i class="qs-glyph qs-glyph--document" aria-hidden="true"></i>CSC plate</h2>
          <p class="la__why">In the photo, not clear enough to read.</p>
          <CertaintyChip level="Can't tell" />
        </article>
        <article class="la__card la__card--seal" style="--i: 4">
          <h2><i class="qs-glyph qs-glyph--padlock" aria-hidden="true"></i>Seal</h2>
          <p class="la__why">Not in this photo. A close-up may help.</p>
          <CertaintyChip level="Not seen" />
        </article>
      </figure>

      <div class="la__cards">
        <article class="la__card la__card--id" style="--i: 0">
          <h2><i class="qs-glyph qs-glyph--tag" aria-hidden="true"></i>Container ID</h2>
          <p class="la__id">JDLU 200690 <b>2</b></p>
          <p class="la__why">22G1 · 20 ft general purpose</p>
          <CertaintyChip level="Confident" />
        </article>
        <article class="la__card la__card--weights" style="--i: 1">
          <h2><i class="qs-glyph qs-glyph--weight" aria-hidden="true"></i>Weights</h2>
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
          </dl>
          <CertaintyChip level="Confident" />
        </article>
        <article class="la__card la__card--marking" style="--i: 2">
          <h2><i class="qs-glyph qs-glyph--hazard la__diamond" aria-hidden="true"></i>Marking</h2>
          <p class="la__value">Super heavy</p>
          <p class="la__why">Caution marking. No DG placard visible.</p>
          <CertaintyChip level="Likely" />
        </article>
      </div>
      <svg class="la__links" aria-hidden="true">
        <path
          v-for="(link, n) in paths"
          :key="link.key"
          :class="`la__link la__link--${link.key}`"
          :style="`--i: ${n}`"
          :d="link.d"
          pathLength="1"
        />
      </svg>
    </section>
  </main>
</template>

<style scoped>
.la {
  --photo-h: clamp(520px, min(calc(100vh - 150px), 46vw), 940px);
  --photo-w: calc(var(--photo-h) * 0.75);
  --cards-w: 248px;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-7);
  padding: var(--space-6) clamp(var(--space-5), 4.5vw, calc(var(--space-8) * 1.5)) var(--space-5);
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* Copy column */
.la__copy {
  --lp-align: start;
  --lp-field-width: 560px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  align-self: stretch;
  min-width: 0;
  max-width: 600px;
}
.la__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: start;
  padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  font: 700 1.25rem/1 var(--font-hero);
  letter-spacing: -0.02em;
}
.la__brand .qs-logo {
  width: 26px;
  height: 26px;
  color: inherit;
}
.la__lead {
  align-self: center;
  padding-block: var(--space-6);
}
.la__title {
  margin: 0;
  font: 700 clamp(2.75rem, 5.2vw, 5.5rem)/0.95 var(--font-hero);
  letter-spacing: -0.045em;
  text-wrap: balance;
}
.la__sub {
  max-width: 34rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
}
.la__legend p {
  margin: 0 0 var(--space-3);
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.la__legend ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Photo stage */
.la__stage {
  position: relative;
  display: flex;
  gap: var(--space-4);
}
.la__photo {
  position: relative;
  flex: none;
  width: var(--photo-w);
  height: var(--photo-h);
  margin: 0;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-landing);
}
.la__photo img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
.la__tag {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  color: var(--landing-ink);
  font: 500 0.75rem/1.25rem var(--font-sans);
  box-shadow: var(--shadow-landing-chip);
}
.la__sweep {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.la__sweep::after {
  content: '';
  position: absolute;
  inset: -30% 0 auto;
  height: 30%;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--landing-surface) 38%, transparent)
  );
  border-bottom: 1px solid color-mix(in srgb, var(--landing-surface) 80%, transparent);
  animation: la-sweep 1100ms cubic-bezier(0.4, 0, 0.2, 1) 150ms both;
}

/* Where each reading was read */
.la__box {
  position: absolute;
  border: 2px solid var(--cert-confident-line);
  border-radius: var(--radius-sm);
  box-shadow:
    0 0 0 1px var(--landing-surface),
    inset 0 0 0 1px var(--landing-surface);
  animation: la-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(900ms + var(--i) * 160ms);
}
.la__box--id {
  left: 58.2%;
  top: 25.6%;
  width: 26.6%;
  height: 9%;
}
.la__box--weights {
  left: 55.8%;
  top: 36.2%;
  width: 26.4%;
  height: 15.4%;
}
.la__box--marking {
  left: 73.6%;
  top: 55%;
  width: 9.4%;
  height: 7.4%;
  border-color: var(--cert-likely-line);
}
.la__box--plate {
  left: 11.4%;
  top: 53.2%;
  width: 12.2%;
  height: 10%;
  border-style: dashed;
  border-color: var(--cert-unknown-line);
}
.la__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.la__link {
  fill: none;
  stroke: var(--cert-confident-line);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: la-line var(--duration-arrive) ease-out both;
  animation-delay: calc(1000ms + var(--i) * 160ms);
}
.la__link--marking {
  stroke: var(--cert-likely-line);
}

/* Reading cards */
.la__cards {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-4);
  width: var(--cards-w);
  height: var(--photo-h);
}
.la__card {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--landing-surface);
  box-shadow: var(--shadow-landing);
  animation: la-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1100ms + var(--i) * 160ms);
}
.la__card--plate,
.la__card--seal {
  position: absolute;
  left: 4%;
  grid-template-columns: 1fr auto;
  align-items: center;
  width: min(272px, 60%);
  padding-bottom: var(--space-3);
}
.la__card--plate .la__why,
.la__card--seal .la__why {
  grid-column: 1 / -1;
  grid-row: 2;
}
.la__card--plate {
  top: 65.4%;
}
.la__card--seal {
  top: calc(65.4% + 92px + var(--space-3));
}
.la__card h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.la__diamond {
  color: var(--hazard-fg);
}
.la__id,
.la__value {
  margin: 0;
  font: 500 1.375rem/1.75rem var(--font-mono);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.la__value {
  font: 600 1.125rem/1.5rem var(--font-sans);
  letter-spacing: 0;
}
.la__id b {
  display: inline-block;
  padding: 0 var(--space-1);
  border: 1.5px solid currentColor;
  border-radius: var(--radius-xs);
  font-weight: 500;
}
.la__why {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.125rem var(--font-sans);
}
.la__card dl {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  margin: 0;
}
.la__card dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.la__card dt {
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.375rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.la__card dd {
  margin: 0;
  font: 500 0.9375rem/1.375rem var(--font-mono);
}

@keyframes la-sweep {
  to {
    transform: translateY(440%);
    opacity: 0;
  }
}
@keyframes la-box {
  from {
    opacity: 0;
    transform: scale(1.18);
  }
}
@keyframes la-line {
  from {
    stroke-dashoffset: 1;
  }
}
@keyframes la-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .la *,
  .la *::after {
    animation: none !important;
  }
}

@media (max-width: 1180px) {
  .la {
    grid-template-columns: minmax(0, 1fr);
    --photo-h: min(680px, 118vw);
    --cards-w: min(256px, 38vw);
  }
  .la__stage {
    justify-content: center;
  }
}
@media (max-width: 640px) {
  .la {
    --photo-h: 120vw;
  }
  .la__stage {
    flex-direction: column;
    align-items: center;
  }
  .la__links,
  .la__card--plate,
  .la__card--seal {
    display: none;
  }
  .la__cards {
    display: grid;
    gap: var(--space-3);
    width: 100%;
    height: auto;
  }
  .la__card {
    width: 100%;
  }
}
</style>
