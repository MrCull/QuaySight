<script setup lang="ts">
// PROTOTYPE variant DK3, "Dark pointers, live": DK1's layout made to answer. Pointing at, or tabbing to, a
// reading lights its box on the photo and dims the rest, and pointing at a box does the same for its reading;
// on load the boxes arrive in reading order with their rows. Plain headline under a larger logo. Night quay.
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'
import { POINTERS, anchor, boxStyle, tone, useNightQuay } from './dkShared'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'

const setup = useSetupStore()
useNightQuay()

// The reading being pointed at, from either side: its row in the list or its box on the photo.
const active = ref<string | null>(null)

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
  <main ref="page" class="dk3">
    <div class="dk3__in" :style="`--h: ${height}px`">
      <figure class="dk3__photo" aria-hidden="true">
        <img :src="doors" alt="" />
        <template v-for="(p, n) in POINTERS" :key="p.key">
          <i
            v-for="b in p.boxes"
            :key="b.box[0]"
            :class="[
              'dk3__box',
              `dk3__box--${tone(p)}`,
              { 'is-on': active === p.key, 'is-off': active !== null && active !== p.key },
            ]"
            :style="`--i: ${n}; ${boxStyle(b.box)}`"
            @pointerenter="active = p.key"
            @pointerleave="active = null"
            ><b v-if="b.caption">{{ b.caption }}</b></i
          >
        </template>
      </figure>
      <i class="dk3__shade" aria-hidden="true"></i>

      <header class="dk3__top">
        <p class="dk3__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <button type="button" class="dk3__demo" @click="setup.enterDemo()">
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

      <section class="dk3__lead">
        <h1 class="dk3__title">The whole Quay,<br />in Sight.</h1>
        <p class="dk3__sub">
          Photograph a container and get an inspection, not a transcript: ID checked, weights read,
          damage mapped, doubt stated.
        </p>
        <ProtoKeyField :demo="false" />
      </section>

      <ol class="dk3__list" aria-label="Read from the sample photo">
        <li
          v-for="(p, n) in POINTERS"
          :key="p.key"
          :class="[
            'dk3__row',
            `dk3__row--${tone(p)}`,
            {
              'dk3__row--id': p.key === 'id',
              'is-on': active === p.key,
              'is-off': active !== null && active !== p.key,
            },
          ]"
          :style="`--i: ${n}; --x: ${anchor(p).x}; --y: ${anchor(p).y}`"
          tabindex="0"
          @pointerenter="active = p.key"
          @pointerleave="active = null"
          @focus="active = p.key"
          @blur="active = null"
        >
          <span class="dk3__n">0{{ n + 1 }}</span>
          <span v-if="p.key === 'id'" class="dk3__id">
            <span class="dk3__k">{{ p.label }}</span>
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
            <span class="dk3__meta">
              <CertaintyChip :level="p.certainty" />
              <span class="qs-prov qs-prov--calculated">Check digit valid</span>
            </span>
          </span>
          <template v-else>
            <span class="dk3__text">
              <span class="dk3__k">{{ p.label }}</span>
              <b :class="{ dk3__plain: p.plain }">{{ p.value }}</b>
            </span>
            <CertaintyChip :level="p.certainty" />
          </template>
          <i class="dk3__rule" aria-hidden="true"></i>
        </li>
      </ol>

      <p class="dk3__also">
        <span>Point at a reading</span>
        <span>Also looked for</span>
        <span><b>Seal</b><CertaintyChip level="Not seen" /></span>
        <span class="dk3__sample"
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
.dk3 {
  position: relative;
  flex: 1;
  min-height: 680px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  container-type: inline-size;
}
.dk3__in {
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

.dk3__photo {
  position: absolute;
  z-index: -2;
  left: var(--pl);
  top: var(--pt);
  width: var(--pw);
  height: var(--ph);
  margin: 0;
  animation: dk3-fade 1200ms ease-out both;
}
.dk3__photo img {
  display: block;
  width: 100%;
  height: 100%;
  filter: brightness(0.8) contrast(1.06) saturate(0.9);
}
.dk3__shade {
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
.dk3__box {
  --c: var(--cert-confident-line);
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--c);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--c) 9%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--landing-bg) 70%, transparent),
    0 0 14px color-mix(in srgb, var(--c) 60%, transparent);
  animation: dk3-box var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(700ms + var(--i) * 120ms);
}
.dk3__box--likely {
  --c: var(--cert-likely-line);
  border-style: dashed;
}
.dk3__box b {
  position: absolute;
  left: -2px;
  bottom: calc(100% + 3px);
  color: var(--landing-ink);
  font: 500 0.5625rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}

