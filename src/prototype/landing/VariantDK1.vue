<script setup lang="ts">
// PROTOTYPE variant DK1, "Dark pointers, faithful": VariantP3 with its faults put right. The sample photo is
// hung close on the right door leaf; every painted item is squared off with a tight outlined box, and a rule
// runs from each entry in the parts list, level with its paint, to the edge of its box. The container ID
// leads the list, set out as it is painted, with the check digit in its box. Night quay theme.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'
import { POINTERS, anchor, boxStyle, tone, useNightQuay } from './dkShared'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const setup = useSetupStore()
useNightQuay()

// The page's own height, measured: everything is hung from it.
const page = useTemplateRef<HTMLElement>('page')
const height = ref(844)
let observer: ResizeObserver | undefined
onMounted(() => {
  const measure = () => {
    if (page.value) height.value = page.value.clientHeight
  }
  measure()
  if (typeof ResizeObserver === 'function' && page.value) {
    observer = new ResizeObserver(measure)
    observer.observe(page.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main ref="page" class="dk1">
    <div class="dk1__in" :style="`--h: ${height}px`">
      <figure class="dk1__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-for="b in p.boxes"
            :key="b.box[0]"
            :class="['dk1__box', `dk1__box--${tone(p)}`]"
            :style="`--i: ${n}; ${boxStyle(b.box)}`"
            ><b v-if="b.caption">{{ b.caption }}</b></i
          >
        </template>
      </figure>
      <i class="dk1__shade" aria-hidden="true"></i>

      <header class="dk1__top">
        <p class="dk1__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <button type="button" class="dk1__demo" @click="setup.enterDemo()">
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

      <section class="dk1__lead">
        <h1 class="dk1__title">The whole <u>Quay</u>,<br />in <u>Sight</u>.</h1>
        <p class="dk1__sub">
          Markings read, check digit tested, damage mapped, hazards flagged. Every answer comes with
          how sure it is.
        </p>
        <ProtoKeyField :demo="false" />
      </section>

      <ol class="dk1__list" aria-label="Read from the sample photo">
        <li
          v-for="(p, n) in POINTERS"
          :key="p.key"
          :class="['dk1__row', `dk1__row--${tone(p)}`, { 'dk1__row--id': p.key === 'id' }]"
          :style="`--i: ${n}; --x: ${anchor(p).x}; --y: ${anchor(p).y}`"
        >
          <span class="dk1__n">0{{ n + 1 }}</span>
          <span v-if="p.key === 'id'" class="dk1__id">
            <span class="dk1__k">{{ p.label }}</span>
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
            <span class="dk1__meta">
              <CertaintyChip :level="p.certainty" />
              <span class="qs-prov qs-prov--calculated">Check digit valid</span>
            </span>
          </span>
          <template v-else>
            <span class="dk1__text">
              <span class="dk1__k">{{ p.label }}</span>
              <b :class="{ dk1__plain: p.plain }">{{ p.value }}</b>
            </span>
            <CertaintyChip :level="p.certainty" />
          </template>
          <i class="dk1__rule" aria-hidden="true"></i>
        </li>
      </ol>

      <p class="dk1__also">
        <span>Also looked for</span>
        <span><b>Seal</b><CertaintyChip level="Not seen" /></span>
        <span class="dk1__sample"
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
   numbers, so each rule ends exactly on the edge of its box. */
.dk1 {
  position: relative;
  flex: 1;
  min-height: 680px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  container-type: inline-size;
}
.dk1__in {
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

.dk1__photo {
  position: absolute;
  z-index: -2;
  left: var(--pl);
  top: var(--pt);
  width: var(--pw);
  height: var(--ph);
  margin: 0;
  animation: dk1-fade 1200ms ease-out both;
}
.dk1__photo img {
  display: block;
  width: 100%;
  height: 100%;
  filter: brightness(0.8) contrast(1.06) saturate(0.9);
}
.dk1__shade {
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
  pointer-events: none;
}

/* Each painted item squared off: a solid outline in its certainty colour, a faint tint and a glow */
.dk1__box {
  --c: var(--cert-confident-line);
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--c);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--c) 9%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--landing-bg) 70%, transparent),
    0 0 14px color-mix(in srgb, var(--c) 60%, transparent);
  animation: dk1-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(700ms + var(--i) * 120ms);
}
.dk1__box--likely {
  --c: var(--cert-likely-line);
  border-style: dashed;
}
.dk1__box b {
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
.dk1__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.dk1__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.dk1__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
.dk1__demo {
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
.dk1__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.dk1__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.dk1__demo svg {
  width: 16px;
  height: 16px;
}

/* Words */
.dk1__lead {
  align-self: center;
  box-sizing: border-box;
  width: calc(var(--list) - var(--space-6));
  max-width: 600px;
  padding: 0 0 var(--space-8) var(--edge);
  animation: dk1-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.dk1__title {
  margin: 0;
  font: 700 clamp(2.75rem, 4.9vw, 5.75rem)/1.04 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.dk1__title u {
  text-decoration: underline;
  text-decoration-color: var(--brand);
  text-decoration-thickness: 0.085em;
  text-underline-offset: 0.11em;
  text-decoration-skip-ink: none;
}
.dk1__sub {
  max-width: 28rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}

/* Parts list: each entry level with its paint, a rule running to the edge of its box */
.dk1__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.dk1__row {
  --c: var(--cert-confident-line);
  position: absolute;
  left: var(--list);
  top: calc(var(--pt) + var(--ph) * var(--y));
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: calc(var(--pl) + var(--pw) * var(--x) - var(--list));
  translate: 0 -50%;
  animation: dk1-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(800ms + var(--i) * 120ms);
}
.dk1__row--likely {
  --c: var(--cert-likely-line);
}
.dk1__n {
  color: var(--brand);
  font: 500 0.75rem/1 var(--font-mono);
}
.dk1__text {
  display: grid;
  flex: none;
  width: 9.25rem;
}
.dk1__k {
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.dk1__text b {
  font: 500 1rem/1.25rem var(--font-mono);
  white-space: nowrap;
}
.dk1__text b.dk1__plain {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}

/* The container ID leads: set out as painted, check digit boxed */
.dk1__id {
  display: grid;
  flex: none;
  justify-items: start;
  gap: var(--space-1);
}
.dk1__id .qs-id {
  color: var(--landing-ink);
}
.dk1__id .qs-id__check {
  border-color: var(--landing-ink);
}
.dk1__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.dk1__meta .qs-prov {
  height: 26px;
  border-color: color-mix(in srgb, var(--landing-ink) 40%, transparent);
  color: var(--landing-ink-muted);
}

.dk1__rule {
  position: relative;
  flex: 1;
  min-width: var(--space-4);
  height: 1.5px;
  background: var(--c);
  transform-origin: left;
  animation: dk1-rule var(--duration-arrive) ease-out both;
  animation-delay: calc(950ms + var(--i) * 120ms);
}
.dk1__rule::after {
  content: '';
  position: absolute;
  right: -3px;
  top: -3px;
  width: 7.5px;
  height: 7.5px;
  border-radius: var(--radius-pill);
  background: var(--c);
  box-shadow: 0 0 8px var(--c);
}

.dk1__also {
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
.dk1__also span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.dk1__also b {
  color: var(--landing-ink);
  font-weight: 500;
}
.dk1__also :deep(.qs-cert) {
  letter-spacing: 0.01em;
  text-transform: none;
}
.dk1__also .dk1__sample {
  margin-left: auto;
  letter-spacing: 0;
  text-transform: none;
  font: 400 0.8125rem/1 var(--font-sans);
}

@keyframes dk1-fade {
  from {
    opacity: 0;
  }
}
@keyframes dk1-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes dk1-box {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes dk1-rule {
  from {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dk1 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .dk1 {
    container-type: normal;
    min-height: 0;
  }
  .dk1__in {
    position: static;
    display: block;
  }
  .dk1__photo,
  .dk1__shade,
  .dk1__rule {
    display: none;
  }
  .dk1__lead {
    width: auto;
    max-width: none;
    padding: var(--space-5) var(--edge);
  }
  .dk1__title {
    white-space: normal;
  }
  .dk1__list {
    display: grid;
    gap: var(--space-3);
    padding: 0 var(--edge);
  }
  .dk1__row,
  .dk1__also {
    position: static;
    width: auto;
    translate: none;
  }
  .dk1__also {
    padding: var(--space-5) var(--edge);
  }
}
</style>
