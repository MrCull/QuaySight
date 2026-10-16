<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { useSetupStore } from './stores/setup'
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
import RunChip from './components/RunChip.vue'

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
// Demo mode has no settings chip, so the run chip names who answered when the sample was recorded.
// A live run is named by the settings chip: changing provider or model blanks the screen, so they agree.
const recordedRun = computed(() =>
  store.demo && store.sample && store.status !== 'idle' ? findSample(store.sample) : null,
)
// After the result lands, the next step is New inspection, not a second charge on the same photo.
const showStart = computed(() => (!store.demo || !!store.photo) && store.status !== 'complete')
// Before any photo, the drop zone or the sample picker has the whole width.
const startScreen = computed(() => !store.photo && !store.record && store.status === 'idle')

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
        <span class="rs-crumb">Container inspection</span>
        <template v-if="setup.view === 'inspection'">
          <!-- Demo mode has no provider settings: the banner's Connect a provider is the way to one. -->
          <SettingsChip v-if="!store.demo" />
          <RunChip v-if="recordedRun" :provider="recordedRun.provider" :model="recordedRun.model" />
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

    <main v-else id="stage" :class="['rs-main', stageClass, { 'rs-main--start': startScreen }]">
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
        <div v-if="showStart" class="rs-startrow">
          <p v-if="needsKey" class="qs-hint rs-gate-hint">
            Enter this provider's key in
            <button type="button" class="qs-link" @click="setup.openDrawer()">settings</button> to
            start.
          </p>
          <button
            type="button"
            class="qs-btn qs-btn--primary qs-btn--lg"
            data-next-step="start"
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
