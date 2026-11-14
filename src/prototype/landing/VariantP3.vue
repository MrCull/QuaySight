<script setup lang="ts">
// PROTOTYPE variant P3, "Pointers, parts list": a dark page. The sample photo is hung close on the right
// door leaf, bleeding off the page; each line of paint has a thin rule running left from it to its entry in
// a mono parts list, level with where it is painted. Words and the key field stand on the left.
// It forces the Night quay theme while it is on screen.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'
import type { CertaintyLabel } from '../../domain/inspection'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const setup = useSetupStore()

// x, y: where the rule meets the paint, as fractions of the photo. box: the outlined area (left, top, width, height).
interface Pointer {
  label: string
  value: string
  certainty: CertaintyLabel
  x: number
  y: number
  box: [number, number, number, number]
  plain?: boolean
}
const POINTERS: Pointer[] = [
  {
    label: 'Container ID',
    value: 'JDLU 200690 2',
    certainty: 'Confident',
    x: 0.584,
    y: 0.288,
    box: [0.584, 0.265, 0.262, 0.047],
  },
  {
    label: 'Size and type',
    value: '22G1',
    certainty: 'Confident',
    x: 0.686,
    y: 0.3305,
    box: [0.686, 0.314, 0.098, 0.033],
  },
  {
    label: 'Max gross',
    value: '32,500 kg',
    certainty: 'Confident',
    x: 0.558,
    y: 0.3825,
    box: [0.558, 0.366, 0.264, 0.033],
  },
  {
    label: 'Tare',
    value: '2,180 kg',
    certainty: 'Confident',
    x: 0.558,
    y: 0.4175,
    box: [0.558, 0.401, 0.264, 0.033],
  },
  {
    label: 'Payload',
    value: '30,320 kg',
    certainty: 'Confident',
    x: 0.558,
    y: 0.4525,
    box: [0.558, 0.436, 0.264, 0.033],
  },
  {
    label: 'Cubic capacity',
    value: '33.2 m³',
    certainty: 'Confident',
    x: 0.566,
    y: 0.4955,
    box: [0.566, 0.476, 0.264, 0.039],
  },
  {
    label: 'Marking',
    value: 'Super heavy',
    certainty: 'Likely',
    x: 0.736,
    y: 0.587,
    box: [0.736, 0.55, 0.094, 0.074],
    plain: true,
  },
]
const pct = (n: number) => `${(n * 100).toFixed(2)}%`

// The page's own height, measured: everything is hung from it.
const page = useTemplateRef<HTMLElement>('page')
const height = ref(844)
let observer: ResizeObserver | undefined

let before: string | null = null
onMounted(() => {
  const measure = () => {
    if (page.value) height.value = page.value.clientHeight
  }
  measure()
  if (typeof ResizeObserver === 'function' && page.value) {
    observer = new ResizeObserver(measure)
    observer.observe(page.value)
  }
  before = document.documentElement.getAttribute('data-theme')
  document.documentElement.setAttribute('data-theme', 'dark')
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (before) document.documentElement.setAttribute('data-theme', before)
  else document.documentElement.removeAttribute('data-theme')
})
</script>

<template>
  <main ref="page" class="lp3">
    <div class="lp3__in" :style="`--h: ${height}px`">
      <figure class="lp3__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <i
          v-for="(p, n) in POINTERS"
          :key="p.label"
          :class="['lp3__box', `lp3__box--${p.certainty === 'Likely' ? 'likely' : 'confident'}`]"
          :style="`--i: ${n}; left: ${pct(p.box[0])}; top: ${pct(p.box[1])}; width: ${pct(p.box[2])}; height: ${pct(p.box[3])}`"
        ></i>
      </figure>
      <i class="lp3__shade" aria-hidden="true"></i>

      <header class="lp3__top">
        <p class="lp3__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <button type="button" class="lp3__demo" @click="setup.enterDemo()">
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

      <section class="lp3__lead">
        <h1 class="lp3__title">Look once.<br />Know the box.</h1>
        <p class="lp3__sub">
          One photo of the doors. Quay Sight reads each line of paint, shows where it read it, and
          tells you how sure it is.
        </p>
        <ProtoKeyField :demo="false" />
      </section>

      <ol class="lp3__list" aria-label="Read from the sample photo">
        <li
          v-for="(p, n) in POINTERS"
          :key="p.label"
          :class="`lp3__row lp3__row--${p.certainty === 'Likely' ? 'likely' : 'confident'}`"
          :style="`--i: ${n}; --x: ${p.x}; --y: ${p.y}`"
        >
          <span class="lp3__n">0{{ n + 1 }}</span>
          <span class="lp3__text">
            <span class="lp3__k">{{ p.label }}</span>
            <b :class="{ lp3__plain: p.plain }">{{ p.value }}</b>
          </span>
          <CertaintyChip :level="p.certainty" />
          <i class="lp3__rule" aria-hidden="true"></i>
        </li>
      </ol>

      <p class="lp3__also">
        <span>Also looked for</span>
        <span><b>CSC plate</b><CertaintyChip level="Can't tell" /></span>
        <span><b>Seal</b><CertaintyChip level="Not seen" /></span>
        <span class="lp3__sample"
          ><i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Sample photo, recorded
          reading</span
        >
      </p>
    </div>
  </main>
</template>

<style scoped>
/* The photo is hung so that its band from 22% to 66% fills the page height (--ph is the photo's full height)
   and its right-hand markings sit a little in from the right edge. Everything else is placed from the same
   numbers, so the rules always meet the paint. */
