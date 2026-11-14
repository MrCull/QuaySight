<script setup lang="ts">
// PROTOTYPE variant G1, "In sight": the gate picture fills the whole first screen in daylight. The headline is
// set in the sky, its second line very large, behind the container, the lamps and the gantry. A frosted dock
// along the foot carries the name, one supporting line and the key field.
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
</script>

<template>
  <main class="lg1">
    <GateScene class="lg1__scene" :fy="0.004">
      <template #behind>
        <h1 class="lg1__title"><span>The whole quay,</span><b>in sight.</b></h1>
      </template>
    </GateScene>

    <section class="lg1__dock">
      <p class="lg1__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
      <p class="lg1__sub">
        Photograph a container. Quay Sight reads what is painted on it, marks the damage it
        suspects, and tells you how sure it is.
      </p>
      <ProtoKeyField />
    </section>
  </main>
</template>

<style scoped>
.lg1 {
  position: relative;
  flex: 1;
  display: grid;
  align-items: end;
  min-height: 640px;
  overflow: hidden;
  background: var(--landing-bg);
  color: var(--landing-ink);
  isolation: isolate;
}
.lg1__scene {
  position: absolute;
  z-index: -1;
  inset: 0;
}

/* The headline, in the sky behind the container */
.lg1__title {
  position: absolute;
  left: 12.9%;
  right: 11.3%;
  bottom: 75%;
  display: grid;
  justify-items: center;
  margin: 0;
  color: var(--landing-surface);
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}
.lg1__title span {
  font-size: 3.3cqw;
  line-height: 1;
  letter-spacing: 0.16em;
  animation: lg1-rise 1100ms cubic-bezier(0.16, 0.84, 0.24, 1) 150ms both;
}
.lg1__title b {
  font-size: 10.8cqw;
  font-weight: 700;
  line-height: 0.9;
  animation: lg1-rise 1300ms cubic-bezier(0.16, 0.84, 0.24, 1) 300ms both;
}

/* Dock */
.lg1__dock {
  --lp-align: start;
  --lp-field-width: 100%;
  --lp-field-shadow: 0 0 0 1px color-mix(in srgb, var(--landing-ink) 14%, transparent);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 560px);
  align-items: center;
  gap: clamp(var(--space-5), 3.4vw, var(--space-8));
  margin: var(--space-4);
  padding: var(--space-4) var(--space-5) var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--landing-bg) 80%, transparent);
  backdrop-filter: blur(22px) saturate(1.5);
  box-shadow: var(--shadow-landing);
  animation: lg1-dock 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 500ms both;
}
.lg1__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font: 700 2.25rem/1 var(--font-hero);
  letter-spacing: -0.035em;
  white-space: nowrap;
}
.lg1__brand .qs-logo {
  width: 52px;
  height: 52px;
  color: inherit;
}
.lg1__sub {
  max-width: 27rem;
  margin: 0;
  padding-left: clamp(var(--space-5), 3.4vw, var(--space-8));
  border-left: 1px solid color-mix(in srgb, var(--landing-ink) 20%, transparent);
  color: var(--landing-ink-muted);
  font: 400 1rem/1.5rem var(--font-sans);
  text-wrap: pretty;
}
.lg1__dock :deep(.lp-key__note) {
  margin-top: var(--space-2);
}

@keyframes lg1-rise {
  from {
    opacity: 0;
    transform: translateY(26%);
  }
}
@keyframes lg1-dock {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg1 * {
    animation: none !important;
  }
}
@media (max-width: 1000px) {
  .lg1__dock {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-5);
  }
  .lg1__sub {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
