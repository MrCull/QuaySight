<script setup lang="ts">
// PROTOTYPE variant W1, the working pick (from DK2): the readings split into separate cards over the photo's
// left edge, brighter teal boxes on the paint, and the wonky "Try the demo" label under the key field.
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'
import { POINTERS, boxStyle, tone, useNightQuay } from './dkShared'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const setup = useSetupStore()
useNightQuay()

// The page's own height, measured: the photo is hung from it. The rules are measured from the laid-out rows
// and boxes, so each one ends on the edge of its box.
const page = useTemplateRef<HTMLElement>('page')
const height = ref(844)
const paths = ref<{ key: string; d: string; x: number; y: number; tone: string }[]>([])
let observer: ResizeObserver | undefined
function measure() {
  const root = page.value
  if (!root) return
  height.value = root.clientHeight
  void nextTick(() => {
    const origin = root.getBoundingClientRect()
    const panel = root.querySelector('.w1__panel')?.getBoundingClientRect()
    if (!panel) return
    paths.value = POINTERS.map((p, n) => {
      const row = root.querySelector(`[data-row="${p.key}"]`)!.getBoundingClientRect()
      const box = root.querySelector(`[data-box="${p.key}"]`)!.getBoundingClientRect()
      const x0 = panel.right - origin.left
      const y0 = row.top + row.height / 2 - origin.top
      const x1 = box.left - origin.left
      const y1 = box.top + box.height / 2 - origin.top
      const bend = x0 + 14 + (POINTERS.length - 1 - n) * 8
      return { key: p.key, d: `M${x0} ${y0}H${bend}V${y1}H${x1}`, x: x1, y: y1, tone: tone(p) }
    })
  })
}
onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && page.value) {
    observer = new ResizeObserver(measure)
    observer.observe(page.value)
  }
  void document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main ref="page" class="w1">
    <div class="w1__in" :style="`--h: ${height}px`">
      <figure class="w1__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-for="(b, k) in p.boxes"
            :key="b.box[0]"
            :data-box="k === 0 ? p.key : undefined"
            :class="['w1__box', `w1__box--${tone(p)}`]"
            :style="`--i: ${n}; ${boxStyle(b.box)}`"
            ><b v-if="b.caption">{{ b.caption }}</b></i
          >
        </template>
      </figure>
      <i class="w1__shade" aria-hidden="true"></i>

      <header class="w1__top">
        <p class="w1__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      </header>

      <section class="w1__lead">
        <h1 class="w1__title">The whole <em>Quay</em>,<br />in <em>Sight</em>.</h1>
        <p class="w1__sub">To OCR, and beyond…</p>
        <ProtoKeyField
          :demo="false"
          note="Never stored. Your key lives in this tab and goes only to your provider."
        />
        <div class="w1__patch">
          <p><b>No key to hand?</b> Open a sample container and see what it read. No charge.</p>
          <button type="button" @click="setup.enterDemo()">
            Try the demo
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>

      <svg class="w1__links" aria-hidden="true">
        <g
          v-for="(l, n) in paths"
          :key="l.key"
          :class="`w1__link w1__link--${l.tone}`"
          :style="`--i: ${n}`"
        >
          <path :d="l.d" pathLength="1" />
          <circle :cx="l.x" :cy="l.y" r="4" />
        </g>
      </svg>

      <section class="w1__panel" aria-label="Read from the sample photo">
        <div class="w1__card w1__id" data-row="id" style="--i: 0">
          <span class="w1__k"><b>01</b>Container ID</span>
          <span class="qs-id qs-id--md" aria-label="J D L U, 2 0 0, 6 9 0, check digit 2">
            <span class="qs-id__group"
              ><span v-for="c in 'JDLU'" :key="c" class="qs-id__ch">{{ c }}</span></span
            >
            <span class="qs-id__group"
              ><span v-for="(c, k) in '200'" :key="k" class="qs-id__ch">{{ c }}</span></span
            >
            <span class="qs-id__group"
              ><span v-for="(c, k) in '690'" :key="k" class="qs-id__ch">{{ c }}</span></span
            >
            <span class="qs-id__check">2</span>
          </span>
          <span class="w1__meta">
            <CertaintyChip level="Confident" />
            <span class="qs-prov qs-prov--calculated">Check digit valid</span>
          </span>
        </div>
        <div class="w1__card" data-row="type" style="--i: 1">
          <span class="w1__k"><b>02</b>Size and type</span>
          <b class="w1__v">22G1 <small>20 ft general purpose</small></b>
          <CertaintyChip level="Confident" />
        </div>
        <div class="w1__card w1__card--weights" style="--i: 2">
          <span class="w1__k"><b>03</b>Weights</span>
          <CertaintyChip level="Likely" />
          <dl>
            <div v-for="p in POINTERS.slice(2, 6)" :key="p.key" :data-row="p.key">
              <dt>{{ p.label }}</dt>
              <dd>{{ p.value }}</dd>
            </div>
          </dl>
        </div>
        <div class="w1__card" data-row="marking" style="--i: 3">
          <span class="w1__k"><b>04</b>Marking</span>
          <b class="w1__v w1__plain">Super heavy <small>No DG placard visible</small></b>
          <CertaintyChip level="Confident" />
        </div>
        <div class="w1__card" style="--i: 4">
          <span class="w1__k"><b>05</b>Seal</span>
          <b class="w1__v w1__plain">Not in this photo</b>
          <CertaintyChip level="Not seen" />
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* The photo is hung so that its band from 22% to 66% fills the page height (--ph is the photo's full height)
   and its right-hand markings sit a little in from the right edge. Everything else is placed from the same
   numbers, so each rule ends exactly on the edge of its box. */
.w1 {
  position: relative;
  flex: 1;
  min-height: 680px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  container-type: inline-size;
}
.w1__in {
  --ph: calc(var(--h) / 0.48);
  --pw: calc(var(--ph) * 0.75);
  --pl: calc(96cqw - var(--pw) * 0.87);
  --pt: calc(var(--ph) * -0.2);
  --panel: 21.5rem;
  --list: calc(var(--pl) + var(--pw) * 0.5667 - var(--panel) - 6.5cqw);
  --edge: clamp(var(--space-5), 4.4vw, calc(var(--space-8) * 1.25));
  --lp-align: start;
  --lp-field-width: 460px;
  --lp-field-bg: var(--landing-ink);
  --lp-field-ink: var(--landing-on-ink);
  --lp-field-muted: color-mix(in srgb, var(--landing-on-ink) 62%, var(--landing-ink));
  --lp-field-well: color-mix(in srgb, var(--landing-on-ink) 10%, var(--landing-ink));
  --lp-opt-on-bg: var(--landing-on-ink);
  --lp-opt-on-ink: var(--landing-ink);
  --lp-go-bg: var(--brand);
  --lp-go-ink: var(--on-brand);
  --lp-note-ink: var(--landing-ink-muted);
  --lp-focus: var(--brand);
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  isolation: isolate;
}

.w1__photo {
  position: absolute;
  z-index: -2;
  left: var(--pl);
  top: var(--pt);
  width: var(--pw);
  height: var(--ph);
  margin: 0;
  animation: w1-fade 1200ms ease-out both;
}
.w1__photo img {
  display: block;
  width: 100%;
  height: 100%;
  filter: brightness(0.8) contrast(1.06) saturate(0.9);
}
.w1__shade {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      var(--landing-bg) calc(var(--list) - 9cqw),
      color-mix(in srgb, var(--landing-bg) 72%, transparent) calc(var(--list) + 2cqw),
      color-mix(in srgb, var(--landing-bg) 22%, transparent) calc(var(--list) + var(--panel) + 2cqw),
      transparent calc(var(--pl) + var(--pw) * 0.56)
    ),
    linear-gradient(0deg, var(--landing-bg), transparent 16%);
  pointer-events: none;
}

