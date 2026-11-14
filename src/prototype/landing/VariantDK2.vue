<script setup lang="ts">
// PROTOTYPE variant DK2, "Dark pointers, panel": the same parts as DK1 with the photo given more of the
// screen. The readings sit together in one glass panel over the photo's left edge, the container ID leading,
// and a measured elbow rule runs from each to the edge of its box on the door. Night quay theme.
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
    const panel = root.querySelector('.dk2__panel')?.getBoundingClientRect()
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
  <main ref="page" class="dk2">
    <div class="dk2__in" :style="`--h: ${height}px`">
      <figure class="dk2__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-for="(b, k) in p.boxes"
            :key="b.box[0]"
            :data-box="k === 0 ? p.key : undefined"
            :class="['dk2__box', `dk2__box--${tone(p)}`]"
            :style="`--i: ${n}; ${boxStyle(b.box)}`"
            ><b v-if="b.caption">{{ b.caption }}</b></i
          >
        </template>
      </figure>
      <i class="dk2__shade" aria-hidden="true"></i>

      <header class="dk2__top">
        <p class="dk2__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <button type="button" class="dk2__demo" @click="setup.enterDemo()">
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
      </header>

      <section class="dk2__lead">
        <h1 class="dk2__title">The whole <em>Quay</em>,<br />in <em>Sight</em>.</h1>
        <p class="dk2__sub">
          It reads the doors, checks the sums, maps the dents, and never pretends to be sure.
        </p>
        <ProtoKeyField :demo="false" />
      </section>

      <svg class="dk2__links" aria-hidden="true">
        <g
          v-for="(l, n) in paths"
          :key="l.key"
          :class="`dk2__link dk2__link--${l.tone}`"
          :style="`--i: ${n}`"
        >
          <path :d="l.d" pathLength="1" />
          <circle :cx="l.x" :cy="l.y" r="4" />
        </g>
      </svg>

      <section class="dk2__panel" aria-label="Read from the sample photo">
        <div class="dk2__id" data-row="id">
          <span class="dk2__k"><b>01</b>Container ID</span>
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
          <span class="dk2__meta">
            <CertaintyChip level="Confident" />
            <span class="qs-prov qs-prov--calculated">Check digit valid</span>
          </span>
        </div>
        <ol class="dk2__list">
          <li
            v-for="(p, n) in POINTERS.slice(1)"
            :key="p.key"
            class="dk2__row"
            :data-row="p.key"
            :style="`--i: ${n + 1}`"
          >
            <span class="dk2__k"
              ><b>0{{ n + 2 }}</b
              >{{ p.label }}</span
            >
            <b :class="['dk2__v', { dk2__plain: p.plain }]">{{ p.value }}</b>
            <CertaintyChip :level="p.certainty" />
          </li>
          <li class="dk2__row dk2__row--seal">
            <span class="dk2__k"><b>08</b>Seal</span>
            <b class="dk2__v dk2__plain">Not in this photo</b>
            <CertaintyChip level="Not seen" />
          </li>
        </ol>
      </section>

      <p class="dk2__sample">
        <i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded reading
      </p>
    </div>
  </main>
</template>

<style scoped>
/* The photo is hung so that its band from 22% to 66% fills the page height (--ph is the photo's full height)
   and its right-hand markings sit a little in from the right edge. Everything else is placed from the same
   numbers, so each rule ends exactly on the edge of its box. */
.dk2 {
  position: relative;
  flex: 1;
  min-height: 680px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  container-type: inline-size;
}
.dk2__in {
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

.dk2__photo {
  position: absolute;
  z-index: -2;
  left: var(--pl);
  top: var(--pt);
  width: var(--pw);
  height: var(--ph);
  margin: 0;
  animation: dk2-fade 1200ms ease-out both;
}
.dk2__photo img {
  display: block;
  width: 100%;
  height: 100%;
  filter: brightness(0.8) contrast(1.06) saturate(0.9);
}
.dk2__shade {
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
.dk2__box {
  --c: var(--cert-confident-line);
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--c);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--c) 9%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--landing-bg) 70%, transparent),
    0 0 14px color-mix(in srgb, var(--c) 60%, transparent);
  animation: dk2-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(700ms + var(--i) * 120ms);
}
.dk2__box--likely {
  --c: var(--cert-likely-line);
  border-style: dashed;
}
.dk2__box b {
  position: absolute;
  left: -2px;
  bottom: calc(100% + 3px);
  color: var(--landing-ink);
  font: 500 0.5625rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Top line */
.dk2__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.dk2__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.dk2__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
.dk2__demo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 1px solid color-mix(in srgb, var(--landing-ink) 45%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--landing-bg) 60%, transparent);
  color: var(--landing-ink);
  font: 600 0.875rem/1 var(--font-sans);
  backdrop-filter: blur(10px);
  cursor: pointer;
}
.dk2__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.dk2__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.dk2__demo svg {
  width: 16px;
  height: 16px;
}