.dk3__box {
  cursor: default;
  transition:
    opacity var(--duration-base),
    background-color var(--duration-base),
    box-shadow var(--duration-base);
}
.dk3__box.is-on {
  background: color-mix(in srgb, var(--c) 26%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--landing-bg) 70%, transparent),
    0 0 26px var(--c);
}
.dk3__box.is-off {
  opacity: 0.22;
}

/* Top line */
.dk3__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.dk3__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2.75rem/1 var(--font-hero);
  letter-spacing: -0.035em;
}
.dk3__brand .qs-logo {
  width: 64px;
  height: 64px;
  color: var(--brand);
}
.dk3__demo {
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
.dk3__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.dk3__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.dk3__demo svg {
  width: 16px;
  height: 16px;
}

/* Words */
.dk3__lead {
  align-self: center;
  box-sizing: border-box;
  width: calc(var(--list) - var(--space-6));
  max-width: 600px;
  padding: 0 0 var(--space-8) var(--edge);
  animation: dk3-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.dk3__title {
  margin: 0;
  font: 700 clamp(2.75rem, 5.1vw, 6rem)/0.96 var(--font-hero);
  letter-spacing: -0.05em;
  white-space: nowrap;
}
.dk3__sub {
  max-width: 28rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.0625rem/1.625rem var(--font-sans);
  text-wrap: pretty;
}

/* Parts list: each entry level with its paint, a rule running to the edge of its box */
.dk3__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.dk3__row {
  --c: var(--cert-confident-line);
  position: absolute;
  left: var(--list);
  top: calc(var(--pt) + var(--ph) * var(--y));
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: calc(var(--pl) + var(--pw) * var(--x) - var(--list));
  translate: 0 -50%;
  animation: dk3-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(800ms + var(--i) * 120ms);
}
.dk3__row {
  padding-block: var(--space-1);
  outline: 0;
  cursor: default;
  transition: opacity var(--duration-base);
}
.dk3__row.is-off {
  opacity: 0.32;
}
.dk3__row.is-on .dk3__rule {
  height: 2.5px;
  box-shadow: 0 0 10px var(--c);
}
.dk3__row:focus-visible .dk3__n {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
}
.dk3__row--likely {
  --c: var(--cert-likely-line);
}
.dk3__n {
  color: var(--brand);
  font: 500 0.75rem/1 var(--font-mono);
}
.dk3__text {
  display: grid;
  flex: none;
  width: 9.25rem;
}
.dk3__k {
  color: var(--landing-ink-muted);
  font: 500 0.625rem/0.875rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.dk3__text b {
  font: 500 1rem/1.25rem var(--font-mono);
  white-space: nowrap;
}
.dk3__text b.dk3__plain {
  font: 600 0.9375rem/1.25rem var(--font-sans);
}

/* The container ID leads: set out as painted, check digit boxed */
.dk3__id {
  display: grid;
  flex: none;
  justify-items: start;
  gap: var(--space-1);
}
.dk3__id .qs-id {
  color: var(--landing-ink);
}
.dk3__id .qs-id__check {
  border-color: var(--landing-ink);
}
.dk3__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}
.dk3__meta .qs-prov {
  height: 26px;
  border-color: color-mix(in srgb, var(--landing-ink) 40%, transparent);
  color: var(--landing-ink-muted);
}

.dk3__rule {
  position: relative;
  flex: 1;
  min-width: var(--space-4);
  height: 1.5px;
  background: var(--c);
  transform-origin: left;
  animation: dk3-rule var(--duration-arrive) ease-out both;
  animation-delay: calc(950ms + var(--i) * 120ms);
}
.dk3__rule::after {
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

.dk3__also {
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
.dk3__also span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.dk3__also b {
  color: var(--landing-ink);
  font-weight: 500;
}
.dk3__also :deep(.qs-cert) {
  letter-spacing: 0.01em;
  text-transform: none;
}
.dk3__also .dk3__sample {
  margin-left: auto;
  letter-spacing: 0;
  text-transform: none;
  font: 400 0.8125rem/1 var(--font-sans);
}

@keyframes dk3-fade {
  from {
    opacity: 0;
  }
}
@keyframes dk3-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@keyframes dk3-box {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes dk3-rule {
  from {
    transform: scaleX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dk3 * {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 1000px) {
  .dk3 {
    container-type: normal;
    min-height: 0;
  }
  .dk3__in {
    position: static;
    display: block;
  }
  .dk3__photo,
  .dk3__shade,
  .dk3__rule {
    display: none;
  }
  .dk3__lead {
    width: auto;
    max-width: none;
    padding: var(--space-5) var(--edge);
  }
  .dk3__title {
    white-space: normal;
  }
  .dk3__list {
    display: grid;
    gap: var(--space-3);
    padding: 0 var(--edge);
  }
  .dk3__row,
  .dk3__also {
    position: static;
    width: auto;
    translate: none;
  }
  .dk3__also {
    padding: var(--space-5) var(--edge);
  }
}
</style>
