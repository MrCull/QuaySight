<script setup lang="ts">
// PROTOTYPE variant E, "Long read": a scrolling page. First screen: the name, the headline, the key field and
// the gate picture in a wide window. Below: what is read, each with the crop it was read from; the five
// certainty words; and the facts about keys and cost.
import { useTemplateRef } from 'vue'
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import SeverityBadge from '../../components/damage/SeverityBadge.vue'
import { useSetupStore } from '../../stores/setup'
import type { CertaintyLabel } from '../../domain/inspection'
import gate from './assets/gate.jpg'
import seal from '../../../samples/seal-closeup-coyu-0154620.jpg'
import torn from '../../../samples/corner-torn-door-cai-20ft.jpg'

const setup = useSetupStore()
const field = useTemplateRef<{ focus: () => void }>('field')
function toKey() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  field.value?.focus()
}

// A 16:9 window onto part of a photo: left, top and width as fractions of the image; ratio is height / width.
const crop = (l: number, t: number, w: number, ratio: number) =>
  `width: ${100 / w}%; left: ${(-l / w) * 100}%; top: ${((-t * ratio * (16 / 9)) / w) * 100}%`
const GATE = 1354 / 1161

interface Reading {
  glyph: string
  label: string
  value: string
  note: string
  src: string
  crop: string
  certainty?: CertaintyLabel
  mono?: boolean
}
const READINGS: Reading[] = [
  {
    glyph: 'tag',
    label: 'Container ID',
    value: 'CMAU 210375 8',
    note: 'The painted check digit is 8. The number works out to 9, so it says so.',
    src: gate,
    crop: crop(0.535, 0.295, 0.21, GATE),
    certainty: 'Uncertain',
    mono: true,
  },
  {
    glyph: 'container',
    label: 'Size and type',
    value: '22G1',
    note: '20 ft long, 8 ft 6 in high, general purpose.',
    src: gate,
    crop: crop(0.585, 0.325, 0.13, GATE),
    certainty: 'Confident',
    mono: true,
  },
  {
    glyph: 'weight',
    label: 'Weights',
    value: '30,480 kg',
    note: 'Max gross, with tare, net and cubic capacity.',
    src: gate,
    crop: crop(0.52, 0.39, 0.25, GATE),
    certainty: 'Confident',
    mono: true,
  },
  {
    glyph: 'padlock',
    label: 'Seal',
    value: '0154620',
    note: 'Read when a close-up photo shows the seal.',
    src: seal,
    crop: crop(0.08, 0.075, 0.74, 2556 / 1179),
    certainty: 'Confident',
    mono: true,
  },
  {
    glyph: 'hazard',
    label: 'Placards and markings',
    value: 'Super heavy',
    note: 'Caution marking. No DG placard visible.',
    src: gate,
    crop: crop(0.595, 0.545, 0.13, GATE),
    certainty: 'Likely',
  },
  {
    glyph: 'eye',
    label: 'Damage',
    value: 'Apparent tear, door',
    note: 'Marked on a flat drawing of the container, with a severity.',
    src: torn,
    crop: crop(0.1, 0.4, 0.62, 3 / 4),
  },
]

const LEVELS: { level: CertaintyLabel; meaning: string }[] = [
  { level: 'Confident', meaning: 'Clearly visible, and everything checks out.' },
  { level: 'Likely', meaning: 'Probably right, but not certain.' },
  { level: 'Uncertain', meaning: 'Could be one of a few things. The alternatives are shown.' },
  { level: "Can't tell", meaning: 'In the photo, but not clear enough to say.' },
  { level: 'Not seen', meaning: 'Not in any photo, so nothing can be said about it.' },
]

const FACTS = [
  [
    '0',
    'servers of ours',
    'A static page. Photos go from this tab to the provider you choose, and nowhere else.',
  ],
  [
    '$0.50',
    'spend cap',
    'Each container inspection stops at 50 requests or $0.50. The running cost stays on screen.',
  ],
  ['1–5', 'photos', 'Of one container. The inspection starts as soon as you choose them.'],
  ['2', 'providers', 'OpenRouter or OpenAI, one model at a time. Your key is kept in memory only.'],
]
</script>