/* Words */
.dk2__lead {
  align-self: center;
  box-sizing: border-box;
  width: calc(var(--list) - var(--space-5));
  max-width: 580px;
  padding: 0 0 var(--space-8) var(--edge);
  animation: dk2-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.dk2__title {
  margin: 0;
  font: 700 clamp(2.5rem, 4.3vw, 5.25rem)/0.98 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.dk2__title em {
  color: var(--brand);
  font-style: normal;
}
.dk2__sub {
  max-width: 28rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}

/* Readings, together in one glass panel over the photo's left edge */
.dk2__panel {
  position: absolute;
  left: var(--list);
  top: calc(var(--pt) + var(--ph) * 0.236);
  box-sizing: border-box;
  width: var(--panel);
  padding: var(--space-4) var(--space-4) var(--space-2);
  border: 1px solid color-mix(in srgb, var(--landing-ink) 16%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--landing-bg) 78%, transparent);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: var(--shadow-landing);
  animation: dk2-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 500ms both;
}
.dk2__k {
  display: flex;
  gap: var(--space-2);
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.dk2__k b {
  color: var(--brand);
  font-weight: 500;
}
.dk2__id {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
}
.dk2__id .qs-id {
  color: var(--landing-ink);
}
.dk2__id .qs-id__check {
  border-color: var(--landing-ink);
}
.dk2__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.dk2__meta .qs-prov {
  height: 26px;
  border-color: color-mix(in srgb, var(--landing-ink) 40%, transparent);
  color: var(--landing-ink-muted);
}
.dk2__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.dk2__row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 14%, transparent);
  animation: dk2-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(800ms + var(--i, 7) * 120ms);
}
.dk2__row :deep(.qs-cert) {
  grid-row: span 2;
  grid-column: 2;
}
.dk2__row .dk2__k {
  grid-column: 1;
}
.dk2__v {
  grid-column: 1;
  font: 500 1rem/1.25rem var(--font-mono);
  white-space: nowrap;
}
.dk2__v.dk2__plain {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}

/* Elbow rules from the panel to the edge of each box */
.dk2__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.dk2__link {
  --c: var(--cert-confident-line);
}
.dk2__link--likely {
  --c: var(--cert-likely-line);
}
.dk2__link path {
  fill: none;
  stroke: var(--c);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: dk2-rule 700ms ease-out both;
  animation-delay: calc(950ms + var(--i) * 120ms);
}
.dk2__link circle {
  fill: var(--c);
  filter: drop-shadow(0 0 4px var(--c));
  animation: dk2-fade 300ms ease-out both;
  animation-delay: calc(1500ms + var(--i) * 120ms);
}

.dk2__sample {
  position: absolute;
  right: var(--edge);
  bottom: var(--space-5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1 var(--font-sans);
}

@keyframes dk2-fade {
  from {
    opacity: 0;
  }
}
@keyframes dk2-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes dk2-box {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes dk2-rule {
  from {
    stroke-dashoffset: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dk2 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .dk2 {
    container-type: normal;
    min-height: 0;
  }
  .dk2__in {
    position: static;
    display: block;
  }
  .dk2__photo,
  .dk2__shade,
  .dk2__links {
    display: none;
  }
  .dk2__lead {
    width: auto;
    max-width: none;
    padding: var(--space-5) var(--edge);
  }
  .dk2__title {
    white-space: normal;
  }
  .dk2__panel,
  .dk2__sample {
    position: static;
    width: auto;
    margin: 0 var(--edge) var(--space-5);
  }
}
</style>
