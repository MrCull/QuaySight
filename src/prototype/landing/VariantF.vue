<script setup lang="ts">
// PROTOTYPE variant F, "Composite": the three that were picked out, joined. The night gate with the name in
// neon behind it (C); the stencilled door lettering for the headline, the riveted data plate for the key
// field and the markings table along the foot (the earlier door-markings variant); and the readings bracketed
// on the doors with their cards and certainties (the earlier annotated photo). Forces the Night quay theme.
import { onBeforeUnmount, onMounted } from 'vue'
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
import CertaintyChip from '../../components/CertaintyChip.vue'
import { useSetupStore } from '../../stores/setup'

const setup = useSetupStore()
const MARKINGS = [
  ['Reads', 'ID · Size · Weights · Seal'],
  ['Finds', 'Placards · Damage'],
  ['Photos', '1–5 per container'],
  ['Spend cap', '$0.50 an inspection'],
]

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
  <main class="lf">
    <GateScene class="lf__scene" night :fy="0.12">
      <template #behind>
        <p class="lf__name" aria-hidden="true">Quay Sight</p>
      </template>
      <i class="lf__lamp lf__lamp--1" aria-hidden="true"></i>
      <i class="lf__lamp lf__lamp--2" aria-hidden="true"></i>
      <i class="lf__lamp lf__lamp--3" aria-hidden="true"></i>
      <i class="lf__wash" aria-hidden="true"></i>
      <i class="lf__scan" aria-hidden="true"></i>

      <i class="lf__mark lf__mark--id" style="--i: 0" aria-hidden="true"></i>
      <i class="lf__mark lf__mark--weights" style="--i: 1" aria-hidden="true"></i>
      <i class="lf__mark lf__mark--marking" style="--i: 2" aria-hidden="true"></i>

      <article class="lf__card lf__card--id" style="--i: 0">
        <h2><i class="qs-glyph qs-glyph--tag" aria-hidden="true"></i>Container ID</h2>
        <p class="lf__value">CMAU 210375 <b>8</b></p>
        <p class="lf__why">Painted check digit is 8. The number works out to 9.</p>
        <CertaintyChip level="Uncertain" />
      </article>
      <article class="lf__card lf__card--weights" style="--i: 1">
        <h2><i class="qs-glyph qs-glyph--weight" aria-hidden="true"></i>Weights</h2>
        <dl>
          <div>
            <dt>Max gross</dt>
            <dd>30,480 kg</dd>
          </div>
          <div>
            <dt>Tare</dt>
            <dd>2,185 kg</dd>
          </div>
          <div>
            <dt>Net</dt>
            <dd>28,295 kg</dd>
          </div>
        </dl>
        <CertaintyChip level="Confident" />
      </article>
      <article class="lf__card lf__card--marking" style="--i: 2">
        <h2><i class="qs-glyph qs-glyph--hazard lf__diamond" aria-hidden="true"></i>Marking</h2>
        <p class="lf__value lf__value--plain">Super heavy</p>
        <CertaintyChip level="Likely" />
      </article>
    </GateScene>

    <header class="lf__top">
      <p class="lf__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <button type="button" class="lf__demo" @click="setup.enterDemo()">
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

    <section class="lf__lead">
      <h1 class="lf__title">Snap the doors.<br />Get the facts.</h1>
      <p class="lf__sub">
        Quay Sight reads what is painted on a container, marks the damage it suspects, and tells you
        how sure it is of each.
      </p>
      <div class="lf__plate">
        <p class="lf__plate-head">
          <span>Inspect a container</span><span>OpenRouter or OpenAI key</span>
        </p>
        <ProtoKeyField :demo="false" />
      </div>
    </section>

    <dl class="lf__table">
      <div v-for="[label, value] in MARKINGS" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
  </main>
</template>