/* Each painted item squared off: a solid outline in its certainty colour, a faint tint and a glow */
.w1__box {
  --c: var(--brand);
  position: absolute;
  box-sizing: border-box;
  border: 2.5px solid var(--c);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--c) 16%, transparent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--landing-bg) 80%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--landing-bg) 55%, transparent),
    0 0 22px color-mix(in srgb, var(--c) 75%, transparent);
  animation: w1-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(700ms + var(--i) * 120ms);
}
.w1__box b {
  position: absolute;
  left: -2px;
  bottom: calc(100% + 3px);
  color: var(--c);
  font: 600 0.625rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Top line */
.w1__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.w1__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.w1__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
/* Words */
.w1__lead {
  align-self: center;
  box-sizing: border-box;
  width: calc(var(--list) - var(--space-5));
  max-width: 580px;
  padding: 0 0 var(--space-5) var(--edge);
  animation: w1-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.w1__title {
  margin: 0;
  font: 700 clamp(2.5rem, 4.3vw, 5.25rem)/0.98 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.w1__title em {
  color: var(--brand);
  font-style: normal;
}
.w1__sub {
  max-width: 27rem;
  margin: var(--space-4) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}
.w1__patch {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  width: 17.5rem;
  margin: calc(var(--space-8) * 1.5) 0 0 var(--space-5);
  padding: var(--space-4);
  border-radius: var(--radius-xs);
  background: var(--landing-ink);
  color: var(--landing-on-ink);
  box-shadow: var(--shadow-landing);
  rotate: -2.2deg;
}
.w1__patch p {
  margin: 0;
  font: 400 0.875rem/1.25rem var(--font-sans);
}
.w1__patch button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--landing-on-ink);
  color: var(--landing-ink);
  font: 600 0.875rem/1 var(--font-sans);
  cursor: pointer;
}
.w1__patch button:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.w1__patch svg {
  width: 16px;
  height: 16px;
}

/* Readings, together in one glass panel over the photo's left edge */
.w1__panel {
  position: absolute;
  left: var(--list);
  top: calc(var(--pt) + var(--ph) * 0.232);
  display: grid;
  gap: var(--space-3);
  width: var(--panel);
}
.w1__card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--landing-ink) 16%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--landing-bg) 80%, transparent);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: var(--shadow-landing);
  animation: w1-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(600ms + var(--i) * 130ms);
}
.w1__card > .w1__k,
.w1__card > .w1__v {
  grid-column: 1;
}
.w1__card > :deep(.qs-cert) {
  grid-column: 2;
  grid-row: 1 / span 2;
}
.w1__card--weights > :deep(.qs-cert) {
  grid-row: 1;
}
.w1__card small {
  margin-left: var(--space-2);
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.w1__card dl {
  grid-column: 1 / -1;
  display: grid;
  margin: var(--space-1) 0 0;
}
.w1__card dl div {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 12%, transparent);
}
.w1__card dt {
  color: var(--landing-ink-muted);
  font: 400 0.875rem/1.375rem var(--font-sans);
}
.w1__card dd {
  margin: 0;
  font: 500 0.9375rem/1.375rem var(--font-mono);
}
.w1__k {
  display: flex;
  gap: var(--space-2);
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.w1__k b {
  color: var(--brand);
  font-weight: 500;
}
.w1__id {
  grid-template-columns: 1fr;
  justify-items: start;
  gap: var(--space-2);
  padding-block: var(--space-4);
}
.w1__id .qs-id {
  color: var(--landing-ink);
}
.w1__id .qs-id__check {
  border-color: var(--landing-ink);
}
.w1__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.w1__meta .qs-prov {
  height: 26px;
  border-color: color-mix(in srgb, var(--landing-ink) 40%, transparent);
  color: var(--landing-ink-muted);
}
.w1__v {
  grid-column: 1;
}
.w1__card > :deep(.qs-cert) {
  grid-column: 2;
  grid-row: 1 / span 2;
}
.w1__card--weights > :deep(.qs-cert) {
  grid-row: 1;
}
.w1__card small {
  margin-left: var(--space-2);
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.w1__card dl {
  grid-column: 1 / -1;
  display: grid;
  margin: var(--space-1) 0 0;
}
.w1__card dl div {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 12%, transparent);
}
.w1__card dt {
  color: var(--landing-ink-muted);
  font: 400 0.875rem/1.375rem var(--font-sans);
}
.w1__card dd {
  margin: 0;
  font: 500 0.9375rem/1.375rem var(--font-mono);
}
.w1__k {
  display: flex;
  gap: var(--space-2);
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.w1__k b {
  color: var(--brand);
  font-weight: 500;
}
.w1__id {
  grid-template-columns: 1fr;
  justify-items: start;
  gap: var(--space-2);
  padding-block: var(--space-4);
}
.w1__id .qs-id {
  color: var(--landing-ink);
}
.w1__id .qs-id__check {
  border-color: var(--landing-ink);
}
.w1__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.w1__meta .qs-prov {
  height: 26px;
  border-color: color-mix(in srgb, var(--landing-ink) 40%, transparent);
  color: var(--landing-ink-muted);
}
.w1__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.w1__row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 14%, transparent);
  animation: w1-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(800ms + var(--i, 7) * 120ms);
}
.w1__row :deep(.qs-cert) {
  grid-row: span 2;
  grid-column: 2;
}
.w1__row .w1__k {
  grid-column: 1;
}
.w1__v {
  grid-column: 1;
  font: 500 1rem/1.25rem var(--font-mono);
  white-space: nowrap;
}
.w1__v.w1__plain {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}

/* Elbow rules from the panel to the edge of each box */
.w1__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.w1__link {
  --c: var(--brand);
}
.w1__link path {
  fill: none;
  stroke: var(--c);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: w1-rule 700ms ease-out both;
  animation-delay: calc(950ms + var(--i) * 120ms);
}
.w1__link circle {
  fill: var(--c);
  filter: drop-shadow(0 0 4px var(--c));
  animation: w1-fade 300ms ease-out both;
  animation-delay: calc(1500ms + var(--i) * 120ms);
}

@keyframes w1-fade {
  from {
    opacity: 0;
  }
}
@keyframes w1-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes w1-box {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes w1-rule {
  from {
    stroke-dashoffset: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .w1 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .w1 {
    container-type: normal;
    min-height: 0;
  }
  .w1__in {
    position: static;
    display: block;
  }
  .w1__photo,
  .w1__shade,
  .w1__links {
    display: none;
  }
  .w1__lead {
    width: auto;
    max-width: none;
    padding: var(--space-5) var(--edge);
  }
  .w1__title {
    white-space: normal;
  }
  .w1__panel {
    position: static;
    width: auto;
    margin: 0 var(--edge) var(--space-5);
  }
}
</style>