<template>
  <main class="le">
    <section class="le__hero">
      <nav class="le__nav">
        <p class="le__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
        <ul>
          <li><a href="#le-reads">What it reads</a></li>
          <li><a href="#le-sure">How sure it is</a></li>
          <li><a href="#le-key">Your key</a></li>
        </ul>
        <button type="button" class="le__ghost" @click="setup.enterDemo()">Try the demo</button>
      </nav>
      <div class="le__lead">
        <h1 class="le__title">Everything a container says about itself.</h1>
        <p class="le__sub">
          Quay Sight reads the markings from your photos, marks the damage it suspects, and tells
          you how sure it is of each one.
        </p>
        <ProtoKeyField ref="field" />
      </div>
      <div class="le__window">
        <GateScene class="le__scene" :fy="0.115" />
      </div>
    </section>

    <section id="le-reads" class="le__band">
      <header class="le__head">
        <p>What it reads</p>
        <h2>It shows you where it read each one.</h2>
      </header>
      <ul class="le__grid">
        <li v-for="r in READINGS" :key="r.label" class="le__tile">
          <span class="le__crop"><img :src="r.src" alt="" :style="r.crop" /></span>
          <h3><i :class="`qs-glyph qs-glyph--${r.glyph}`" aria-hidden="true"></i>{{ r.label }}</h3>
          <p :class="['le__value', { 'le__value--mono': r.mono }]">{{ r.value }}</p>
          <p class="le__note">{{ r.note }}</p>
          <CertaintyChip v-if="r.certainty" :level="r.certainty" />
          <SeverityBadge v-else severity="major" />
        </li>
      </ul>
      <p class="le__sample">Sample pictures, with example readings.</p>
    </section>

    <section id="le-sure" class="le__band le__band--ink">
      <header class="le__head">
        <p>How sure it is</p>
        <h2>It tells you when it isn't sure.</h2>
        <blockquote>
          <b>Best interpretation:</b> 3,750 kg. <b>What remains uncertain:</b> the last digits are
          hard to read; it could be 3,780 kg.
        </blockquote>
      </header>
      <dl class="le__levels">
        <div v-for="l in LEVELS" :key="l.level">
          <dt><CertaintyChip :level="l.level" /></dt>
          <dd>{{ l.meaning }}</dd>
        </div>
      </dl>
    </section>

    <section id="le-key" class="le__band">
      <header class="le__head">
        <p>Your key</p>
        <h2>It goes to your provider, and nowhere else.</h2>
      </header>
      <ul class="le__facts">
        <li v-for="[figure, unit, text] in FACTS" :key="unit">
          <b>{{ figure }}</b>
          <span>{{ unit }}</span>
          <p>{{ text }}</p>
        </li>
      </ul>
    </section>

    <section class="le__close">
      <i class="qs-logo" aria-hidden="true"></i>
      <h2>Start with a photo of the doors.</h2>
      <p>Observations and estimates. Not a certified survey.</p>
      <div>
        <button type="button" class="le__solid" @click="toKey">Paste an API key</button>
        <button type="button" class="le__ghost" @click="setup.enterDemo()">Try the demo</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.le {
  --gutter: clamp(var(--space-5), 6vw, calc(var(--space-7) * 2.5));
  flex: 1;
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* First screen */
.le__hero {
  display: grid;
  grid-template-rows: auto auto 1fr;
  height: 100vh;
  min-height: 780px;
  overflow: hidden;
}
.le__nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--space-5) var(--gutter);
}
.le__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.le__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.le__nav ul {
  display: flex;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}