<style scoped>
.lf {
  --edge: clamp(var(--space-5), 4.4vw, calc(var(--space-8) * 1.25));
  --steel-lo: var(--schem-detail);
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 700px;
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

/* The gate at night */
.lf__scene {
  position: absolute;
  z-index: -1;
  inset: 0 -6% 0 32%;
  mask-image:
    linear-gradient(90deg, transparent, black 22%), linear-gradient(0deg, transparent, black 12%);
  mask-composite: intersect;
  animation: lf-fade 1200ms ease-out both;
}
.lf__name {
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
  animation: lf-flicker 1600ms steps(1) 500ms both;
}
.lf__lamp {
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
.lf__lamp--1 {
  left: 27.6%;
  top: 14.6%;
}
.lf__lamp--2 {
  left: 15.4%;
  top: 17.6%;
  width: 20%;
}
.lf__lamp--3 {
  left: 84.6%;
  top: 16%;
}
.lf__wash,
.lf__scan {
  position: absolute;
  left: 27.7%;
  top: 24.4%;
  width: 46.4%;
  height: 43.4%;
}
.lf__wash {
  background: radial-gradient(
    ellipse 90% 70% at 50% 18%,
    color-mix(in srgb, var(--landing-ink) 22%, transparent),
    transparent 70%
  );
  mix-blend-mode: screen;
}
.lf__scan {
  overflow: hidden;
}
.lf__scan::after {
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
  animation: lf-scan 1800ms cubic-bezier(0.45, 0, 0.25, 1) 700ms both;
}

/* Each reading: brackets on the door, a rule across to its card */
.lf__mark {
  --c: var(--cert-confident-line);
  position: absolute;
  background:
    linear-gradient(var(--c), var(--c)) 0 0 / 10px 2px,
    linear-gradient(var(--c), var(--c)) 0 0 / 2px 10px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 10px 2px,
    linear-gradient(var(--c), var(--c)) 100% 0 / 2px 10px,
    linear-gradient(var(--c), var(--c)) 0 100% / 10px 2px,
    linear-gradient(var(--c), var(--c)) 0 100% / 2px 10px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 10px 2px,
    linear-gradient(var(--c), var(--c)) 100% 100% / 2px 10px;
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 4px var(--c));
  animation: lf-mark var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(1900ms + var(--i) * 170ms);
}
.lf__mark::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  width: var(--rule);
  height: 2px;
  background: var(--c);
}
.lf__mark--id {
  --c: var(--cert-uncertain-line);
  --rule: 6.6cqw;
  left: 55.2%;
  top: 30.6%;
  width: 17.2%;
  height: 6.4%;
}
.lf__mark--weights {
  --rule: 7cqw;
  left: 55.6%;
  top: 39.4%;
  width: 15.2%;
  height: 12.6%;
}
.lf__mark--marking {
  --c: var(--cert-likely-line);
  --rule: 14.4cqw;
  left: 63%;
  top: 55.8%;
  width: 6.6%;
  height: 5.4%;
}

.lf__card {
  position: absolute;
  left: 28.6%;
  width: 20.2%;
  box-sizing: border-box;
  display: grid;
  justify-items: start;
  gap: 0.5cqw;
  padding: 0.9cqw 1.1cqw 1.1cqw;
  border: 1px solid color-mix(in srgb, var(--landing-ink) 16%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--landing-bg) 82%, transparent);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow-landing);
  font-size: clamp(0.6875rem, 1.2cqw, 1rem);
  animation: lf-rise var(--duration-arrive) cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(2000ms + var(--i) * 170ms);
}
.lf__card--id {
  top: 29.4%;
}
.lf__card--weights {
  top: 40.6%;
}
.lf__card--marking {
  top: 54.2%;
}
.lf__card h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--landing-ink-muted);
  font: 600 0.78em/1.5 var(--font-sans);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.lf__diamond {
  color: var(--hazard-fg);
}
.lf__value {
  margin: 0;
  font: 500 1.18em/1.35 var(--font-mono);
  white-space: nowrap;
}
.lf__value--plain {
  font: 600 1.12em/1.35 var(--font-sans);
}
.lf__value b {
  padding: 0 0.2em;
  border: 1.5px solid var(--cert-uncertain-line);
  border-radius: var(--radius-xs);
  color: var(--cert-uncertain-fg);
  font-weight: 500;
}
.lf__why {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 400 0.82em/1.35 var(--font-sans);
}
.lf__card dl {
  display: grid;
  width: 100%;
  margin: 0;
}
.lf__card dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}
.lf__card dt {
  color: var(--landing-ink-muted);
  font: 600 0.78em/1.7 var(--font-sans);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.lf__card dd {
  margin: 0;
  font: 500 0.98em/1.5 var(--font-mono);
}

/* Top line */
.lf__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--edge);
}
.lf__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lf__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: var(--brand);
}
.lf__demo {
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
}
.lf__demo:hover {
  background: var(--landing-ink);
  color: var(--landing-on-ink);
}
.lf__demo:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.lf__demo svg {
  width: 16px;
  height: 16px;
}

