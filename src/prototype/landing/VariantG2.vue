<script setup lang="ts">
// PROTOTYPE variant G2, "Night poster": the gate after dark, centred and symmetrical like a film poster. The
// name and logo stand large at the top, the picture dissolves into the page beneath the container's markings,
// and the headline and key field sit centred below. What it reads runs down either side like credits.
// It forces the Night quay theme while it is on screen.
import { onBeforeUnmount, onMounted } from 'vue'
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'

const LEFT = ['Container ID', 'Size and type', 'Weights']
const RIGHT = ['Seal', 'Placards', 'Damage']

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
  <main class="lg2">
    <GateScene class="lg2__scene" night :fy="0">
      <i class="lg2__lamp lg2__lamp--1" aria-hidden="true"></i>
      <i class="lg2__lamp lg2__lamp--2" aria-hidden="true"></i>
      <i class="lg2__lamp lg2__lamp--3" aria-hidden="true"></i>
      <i class="lg2__wash" aria-hidden="true"></i>
    </GateScene>

    <p class="lg2__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>

    <ol class="lg2__credits lg2__credits--left" aria-label="What it reads">
      <li v-for="(read, n) in LEFT" :key="read">
        <span>0{{ n + 1 }}</span
        >{{ read }}
      </li>
    </ol>
    <ol class="lg2__credits lg2__credits--right" aria-label="What it reads, continued">
      <li v-for="(read, n) in RIGHT" :key="read">
        {{ read }}<span>0{{ n + 4 }}</span>
      </li>
    </ol>

    <section class="lg2__lead">
      <h1 class="lg2__title">No clipboard. Just a camera.</h1>
      <p class="lg2__sub">
        Photograph the doors. Quay Sight reads what is painted there, marks the damage it suspects,
        and tells you how sure it is.
      </p>
      <ProtoKeyField />
    </section>
  </main>
</template>

<style scoped>
.lg2 {
  --lp-field-width: 620px;
  --lp-field-bg: var(--landing-ink);
  --lp-field-ink: var(--landing-on-ink);
  --lp-field-muted: color-mix(in srgb, var(--landing-on-ink) 62%, var(--landing-ink));
  --lp-field-well: color-mix(in srgb, var(--landing-on-ink) 10%, var(--landing-ink));
  --lp-opt-on-bg: var(--landing-on-ink);
  --lp-opt-on-ink: var(--landing-ink);
  --lp-go-bg: var(--brand);
  --lp-go-ink: var(--on-brand);
  --lp-focus: var(--brand);
  --edge: clamp(var(--space-5), 4.4vw, calc(var(--space-8) * 1.25));
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  min-height: 700px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand) 16%, var(--landing-bg)),
    color-mix(in srgb, var(--brand) 30%, var(--landing-bg)) 34%,
    var(--landing-bg) 78%
  );
  color: var(--landing-ink);
  isolation: isolate;
}

/* The gate, centred, dissolving at the sides and into the page below */
.lg2__scene {
  position: absolute;
  z-index: -1;
  left: 50%;
  top: 0;
  width: min(64vw, 124vh);
  height: 100%;
  translate: -50% 0;
  mask-image:
    linear-gradient(90deg, transparent, black 9%, black 91%, transparent),
    linear-gradient(180deg, black 42%, transparent 70%);
  mask-composite: intersect;
  animation: lg2-fade 1300ms ease-out both;
}
.lg2__lamp {
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
  animation: lg2-lamp 1400ms steps(1) 400ms both;
}
.lg2__lamp--1 {
  left: 27.6%;
  top: 14.6%;
}
.lg2__lamp--2 {
  left: 15.4%;
  top: 17.6%;
  width: 20%;
}
.lg2__lamp--3 {
  left: 84.6%;
  top: 16%;
}
.lg2__wash {
  position: absolute;
  left: 27.7%;
  top: 24.4%;
  width: 46.4%;
  height: 43.4%;
  background: radial-gradient(
    ellipse 90% 70% at 50% 14%,
    color-mix(in srgb, var(--landing-ink) 26%, transparent),
    transparent 70%
  );
  mix-blend-mode: screen;
}

/* Name */
.lg2__brand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin: clamp(var(--space-4), 2.6vh, var(--space-6)) 0 0;
  padding: var(--space-2) var(--space-5) var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--landing-bg) 62%, transparent);
  backdrop-filter: blur(12px);
  font: 700 clamp(2.25rem, 3.2vw, 3.25rem) / 1 var(--font-hero);
  letter-spacing: -0.035em;
}
.lg2__brand .qs-logo {
  width: 1.3em;
  height: 1.3em;
  color: var(--brand);
}

/* Credits down either side */
.lg2__credits {
  position: absolute;
  top: 34%;
  display: grid;
  width: min(15vw, 240px);
  margin: 0;
  padding: 0;
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 22%, transparent);
  list-style: none;
  font: 500 0.9375rem/1.5rem var(--font-sans);
}
.lg2__credits--left {
  left: var(--edge);
}
.lg2__credits--right {
  right: var(--edge);
  text-align: right;
}
.lg2__credits li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--landing-ink) 22%, transparent);
}
.lg2__credits span {
  color: var(--brand);
  font: 500 0.8125rem/1.5rem var(--font-mono);
}

/* Headline and key field */
.lg2__lead {
  grid-row: 3;
  display: grid;
  justify-items: center;
  width: 100%;
  padding: 0 var(--edge) clamp(var(--space-5), 4vh, var(--space-7));
  box-sizing: border-box;
  text-align: center;
  animation: lg2-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 300ms both;
}
.lg2__title {
  margin: 0;
  font: 700 clamp(2.5rem, 5.6vw, 6.5rem) / 0.96 var(--font-hero);
  letter-spacing: -0.05em;
  text-wrap: balance;
}
.lg2__sub {
  max-width: 44rem;
  margin: var(--space-4) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
.lg2__lead :deep(.lp-key__note) {
  justify-content: center;
}

@keyframes lg2-fade {
  from {
    opacity: 0;
  }
}
@keyframes lg2-rise {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}
@keyframes lg2-lamp {
  0% {
    opacity: 0;
  }
  14% {
    opacity: 1;
  }
  22% {
    opacity: 0.25;
  }
  34%,
  100% {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg2 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lg2__scene {
    width: 100%;
  }
  .lg2__credits {
    display: none;
  }
}
</style>