.le__nav a {
  color: var(--landing-ink-muted);
  font: 500 0.9375rem/1 var(--font-sans);
  text-decoration: none;
}
.le__nav a:hover {
  color: var(--landing-ink);
}
.le__ghost,
.le__solid {
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 1.5px solid var(--landing-ink);
  border-radius: var(--radius-pill);
  background: none;
  color: var(--landing-ink);
  font: 600 0.875rem/1 var(--font-sans);
  cursor: pointer;
}
.le__nav .le__ghost {
  justify-self: end;
}
.le__solid {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.le__ghost:focus-visible,
.le__solid:focus-visible,
.le__nav a:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.le__lead {
  display: grid;
  justify-items: center;
  padding: clamp(var(--space-4), 3vh, var(--space-7)) var(--gutter) var(--space-6);
  text-align: center;
}
.le__title {
  max-width: 12em;
  margin: 0 0 var(--space-4);
  font: 700 clamp(2.75rem, 6.2vw, 7rem)/0.94 var(--font-hero);
  letter-spacing: -0.05em;
  text-wrap: balance;
}
.le__sub {
  max-width: 36rem;
  margin: 0 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
.le__lead :deep(.lp-key__note) {
  justify-content: center;
}
.le__window {
  margin: 0 var(--gutter);
  overflow: hidden;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-landing);
  animation: le-rise 1100ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.le__scene {
  height: 100%;
}

/* Bands */
.le__band {
  padding: clamp(var(--space-8), 10vw, calc(var(--space-7) * 3)) var(--gutter);
}
.le__band--ink {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-8);
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.le__head > p {
  margin: 0 0 var(--space-4);
  font: 500 0.8125rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
}
.le__head h2,
.le__close h2 {
  max-width: 18em;
  margin: 0;
  font: 700 clamp(2rem, 3.8vw, 4rem)/1 var(--font-hero);
  letter-spacing: -0.045em;
  text-wrap: balance;
}

/* What it reads */
.le__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  margin: var(--space-7) 0 0;
  padding: 0;
  list-style: none;
}
.le__tile {
  display: grid;
  justify-items: start;
  align-content: start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--landing-surface);
}
.le__tile > :not(.le__crop) {
  margin-inline: var(--space-3);
}
.le__crop {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: var(--space-3);
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--surface-sunken);
}
.le__crop img {
  position: absolute;
  max-width: none;
}
.le__tile h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-block: 0;
  color: var(--landing-ink-muted);
  font: 600 0.75rem/1.25rem var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.le__tile h3 .qs-glyph--hazard {
  color: var(--hazard-fg);
}
.le__value {
  margin-block: 0;
  font: 600 1.5rem/2rem var(--font-sans);
}
.le__value--mono {
  font: 500 1.625rem/2rem var(--font-mono);
  letter-spacing: 0.02em;
}
.le__note {
  margin-block: 0 var(--space-2);
  color: var(--landing-ink-muted);
  font: 400 0.9375rem/1.375rem var(--font-sans);
}
.le__sample {
  margin: var(--space-5) 0 0;
  color: var(--landing-ink-muted);
  font: 400 0.875rem/1.25rem var(--font-sans);
}

/* How sure it is */
.le__head blockquote {
  max-width: 30rem;
  margin: var(--space-7) 0 0;
  padding-left: var(--space-5);
  border-left: 2px solid currentColor;
  font: 400 1.125rem/1.75rem var(--font-sans);
  opacity: 0.86;
}
.le__levels {
  display: grid;
  align-content: center;
  margin: 0;
}
.le__levels div {
  display: grid;
  grid-template-columns: 132px 1fr;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-5) 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-on-ink) 22%, transparent);
}
.le__levels div:last-child {
  border-bottom: 1px solid color-mix(in srgb, var(--landing-on-ink) 22%, transparent);
}
.le__levels dd {
  margin: 0;
  font: 400 1.125rem/1.625rem var(--font-sans);
}

/* Your key */
.le__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-6);
  margin: var(--space-7) 0 0;
  padding: 0;
  list-style: none;
}
.le__facts li {
  padding-top: var(--space-4);
  border-top: 1.5px solid var(--landing-ink);
}
.le__facts b {
  display: block;
  font: 500 clamp(2.5rem, 4.4vw, 4.5rem)/1 var(--font-mono);
  letter-spacing: -0.03em;
}
.le__facts span {
  display: block;
  margin: var(--space-2) 0 var(--space-3);
  font: 600 0.8125rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.le__facts p {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.9375rem/1.5rem var(--font-sans);
}

/* Close */
.le__close {
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  padding: 0 var(--gutter) clamp(var(--space-8), 9vw, calc(var(--space-8) * 2));
  text-align: center;
}
.le__close .qs-logo {
  width: 72px;
  height: 72px;
  color: inherit;
}
.le__close p {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 1rem/1.5rem var(--font-sans);
}
.le__close div {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.le__close button {
  height: var(--control-lg);
  padding: 0 var(--space-5);
}

@keyframes le-rise {
  from {
    opacity: 0;
    transform: translateY(60px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .le * {
    animation: none !important;
  }
}
@media (max-width: 900px) {
  .le__nav ul {
    display: none;
  }
  .le__nav {
    grid-template-columns: 1fr auto;
  }
  .le__grid,
  .le__band--ink {
    grid-template-columns: minmax(0, 1fr);
  }
  .le__facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
