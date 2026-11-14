<script setup lang="ts">
// PROTOTYPE variant C, "Night quay": the same gate after dark. The sky is swapped for dusk, the scene is
// graded down and the lamps are lit; the name hangs in the sky as an outline behind the gantry. Words and
// the key field stand on the left. It forces the Night quay theme while it is on screen.
import { onBeforeUnmount, onMounted } from 'vue'
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
import { useSetupStore } from '../../stores/setup'

const setup = useSetupStore()
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
  <main class="lc">
    <GateScene class="lc__scene" night :fy="0.012">
      <template #behind>
        <p class="lc__name" aria-hidden="true">Quay Sight</p>
      </template>
      <i class="lc__lamp lc__lamp--1" aria-hidden="true"></i>
      <i class="lc__lamp lc__lamp--2" aria-hidden="true"></i>
      <i class="lc__lamp lc__lamp--3" aria-hidden="true"></i>
      <i class="lc__wash" aria-hidden="true"></i>
      <i class="lc__scan" aria-hidden="true"></i>
    </GateScene>

    <header class="lc__top">
      <p class="lc__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <button type="button" class="lc__demo" @click="setup.enterDemo()">
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

    <section class="lc__lead">
      <h1 class="lc__title">A second pair of eyes on every container.</h1>
      <p class="lc__sub">
        Photograph it. Quay Sight reads what is painted on it, marks the damage it suspects, and
        tells you how sure it is.
      </p>
      <ProtoKeyField :demo="false" />
    </section>

    <ol class="lc__reads" aria-label="What it reads">
      <li v-for="(read, n) in READS" :key="read">
        <span>0{{ n + 1 }}</span
        >{{ read }}
      </li>
    </ol>
  </main>
</template>

<style scoped>
.lc {
  --lp-align: start;
  --lp-field-width: 560px;
  --lp-field-bg: color-mix(in srgb, var(--landing-ink) 96%, transparent);
  --lp-field-ink: var(--landing-on-ink);
  --lp-field-muted: color-mix(in srgb, var(--landing-on-ink) 62%, var(--landing-ink));
  --lp-field-well: color-mix(in srgb, var(--landing-on-ink) 10%, var(--landing-ink));
  --lp-opt-on-bg: var(--landing-on-ink);
  --lp-opt-on-ink: var(--landing-ink);
  --lp-go-bg: var(--brand);
  --lp-go-ink: var(--on-brand);
  --lp-note-ink: color-mix(in srgb, var(--landing-ink) 70%, transparent);
  --lp-focus: var(--brand);
  --edge: clamp(var(--space-5), 4.4vw, calc(var(--space-8) * 1.25));
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 660px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand) 16%, var(--landing-bg)),
    color-mix(in srgb, var(--brand) 30%, var(--landing-bg)) 40%,
    var(--landing-bg) 92%
  );
  color: var(--landing-ink);
  isolation: isolate;
}

/* The gate, right of centre, its left edge dissolving into the dusk */
.lc__scene {
  position: absolute;
  z-index: -1;
  inset: 0 -6% 0 32%;
  mask-image:
    linear-gradient(90deg, transparent, black 22%), linear-gradient(0deg, transparent, black 26%);
  mask-composite: intersect;
  animation: lc-fade 1200ms ease-out both;
}
.lc__name {
  position: absolute;
  left: 12.6%;
  right: 11%;
  top: 14.6%;
  margin: 0;
  color: transparent;
  font: 700 13.4cqw/1 var(--font-display);
  letter-spacing: 0.035em;
  text-align: center;
  text-transform: uppercase;
  white-space: nowrap;
  -webkit-text-stroke: 0.014em var(--brand);
  filter: drop-shadow(0 0 0.06em color-mix(in srgb, var(--brand) 70%, transparent));
  animation: lc-flicker 1600ms steps(1) 500ms both;
}
.lc__lamp {
  position: absolute;
  width: 26%;
  aspect-ratio: 1;
  border-radius: var(--radius-pill);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--landing-ink) 95%, transparent) 0 5%,
    color-mix(in srgb, var(--landing-ink) 42%, transparent) 14%,
    color-mix(in srgb, var(--landing-ink) 12%, transparent) 36%,
    transparent 68%
  );
  mix-blend-mode: screen;
  translate: -50% -50%;
}
.lc__lamp--1 {
  left: 27.6%;
  top: 14.6%;
}
.lc__lamp--2 {
  left: 15.4%;
  top: 17.6%;
  width: 20%;
}
.lc__lamp--3 {
  left: 84.6%;
  top: 16%;
}
.lc__wash {
  position: absolute;
  left: 27.7%;
  top: 24.4%;
  width: 46.4%;
  height: 43.4%;
  background: radial-gradient(
    ellipse 90% 70% at 50% 18%,
    color-mix(in srgb, var(--landing-ink) 24%, transparent),
    transparent 70%
  );
  mix-blend-mode: screen;
}
.lc__scan {
  position: absolute;
  left: 27.7%;
  top: 24.4%;
  width: 46.4%;
  height: 43.4%;
  overflow: hidden;
}
.lc__scan::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 16%;
  border-bottom: 2px solid var(--brand);
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--brand) 30%, transparent)
  );
  transform: translateY(-110%);
  animation: lc-scan 2200ms cubic-bezier(0.45, 0, 0.25, 1) 900ms both;
}

/* Top line */
.lc__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.lc__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lc__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
.lc__demo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
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
.lc__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.lc__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.lc__demo svg {
  width: 16px;
  height: 16px;
}

/* Words */
.lc__lead {
  align-self: center;
  width: min(46%, 720px);
  padding: 0 0 var(--space-5) var(--edge);
  animation: lc-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 250ms both;
}
.lc__title {
  margin: 0;
  font: 700 clamp(2.75rem, 5.4vw, 6.25rem)/0.94 var(--font-hero);
  letter-spacing: -0.05em;
  text-wrap: balance;
}
.lc__sub {
  max-width: 31rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}

/* What it reads, along the foot */
.lc__reads {
  display: grid;
  grid-template-columns: repeat(6, auto);
  justify-content: space-between;
  margin: 0;
  padding: var(--space-4) var(--edge) var(--space-5);
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 18%, transparent);
  background: color-mix(in srgb, var(--landing-bg) 70%, transparent);
  backdrop-filter: blur(14px);
  list-style: none;
  font: 500 0.9375rem/1.5rem var(--font-sans);
}
.lc__reads span {
  margin-right: var(--space-3);
  color: var(--brand);
  font: 500 0.8125rem/1.5rem var(--font-mono);
}

@keyframes lc-fade {
  from {
    opacity: 0;
  }
}
@keyframes lc-rise {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}
@keyframes lc-scan {
  to {
    transform: translateY(640%);
    opacity: 0;
  }
}
@keyframes lc-flicker {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  18% {
    opacity: 0.2;
  }
  26% {
    opacity: 1;
  }
  40% {
    opacity: 0.5;
  }
  46%,
  100% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lc *,
  .lc *::after {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lc__scene {
    inset: 0;
    opacity: 0.55;
  }
  .lc__lead {
    width: auto;
    padding-right: var(--edge);
  }
  .lc__reads {
    grid-template-columns: repeat(2, auto);
  }
}
</style>
