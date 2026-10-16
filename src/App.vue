<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { getProvider } from './domain/providers'
import ProviderSelect from './components/ProviderSelect.vue'
import PhotoPanel from './components/PhotoPanel.vue'
import ResultsPanel from './components/ResultsPanel.vue'
import DamageView from './components/damage/DamageView.vue'
import CostIndicator from './components/CostIndicator.vue'
import NewInspectionAction from './components/NewInspectionAction.vue'

const store = useInspectionStore()

const running = computed(() => store.status === 'running')
// The key gate lives in the store: a photo, a key for the selected provider and a valid model.
const canStart = computed(() => store.canStart && !running.value)
const needsKey = computed(() => !!store.photo && !store.canStart && !running.value)
const runLabel = computed(() => {
  const p = getProvider(store.provider)
  return `${p.name} · ${store.model}${store.mode === 'live' ? ' · live' : ''}`
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
      <CostIndicator />
      <NewInspectionAction />
    </header>

    <main id="stage" :class="['rs-main', stageClass]">
      <section class="rs-left">
        <ProviderSelect />
        <PhotoPanel />
        <div
          v-if="store.record?.source === 'recorded'"
          class="rs-sample"
          role="group"
          aria-label="Recorded sample options"
        >
          <span class="rs-sample__title">Sample options (next run)</span>
          <label
            ><input
              type="checkbox"
              :checked="store.scenario === 'unidentified'"
              @change="
                store.scenario = ($event.target as HTMLInputElement).checked
                  ? 'unidentified'
                  : 'identified'
              "
            />
            Container ID not visible in this sample</label
          >
          <label
            ><input
              type="checkbox"
              :checked="store.retryFails"
              @change="store.retryFails = ($event.target as HTMLInputElement).checked"
            />
            Make the manifest check fail</label
          >
        </div>
        <div>
          <p v-if="needsKey" class="qs-hint rs-gate-hint">
            Enter this provider's key to start. A key is needed even for a recorded sample.
          </p>
          <button
            type="button"
            class="qs-btn qs-btn--primary"
            :disabled="!canStart"
            :aria-busy="running ? 'true' : 'false'"
            @click="start"
          >
            {{
              running
                ? 'Analysing…'
                : store.mode === 'live'
                  ? 'Run live inspection'
                  : 'Start inspection'
            }}
          </button>
        </div>
      </section>
      <ResultsPanel />
      <DamageView
        v-if="store.record"
        :assessment="store.record.damage"
        :selected="store.selectedFinding"
        @update:selected="store.selectFinding"
      />
    </main>
  </div>
</template>
