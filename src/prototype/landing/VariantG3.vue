<script setup lang="ts">
// PROTOTYPE variant G3, "Panel left": the gate picture stands as a tall rounded panel on the left, cropped to
// the opening of the gantry, with the name large in its sky behind the container. The words, the key field
// and a slim row of three facts are on the right, on the light page.
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'

const FACTS = [
  ['Photos', 'One to five of one container'],
  ['Your key', 'Stays in this tab'],
  ['Result', 'Not a certified survey'],
]
</script>

<template>
  <main class="lg3">
    <figure class="lg3__panel">
      <GateScene class="lg3__scene" :fx="0.5" :fy="0">
        <template #behind>
          <p class="lg3__name" aria-hidden="true">Quay Sight</p>
        </template>
      </GateScene>
    </figure>

    <section class="lg3__copy">
      <p class="lg3__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <div class="lg3__lead">
        <h1 class="lg3__title">Seen.<br />Read.<br />Said plainly.</h1>
        <p class="lg3__sub">
          Photograph a container. Quay Sight reads its markings, marks the damage it suspects, and
          says how sure it is of each one, in plain words.
        </p>
        <ProtoKeyField />
      </div>
      <dl class="lg3__facts">
        <div v-for="[label, value] in FACTS" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.lg3 {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1fr);
  background: var(--landing-bg);
  color: var(--landing-ink);
}

/* Picture panel: taller than its window, so the foot of the picture stays out of view */
.lg3__panel {
  position: relative;
  min-height: 620px;
  margin: var(--space-4) 0 0 var(--space-4);
  overflow: hidden;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-landing);
}
.lg3__scene {
  position: absolute;
  inset: 0 0 auto;
  height: 133%;
  animation: lg3-settle 1600ms cubic-bezier(0.16, 0.84, 0.24, 1) both;
}
.lg3__name {
  position: absolute;
  left: 12.6%;
  right: 11%;
  top: 15%;
  margin: 0;
  color: var(--landing-surface);
  font: 700 12.6cqw/1 var(--font-display);
  letter-spacing: 0.03em;
  text-align: center;
  text-transform: uppercase;
  white-space: nowrap;
  animation: lg3-rise 1300ms cubic-bezier(0.16, 0.84, 0.24, 1) 250ms both;
}

/* Words */
.lg3__copy {
  --lp-align: start;
  --lp-field-width: 580px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  padding: var(--space-6) clamp(var(--space-5), 5vw, calc(var(--space-8) * 1.5)) var(--space-5)
    clamp(var(--space-5), 5vw, calc(var(--space-8) * 1.5));
}
.lg3__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2rem/1 var(--font-hero);
  letter-spacing: -0.03em;
}
.lg3__brand .qs-logo {
  width: 46px;
  height: 46px;
  color: inherit;
}
.lg3__lead {
  align-self: center;
  padding-block: var(--space-5);
}
.lg3__title {
  margin: 0;
  font: 700 clamp(2.75rem, 6vw, 7rem) / 0.92 var(--font-hero);
  letter-spacing: -0.055em;
}
.lg3__sub {
  max-width: 33rem;
  margin: var(--space-5) 0 var(--space-6);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
.lg3__facts {
  display: flex;
  gap: var(--space-6);
  margin: 0;
  padding-top: var(--space-4);
  border-top: 1px solid color-mix(in srgb, var(--landing-ink) 16%, transparent);
}
.lg3__facts dt {
  color: var(--landing-ink-muted);
  font: 600 0.6875rem/1.25rem var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lg3__facts dd {
  margin: 0;
  font: 400 0.875rem/1.25rem var(--font-sans);
}

@keyframes lg3-settle {
  from {
    scale: 1.06;
  }
}
@keyframes lg3-rise {
  from {
    opacity: 0;
    transform: translateY(24%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg3 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lg3 {
    grid-template-columns: minmax(0, 1fr);
  }
  .lg3__panel {
    height: 110vw;
    min-height: 0;
    margin-right: var(--space-4);
  }
  .lg3__facts {
    flex-wrap: wrap;
  }
}
</style>