.lp3 {
  position: relative;
  flex: 1;
  min-height: 680px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  container-type: inline-size;
}
.lp3__in {
  --ph: calc(var(--h) / 0.44);
  --pw: calc(var(--ph) * 0.75);
  --pl: calc(93cqw - var(--pw) * 0.85);
  --pt: calc(var(--ph) * -0.22);
  --list: max(41cqw, 600px);
  --edge: clamp(var(--space-5), 4.4vw, calc(var(--space-8) * 1.25));
  --lp-align: start;
  --lp-field-width: 500px;
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

.lp3__photo {
  position: absolute;
  z-index: -2;
  left: var(--pl);
  top: var(--pt);
  width: var(--pw);
  height: var(--ph);
  margin: 0;
  animation: lp3-fade 1200ms ease-out both;
}
.lp3__photo img {
  display: block;
  width: 100%;
  height: 100%;
  filter: brightness(0.82) contrast(1.06) saturate(0.9);
}
.lp3__shade {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      var(--landing-bg) calc(var(--list) - 6cqw),
      color-mix(in srgb, var(--landing-bg) 90%, transparent) calc(var(--list) + 12cqw),
      color-mix(in srgb, var(--landing-bg) 30%, transparent) calc(var(--pl) + var(--pw) * 0.55),
      transparent calc(var(--pl) + var(--pw) * 0.62)
    ),
    linear-gradient(0deg, var(--landing-bg), transparent 16%);
}
.lp3__box {
  --c: var(--cert-confident-line);
  position: absolute;
  background:
    linear-gradient(var(--c), var(--c)) 0 0 / 8px 2px,
    linear-gradient(var(--c), var(--c)) 0 0 / 2px 8px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 8px 2px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 2px 8px,
    linear-gradient(var(--c), var(--c)) 0 100% / 8px 2px,
    linear-gradient(var(--c), var(--c)) 0 100% / 2px 8px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 8px 2px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 2px 8px;
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 3px var(--c));
  animation: lp3-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(700ms + var(--i) * 120ms);
}
.lp3__box--likely {
  --c: var(--cert-likely-line);
}

/* Top line */
.lp3__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.lp3__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lp3__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
.lp3__demo {
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
.lp3__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.lp3__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.lp3__demo svg {
  width: 16px;
  height: 16px;
}

/* Words */
.lp3__lead {
  align-self: center;
  box-sizing: border-box;
  width: calc(var(--list) - var(--space-6));
  max-width: 600px;
  padding: 0 0 var(--space-8) var(--edge);
  animation: lp3-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.lp3__title {
  margin: 0;
  font: 700 clamp(2.75rem, 5.3vw, 6rem)/0.94 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.lp3__sub {
  max-width: 28rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}

/* Parts list: each entry level with its paint, a rule running to it */
.lp3__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.lp3__row {
  --c: var(--cert-confident-line);
  position: absolute;
  left: var(--list);
  top: calc(var(--pt) + var(--ph) * var(--y));
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: calc(var(--pl) + var(--pw) * var(--x) - var(--list) - 4px);
  translate: 0 -50%;
  animation: lp3-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(800ms + var(--i) * 120ms);
}
.lp3__row--likely {
  --c: var(--cert-likely-line);
}
.lp3__n {
  color: var(--brand);
  font: 500 0.75rem/1 var(--font-mono);
}
.lp3__text {
  display: grid;
  flex: none;
  width: 9.25rem;
}
.lp3__k {
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lp3__text b {
  font: 500 1rem/1.25rem var(--font-mono);
  white-space: nowrap;
}
.lp3__text b.lp3__plain {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}
.lp3__rule {
  position: relative;
  flex: 1;
  min-width: var(--space-4);
  height: 1px;
  background: var(--c);
  transform-origin: left;
  animation: lp3-rule var(--duration-arrive) ease-out both;
  animation-delay: calc(950ms + var(--i) * 120ms);
}
.lp3__rule::after {
  content: '';
  position: absolute;
  right: -3px;
  top: -3px;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--c);
}

.lp3__also {
  position: absolute;
  left: var(--list);
  right: var(--edge);
  bottom: var(--space-5);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
  margin: 0;
  color: var(--landing-ink-muted);
  font: 500 0.6875rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lp3__also span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.lp3__also b {
  color: var(--landing-ink);
  font-weight: 500;
}
.lp3__also :deep(.qs-cert) {
  letter-spacing: 0.01em;
  text-transform: none;
}
.lp3__also .lp3__sample {
  margin-left: auto;
  letter-spacing: 0;
  text-transform: none;
  font: 400 0.8125rem/1 var(--font-sans);
}

@keyframes lp3-fade {
  from {
    opacity: 0;
  }
}
@keyframes lp3-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes lp3-box {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes lp3-rule {
  from {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp3 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lp3 {
    container-type: normal;
    min-height: 0;
  }
  .lp3__in {
    position: static;
    display: block;
  }
  .lp3__photo,
  .lp3__shade,
  .lp3__rule {
    display: none;
  }
  .lp3__lead {
    width: auto;
    max-width: none;
    padding: var(--space-5) var(--edge);
  }
  .lp3__title {
    white-space: normal;
  }
  .lp3__list {
    display: grid;
    gap: var(--space-3);
    padding: 0 var(--edge);
  }
  .lp3__row,
  .lp3__also {
    position: static;
    width: auto;
    translate: none;
  }
  .lp3__also {
    padding: var(--space-5) var(--edge);
  }
}
</style>
