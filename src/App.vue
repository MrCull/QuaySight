<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { useSetupStore } from './stores/setup'
import { labelsFor } from './domain/providers'
import { findSample } from './domain/demoSamples'
import SetupCard from './components/SetupCard.vue'
import SettingsChip from './components/SettingsChip.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import PhotoPanel from './components/PhotoPanel.vue'
import ResultsPanel from './components/ResultsPanel.vue'
import DamageView from './components/damage/DamageView.vue'
import CostIndicator from './components/CostIndicator.vue'
import NewInspectionAction from './components/NewInspectionAction.vue'
import DemoBanner from './components/DemoBanner.vue'
import SamplePicker from './components/SamplePicker.vue'

const store = useInspectionStore()
const setup = useSetupStore()

const running = computed(() => store.status === 'running')
// The key gate lives in the store: a photo, a key for the selected provider and a valid model.
const canStart = computed(() => store.canStart && !running.value)
const needsKey = computed(() => !store.demo && !!store.photo && !store.canStart && !running.value)
// Demo mode: a sample-only option while its manifest offer is open.
const showSampleOptions = computed(
  () => store.demo && store.record?.source === 'recorded' && store.record.containerId === null,
)
const runLabel = computed(() => {
  // A demo run names who answered when its sample was recorded, not the provider in settings.
  const run = store.demo && store.sample ? findSample(store.sample) : store
  const name = labelsFor(run.provider, run.model).prose
  return `${name} · ${run.model}${store.mode === 'live' ? ' · live' : ''}`
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
    <!-- The top bar and, in demo mode, the demo banner stay on screen together. -->
    <div class="rs-chrome">
      <header class="rs-top">
        <span class="qs-brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
        <span class="rs-crumb">Container inspection <span>· recorded walking skeleton</span></span>
        <template v-if="setup.view === 'inspection'">
          <!-- Demo mode has no provider settings: the banner's Connect a provider is the way to one. -->
          <SettingsChip v-if="!store.demo" />
          <span v-if="store.status !== 'idle'" class="rs-run">{{ runLabel }}</span>
          <span class="rs-spacer"></span>
          <CostIndicator />
          <NewInspectionAction />
        </template>
      </header>
      <DemoBanner v-if="setup.view === 'inspection' && store.demo" />
    </div>

    <main v-if="setup.view === 'setup'" class="rs-setupview">
      <SetupCard />
    </main>

    <main v-else id="stage" :class="['rs-main', stageClass]">
      <section class="rs-left">
        <SamplePicker v-if="store.demo && !store.photo" />
        <PhotoPanel v-else />
        <div
          v-if="showSampleOptions"
          class="rs-sample"
          role="group"
          aria-label="Recorded sample options"
        >
          <span class="rs-sample__title">Sample option</span>
          <label
            ><input
              type="checkbox"
              :checked="store.retryFails"
              @change="store.retryFails = ($event.target as HTMLInputElement).checked"
            />
            Make the manifest check fail</label
          >
        </div>
        <div v-if="!store.demo || store.photo">
          <p v-if="needsKey" class="qs-hint rs-gate-hint">
            Enter this provider's key in settings to start.
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
    <SettingsDrawer v-if="setup.view === 'inspection' && setup.drawerOpen" />
  </div>
</template>