/* Stencilled headline and the data plate */
.lf__lead {
  align-self: center;
  width: min(45%, 700px);
  padding: 0 0 var(--space-5) var(--edge);
  animation: lf-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 250ms both;
}
.lf__title {
  margin: 0;
  font: 600 clamp(3.25rem, 6.2vw, 7.75rem)/0.9 var(--font-display);
  letter-spacing: 0.005em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lf__sub {
  max-width: 31rem;
  margin: var(--space-5) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
.lf__plate {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-radius: var(--radius-sm);
  --lp-field-inner-radius: var(--radius-xs);
  --lp-field-bg: var(--landing-on-ink);
  --lp-field-ink: var(--landing-ink);
  --lp-field-muted: var(--landing-ink-muted);
  --lp-field-well: color-mix(in srgb, var(--landing-ink) 10%, var(--landing-on-ink));
  --lp-opt-on-bg: var(--landing-ink);
  --lp-opt-on-ink: var(--landing-on-ink);
  --lp-go-bg: var(--brand);
  --lp-go-ink: var(--on-brand);
  --lp-field-shadow: none;
  --lp-note-ink: color-mix(in srgb, var(--landing-on-ink) 74%, var(--landing-ink));
  --lp-focus: var(--brand);
  max-width: 580px;
  padding: var(--space-4) var(--space-5) var(--space-3);
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 10px 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at calc(100% - 10px) 10px, var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(circle at 10px calc(100% - 10px), var(--steel-lo) 0 2.5px, transparent 3px),
    radial-gradient(
      circle at calc(100% - 10px) calc(100% - 10px),
      var(--steel-lo) 0 2.5px,
      transparent 3px
    ),
    linear-gradient(
      135deg,
      var(--landing-ink),
      color-mix(in srgb, var(--landing-ink) 78%, var(--schem-rail)) 50%,
      var(--landing-ink)
    );
  color: var(--landing-on-ink);
  box-shadow: var(--shadow-landing);
}
.lf__plate-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 var(--space-1) var(--space-3);
  font: 600 0.75rem/1 var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lf__plate-head span:last-child {
  opacity: 0.66;
}

/* Markings table along the foot */
.lf__table {
  display: grid;
  grid-template-columns: 1.5fr 1.1fr 1fr 1.1fr;
  gap: var(--space-6);
  margin: 0;
  padding: var(--space-4) var(--edge) var(--space-4);
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 18%, transparent);
  background: color-mix(in srgb, var(--landing-bg) 72%, transparent);
  backdrop-filter: blur(14px);
}
.lf__table dt {
  color: var(--brand);
  font: 500 0.75rem/1.25rem var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lf__table dd {
  margin: 0;
  font: 500 clamp(1.25rem, 1.9vw, 2rem)/1.15 var(--font-display);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

@keyframes lf-fade {
  from {
    opacity: 0;
  }
}
@keyframes lf-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
@keyframes lf-mark {
  from {
    opacity: 0;
    scale: 1.2;
  }
}
@keyframes lf-scan {
  to {
    transform: translateY(640%);
    opacity: 0;
  }
}
@keyframes lf-flicker {
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
  .lf *,
  .lf *::after {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lf__scene {
    inset: 0;
    opacity: 0.5;
  }
  .lf__card,
  .lf__mark {
    display: none;
  }
  .lf__lead {
    width: auto;
    padding-right: var(--edge);
  }
  .lf__title {
    white-space: normal;
  }
  .lf__table {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
