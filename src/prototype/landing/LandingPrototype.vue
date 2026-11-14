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
import VariantF from './VariantF.vue'
import VariantP1 from './VariantP1.vue'
import VariantP2 from './VariantP2.vue'
import VariantP3 from './VariantP3.vue'
import VariantS1 from './VariantS1.vue'
import VariantS2 from './VariantS2.vue'
import VariantS3 from './VariantS3.vue'
import VariantG1 from './VariantG1.vue'
import VariantG2 from './VariantG2.vue'
import VariantG3 from './VariantG3.vue'
import VariantDK1 from './VariantDK1.vue'
import VariantDK2 from './VariantDK2.vue'
import VariantDK3 from './VariantDK3.vue'
import VariantLT1 from './VariantLT1.vue'
import VariantLT2 from './VariantLT2.vue'
import VariantLT3 from './VariantLT3.vue'
import VariantW1 from './VariantW1.vue'

const VARIANTS: { key: string; name: string; view: Component }[] = [
  { key: 'current', name: 'Current landing', view: LandingScreen },
  { key: 'A', name: 'Name in the sky', view: VariantA },
  { key: 'B', name: 'Read at the gate', view: VariantB },
  { key: 'C', name: 'Night quay', view: VariantC },
  { key: 'D', name: 'Poster', view: VariantD },
  { key: 'E', name: 'Long read', view: VariantE },
  { key: 'F', name: 'Composite', view: VariantF },
  { key: 'P1', name: 'Pointers 1', view: VariantP1 },
  { key: 'P2', name: 'Pointers 2', view: VariantP2 },
  { key: 'P3', name: 'Pointers 3', view: VariantP3 },
  { key: 'S1', name: 'Door 1', view: VariantS1 },
  { key: 'S2', name: 'Door 2', view: VariantS2 },
  { key: 'S3', name: 'Door 3', view: VariantS3 },
  { key: 'G1', name: 'Gate photo 1', view: VariantG1 },
  { key: 'G2', name: 'Gate photo 2', view: VariantG2 },
  { key: 'G3', name: 'Gate photo 3', view: VariantG3 },
  { key: 'DK1', name: 'Dark 1', view: VariantDK1 },
  { key: 'DK2', name: 'Dark 2', view: VariantDK2 },
  { key: 'DK3', name: 'Dark 3', view: VariantDK3 },
  { key: 'LT1', name: 'Light 1', view: VariantLT1 },
  { key: 'LT2', name: 'Light 2', view: VariantLT2 },
  { key: 'LT3', name: 'Light 3', view: VariantLT3 },
  { key: 'W1', name: 'Working pick', view: VariantW1 },
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
