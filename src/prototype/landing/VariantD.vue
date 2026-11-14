<script setup lang="ts">
// PROTOTYPE variant D, "Poster": a symmetrical, editorial page. The name sits large at the top centre, the
// headline runs the full width, and the whole gate picture stands in an arched window between the three
// steps on the left and the key field on the right.
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'

const STEPS = [
  ['Photograph', 'One to five photos of one container. Start with the doors.'],
  ['Read', 'The ID, size and type, weights, seal, placards and suspected damage.'],
  ['Know how sure', "Each reading is Confident, Likely, Uncertain, Can't tell or Not seen."],
]
</script>

<template>
  <main class="ld">
    <header class="ld__top">
      <p class="ld__kicker">Container inspection from photos</p>
      <p class="ld__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <p class="ld__kicker ld__kicker--end">Not a certified survey</p>
    </header>

    <h1 class="ld__title">Photograph a container.<br />Know what you're looking at.</h1>

    <div class="ld__row">
      <ol class="ld__steps">
        <li v-for="([name, text], n) in STEPS" :key="name">
          <span>0{{ n + 1 }}</span>
          <h2>{{ name }}</h2>
          <p>{{ text }}</p>
        </li>
      </ol>

      <figure class="ld__arch">
        <GateScene class="ld__scene" :fy="0.04" />
      </figure>

      <div class="ld__start">
        <h2>Start an inspection</h2>
        <p>
          Paste a key for OpenRouter or OpenAI. It is kept in memory only, and each inspection stops
          at $0.50.
        </p>
        <ProtoKeyField />
      </div>
    </div>
  </main>
</template>

<style scoped>
.ld {
  --edge: clamp(var(--space-5), 5.5vw, calc(var(--space-8) * 1.5));
  --rule: color-mix(in srgb, var(--landing-ink) 16%, transparent);
  flex: 1;
  display: grid;
  grid-template-rows: auto auto 1fr;
  padding: 0 var(--edge);
  background: var(--landing-bg);
  color: var(--landing-ink);
}
.ld__top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--rule);
}
.ld__kicker {
  margin: 0;
  color: var(--landing-ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ld__kicker--end {
  text-align: right;
}
.ld__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2.25rem/1 var(--font-hero);
  letter-spacing: -0.035em;
}
.ld__brand .qs-logo {
  width: 50px;
  height: 50px;
  color: inherit;
}
.ld__title {
  margin: clamp(var(--space-5), 4.5vh, var(--space-8)) 0 clamp(var(--space-5), 4vh, var(--space-7));
  font: 700 clamp(2.5rem, 6.1vw, 7.25rem)/0.94 var(--font-hero);
  letter-spacing: -0.055em;
  text-align: center;
  animation: ld-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.ld__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: clamp(var(--space-6), 4.5vw, var(--space-8));
  align-items: end;
}

/* Steps */
.ld__steps {
  display: grid;
  align-self: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ld__steps li {
  display: grid;
  grid-template-columns: var(--space-7) 1fr;
  padding: var(--space-4) 0;
  border-top: 1px solid var(--rule);
}
.ld__steps li:last-child {
  border-bottom: 1px solid var(--rule);
}
.ld__steps span {
  grid-row: span 2;
  color: var(--landing-ink-muted);
  font: 500 0.8125rem/1.75rem var(--font-mono);
}
.ld__steps h2,
.ld__start h2 {
  margin: 0;
  font: 700 1.375rem/1.75rem var(--font-hero);
  letter-spacing: -0.025em;
}
.ld__steps p,
.ld__start > p {
  margin: var(--space-1) 0 0;
  color: var(--landing-ink-muted);
  font: 400 0.9375rem/1.5rem var(--font-sans);
  text-wrap: pretty;
}

/* The gate, in an arch */
.ld__arch {
  width: clamp(280px, min(30vw, 50vh), 560px);
  aspect-ratio: 1161 / 1290;
  margin: 0;
  overflow: hidden;
  border-radius: 999px 999px 0 0;
  box-shadow: var(--shadow-landing);
  animation: ld-rise 1100ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms both;
}
.ld__scene {
  height: 100%;
}

/* Key field */
.ld__start {
  --lp-align: stretch;
  --lp-field-width: 100%;
  --lp-field-wrap: wrap;
  --lp-pick-flex: 1 1 100%;
  --lp-opt-flex: 1;
  --lp-field-radius: var(--radius-lg);
  --lp-field-inner-radius: var(--radius-md);
  align-self: center;
}
.ld__start > p {
  margin-bottom: var(--space-4);
}

@keyframes ld-rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ld * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .ld__top {
    grid-template-columns: 1fr;
    justify-items: center;
  }
  .ld__kicker {
    display: none;
  }
  .ld__row {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }
  .ld__arch {
    order: -1;
    width: min(100%, 420px);
  }
  .ld__steps,
  .ld__start {
    width: 100%;
  }
}
</style>
