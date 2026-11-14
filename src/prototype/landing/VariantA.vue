<script setup lang="ts">
// PROTOTYPE variant A, "Name in the sky": the sanctioned landing shape (picture across the top fading into
// the page, one line, one field) with one picture instead of five, and the name standing in the sky behind
// the container and the gantry.
import GateScene from './GateScene.vue'
import ProtoKeyField from './ProtoKeyField.vue'
</script>

<template>
  <main class="la">
    <div class="la__top">
      <GateScene class="la__scene" :fy="0.006">
        <template #behind>
          <p class="la__name" aria-hidden="true">Quay Sight</p>
        </template>
      </GateScene>
      <p class="la__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</p>
    </div>
    <div class="la__body">
      <h1 class="la__title">It's all written on the doors.</h1>
      <p class="la__sub">
        Photograph a container. Quay Sight reads the ID, weights, seal and placards, marks the
        damage it suspects, and tells you how sure it is.
      </p>
      <ProtoKeyField />
    </div>
  </main>
</template>

<style scoped>
.la {
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--landing-bg);
  color: var(--landing-ink);
}
.la__top {
  position: relative;
  height: clamp(380px, 66vh, 900px);
}
.la__scene {
  height: 100%;
}
.la__top::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 58%, var(--landing-bg) 93%);
  pointer-events: none;
}
.la__name {
  position: absolute;
  left: 12.6%;
  right: 11%;
  top: 14.9%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.16em;
  margin: 0;
  color: var(--landing-surface);
  font: 700 13.4cqw/1 var(--font-display);
  letter-spacing: 0.035em;
  text-transform: uppercase;
  white-space: nowrap;
  animation: la-rise 1400ms cubic-bezier(0.16, 0.84, 0.24, 1) 200ms both;
}
.la__name .qs-logo {
  width: 0.72em;
  height: 0.72em;
  color: inherit;
}
.la__body {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  margin-top: calc(var(--space-8) * -1.6);
  padding: 0 var(--space-5) var(--space-6);
  text-align: center;
}
.la__brand {
  position: absolute;
  z-index: 1;
  left: clamp(var(--space-4), 4vw, var(--space-8));
  top: var(--space-5);
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-2) var(--space-5) var(--space-2) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--landing-surface);
  font: 700 1.625rem/1 var(--font-hero);
  letter-spacing: -0.025em;
  box-shadow: var(--shadow-landing);
}
.la__brand .qs-logo {
  width: 36px;
  height: 36px;
  color: inherit;
}
.la__title {
  margin: 0;
  font: 700 clamp(2.5rem, 5.4vw, 5.75rem)/0.98 var(--font-hero);
  letter-spacing: -0.045em;
  text-wrap: balance;
}
.la__sub {
  max-width: 40rem;
  margin: var(--space-4) 0 var(--space-5);
  color: var(--landing-ink-muted);
  font: 400 1.125rem/1.75rem var(--font-sans);
  text-wrap: pretty;
}
@keyframes la-rise {
  from {
    opacity: 0;
    transform: translateY(22%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .la * {
    animation: none !important;
  }
}
</style>
