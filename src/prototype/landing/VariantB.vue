<script setup lang="ts">
// PROTOTYPE variant B, "Night quay": cinematic and dark. The four photos of one container stand full height
// like doors on a stack, the headline sits over them, and the key field is the only bright object.
// It forces the Night quay theme while it is on screen.
import { onBeforeUnmount, onMounted } from 'vue'
import ProtoKeyField from './ProtoKeyField.vue'
import { useSetupStore } from '../../stores/setup'
import doors from '../../../samples/jdlu-200690-1-rear-doors.jpg'
import doorsLeft from '../../../samples/jdlu-200690-2-corner-doors-left.jpg'
import doorsRight from '../../../samples/jdlu-200690-3-corner-doors-right.jpg'
import longSide from '../../../samples/jdlu-200690-4-long-side.jpg'

const setup = useSetupStore()
const SHOTS = [
  { src: doors, face: 'Rear doors', at: '50% 30%' },
  { src: doorsLeft, face: 'Doors and right side', at: '40% 35%' },
  { src: doorsRight, face: 'Left side and doors', at: '60% 35%' },
  { src: longSide, face: 'Long side', at: '45% 40%' },
]
const READS = ['Container ID', 'Size and type', 'Weights', 'Seal', 'Placards', 'Damage']

let before: string | null = null
onMounted(() => {
  before = document.documentElement.getAttribute('data-theme')
  document.documentElement.setAttribute('data-theme', 'dark')
})
onBeforeUnmount(() => {
  if (before) document.documentElement.setAttribute('data-theme', before)
  else document.documentElement.removeAttribute('data-theme')
})
</script>

<template>
  <main class="lb">
    <ul class="lb__shots" aria-hidden="true">
      <li v-for="(shot, n) in SHOTS" :key="shot.face" :style="`--i: ${n}`">
        <img :src="shot.src" alt="" :style="`object-position: ${shot.at}`" />
        <span class="lb__face"
          ><b>0{{ n + 1 }}</b
          >{{ shot.face }}</span
        >
      </li>
    </ul>

    <header class="lb__top">
      <span class="lb__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
      <p class="lb__count">One container <i></i> one to five photos</p>
      <button type="button" class="lb__demo" @click="setup.enterDemo()">
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

    <section class="lb__body">
      <div class="lb__lead">
        <h1 class="lb__title">Container<br />inspection<br />from photos.</h1>
        <ProtoKeyField :demo="false" />
      </div>
      <aside class="lb__reads">
        <p>Read from the photos, each with its certainty</p>
        <ol>
          <li v-for="(read, n) in READS" :key="read">
            <span>0{{ n + 1 }}</span
            >{{ read }}
          </li>
        </ol>
        <p class="lb__caveat">Observations and estimates. Not a certified survey.</p>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.lb {
  --lp-align: start;
  --lp-field-width: 620px;
  --lp-field-bg: var(--landing-ink);
  --lp-field-ink: var(--landing-on-ink);
  --lp-field-muted: color-mix(in srgb, var(--landing-on-ink) 62%, var(--landing-ink));
  --lp-field-well: color-mix(in srgb, var(--landing-on-ink) 10%, var(--landing-ink));
  --lp-opt-on-bg: var(--landing-on-ink);
  --lp-opt-on-ink: var(--landing-ink);
  --lp-go-bg: var(--brand);
  --lp-go-ink: var(--on-brand);
  --lp-note-ink: color-mix(in srgb, var(--landing-ink) 72%, transparent);
  --lp-focus: var(--brand);
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 640px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  isolation: isolate;
}

/* Four photos, full height */
.lb__shots {
  position: absolute;
  inset: 0;
  z-index: -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
.lb__shots li {
  position: relative;
  overflow: hidden;
  border-left: 1px solid color-mix(in srgb, var(--landing-ink) 22%, transparent);
  animation: lb-open 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i) * 110ms);
}
.lb__shots li:first-child {
  border-left: 0;
}
.lb__shots img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.85) brightness(0.78);
  transition:
    filter var(--duration-slow),
    transform 1200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.lb__shots li:hover img {
  filter: saturate(1) brightness(1);
  transform: scale(1.03);
}
.lb__shots li::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--landing-bg) 82%, transparent),
      transparent 24%
    ),
    linear-gradient(
      0deg,
      var(--landing-bg) 4%,
      color-mix(in srgb, var(--landing-bg) 82%, transparent) 38%,
      transparent 78%
    );
  pointer-events: none;
}
.lb__face {
  position: absolute;
  z-index: 1;
  left: var(--space-5);
  top: 92px;
  display: flex;
  gap: var(--space-3);
  color: var(--landing-ink);
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lb__face b {
  color: var(--brand);
  font-weight: 500;
}

/* Top line */
.lb__top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--space-5) clamp(var(--space-5), 4vw, calc(var(--space-5) * 3));
}
.lb__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: 700 1.375rem/1 var(--font-hero);
  letter-spacing: -0.02em;
}
.lb__brand .qs-logo {
  width: 28px;
  height: 28px;
  color: var(--brand);
}
.lb__count {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.lb__count i {
  width: var(--space-6);
  height: 1px;
  background: currentColor;
}
.lb__demo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: end;
  height: var(--control-md);
  padding: 0 var(--space-4);
  border: 1px solid color-mix(in srgb, var(--landing-ink) 45%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--landing-bg) 55%, transparent);
  color: var(--landing-ink);
  font: 600 0.875rem/1 var(--font-sans);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition:
    background-color var(--duration-fast),
    color var(--duration-fast);
}
.lb__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.lb__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.lb__demo svg {
  width: 16px;
  height: 16px;
}

/* Headline and field */
.lb__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-7);
  padding: 0 clamp(var(--space-5), 4vw, calc(var(--space-5) * 3)) var(--space-7);
}
.lb__title {
  margin: 0 0 var(--space-6);
  font: 700 clamp(3.25rem, 8.4vw, 9.5rem)/0.88 var(--font-hero);
  letter-spacing: -0.05em;
  animation: lb-rise 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 350ms both;
}
.lb__lead :deep(.lp-key) {
  animation: lb-rise 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 500ms both;
}
.lb__reads {
  width: 300px;
  padding-bottom: var(--space-2);
  animation: lb-rise 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 650ms both;
}
.lb__reads p {
  margin: 0 0 var(--space-3);
  color: var(--landing-ink-muted);
  font: 400 0.8125rem/1.25rem var(--font-sans);
}
.lb__reads ol {
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 28%, transparent);
}
.lb__reads li {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--landing-ink) 28%, transparent);
  font: 500 0.9375rem/1.5rem var(--font-sans);
}
.lb__reads li span {
  color: var(--brand);
  font: 500 0.8125rem/1.5rem var(--font-mono);
}
.lb__reads .lb__caveat {
  margin: 0;
}

@keyframes lb-open {
  from {
    opacity: 0;
    clip-path: inset(0 0 100% 0);
  }
  to {
    opacity: 1;
    clip-path: inset(0);
  }
}
@keyframes lb-rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lb *,
  .lb :deep(.lp-key) {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 900px) {
  .lb__shots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lb__shots li:nth-child(n + 3),
  .lb__count,
  .lb__reads {
    display: none;
  }
  .lb__top {
    grid-template-columns: 1fr auto;
  }
  .lb__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
