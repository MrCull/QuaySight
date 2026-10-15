<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { getProvider } from './domain/providers'
import ProviderSelect from './components/ProviderSelect.vue'
import PhotoPanel from './components/PhotoPanel.vue'
import ResultsPanel from './components/ResultsPanel.vue'
import DamageView from './components/damage/DamageView.vue'

const store = useInspectionStore()

const running = computed(() => store.status === 'running')
const canStart = computed(() => !!store.photo && !running.value)
const runLabel = computed(() => {
  const p = getProvider(store.provider)
  return `${p.name} · ${store.model}`
})

// Arrival choreography: .qs-arriving while analysing, .qs-arrived once the record lands.
const stageClass = computed(() => {
  if (store.status === 'complete') return 'qs-arrived'
  if (store.status === 'running') return 'qs-arriving'
  return ''
})

function start() {
  void store.start()
}
</script>

<template>
  <div class="qs-root rs">
    <header class="rs-top">
      <span class="qs-brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
      <span class="rs-crumb">Container inspection <span>· recorded walking skeleton</span></span>
      <span v-if="store.status !== 'idle'" class="rs-run">{{ runLabel }}</span>
      <span class="rs-spacer"></span>
    </header>

    <main id="stage" :class="['rs-main', stageClass]">
      <section class="rs-left">
        <ProviderSelect />
        <PhotoPanel />
        <div>
          <button
            type="button"
            class="qs-btn qs-btn--primary"
            :disabled="!canStart"
            :aria-busy="running ? 'true' : 'false'"
            @click="start"
          >
            {{ running ? 'Analysing…' : 'Start inspection' }}
          </button>
        </div>
      </section>
      <ResultsPanel />
      <DamageView v-if="store.record" :assessment="store.record.damage" />
    </main>
  </div>
</template>
