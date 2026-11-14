<script setup lang="ts">
// PROTOTYPE (throwaway): five structurally different landings on the real first screen, switchable with
// ?variant=A…E and the floating bar (or the ← → keys). Without the param, and in production builds, the
// current LandingScreen shows. Fold the winner into src/components/LandingScreen.vue and delete this folder.
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import LandingScreen from '../../components/LandingScreen.vue'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import VariantD from './VariantD.vue'
import VariantE from './VariantE.vue'

const VARIANTS: { key: string; name: string; view: Component }[] = [
  { key: 'current', name: 'Current landing', view: LandingScreen },
  { key: 'A', name: 'Annotated photo', view: VariantA },
  { key: 'B', name: 'Night quay', view: VariantB },
  { key: 'C', name: 'Door markings', view: VariantC },
  { key: 'D', name: 'Survey drawing', view: VariantD },
  { key: 'E', name: 'Long read', view: VariantE },
]

const enabled = import.meta.env.DEV
const read = () => new URLSearchParams(window.location.search).get('variant') ?? 'current'
const current = ref(enabled ? read() : 'current')
const index = computed(() =>
  Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === current.value),
  ),
)
const active = computed(() => VARIANTS[index.value]!)

function go(step: number) {
  const next = VARIANTS[(index.value + step + VARIANTS.length) % VARIANTS.length]!
  current.value = next.key
  const url = new URL(window.location.href)
  if (next.key === 'current') url.searchParams.delete('variant')
  else url.searchParams.set('variant', next.key)
  window.history.replaceState(null, '', url)
  window.scrollTo(0, 0)
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable], [role="radiogroup"]')) return
  if (event.key === 'ArrowLeft') go(-1)
  if (event.key === 'ArrowRight') go(1)
}
onMounted(() => enabled && window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <component :is="active.view" :key="active.key" />
  <nav v-if="enabled" class="lp-switch" aria-label="Prototype variants">
    <button type="button" aria-label="Previous variant" @click="go(-1)">←</button>
    <span
      ><b>{{ active.key }}</b> {{ active.name }}</span
    >
    <button type="button" aria-label="Next variant" @click="go(1)">→</button>
  </nav>
</template>

<style scoped>
.lp-switch {
  position: fixed;
  z-index: 50;
  left: 50%;
  bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1);
  border: 2px dashed var(--hazard-fg);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--ink);
  font: 500 0.8125rem/1 var(--font-mono);
  box-shadow: var(--shadow-raised);
  transform: translateX(-50%);
  white-space: nowrap;
}
.lp-switch button {
  width: var(--control-sm);
  height: var(--control-sm);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
</style>
