<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { useSetupStore } from './stores/setup'
import { findSample } from './domain/demoSamples'
import { needsManifest } from './domain/manifest'
import { DETAIL_IDS } from './composables/detailJump'
import SetupCard from './components/SetupCard.vue'
import SettingsChip from './components/SettingsChip.vue'
import BuildStamp from './components/BuildStamp.vue'
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

// Demo mode: a sample-only option while its manifest offer is open (the recorded ID has a position unread).
const showSampleOptions = computed(
  () =>
    store.demo && store.record?.source === 'recorded' && needsManifest(store.record.containerId),
)
// Demo mode has no settings chip, so the run chip names who answered when the sample was recorded.
// A live run is named by the settings chip: changing provider or model blanks the screen, so they agree.
const recordedRun = computed(() =>
  store.demo && store.sample && store.status !== 'idle' ? findSample(store.sample) : null,
)
// Before any photo, the drop zone or the sample picker has the whole width.
const startScreen = computed(() => !store.photo && !store.record && store.status === 'idle')

// Arrival choreography: .qs-arriving while analysing, .qs-arrived once the record lands.
const stageClass = computed(() => {
  if (store.status === 'complete') return 'qs-arrived'
  if (store.status === 'running') return 'qs-arriving'
  return ''
})

// The damage view shows once damage has run to the end. After a failed damage request it is left out:
// the error notice names damage as not checked, and "not assessed in this inspection" would be untrue.
const showDamageView = computed(
  () => store.landed('damage') && store.stages.find((s) => s.id === 'damage')?.state !== 'failed',
)
</script>

<template>
  <div class="qs-root rs">
    <!-- The top bar and, in demo mode, the demo banner stay on screen together. -->
    <div class="rs-chrome">
      <header class="rs-top">
        <div class="rs-top__brand">
          <span class="qs-brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
          <span class="rs-crumb">Container inspection</span>
        </div>
        <template v-if="setup.view === 'inspection'">
          <!-- The centre slot keeps its place when New inspection is hidden, so the right side never moves. -->
          <div class="rs-top__centre">
            <NewInspectionAction v-if="store.showNewInspection" />
          </div>
          <!-- Muted technical details on the right. Demo mode has no provider settings: the banner's Connect a provider is the way to one. -->
          <div class="rs-top__meta">
            <SettingsChip v-if="!store.demo" />
            <RunChip
              v-if="recordedRun"
              :provider="recordedRun.provider"
              :model="recordedRun.model"
            />
            <CostIndicator />
          </div>
        </template>
      </header>
      <DemoBanner v-if="setup.view === 'inspection' && store.demo" />
    </div>

    <main v-if="setup.view === 'setup'" class="rs-setupview">
      <SetupCard />
    </main>

    <main v-else id="stage" :class="['rs-main', stageClass, { 'rs-main--start': startScreen }]">
      <section class="rs-band">
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
      </section>
      <ResultsPanel>
        <DamageView
          v-if="showDamageView && store.record"
          :id="DETAIL_IDS.damage"
          tabindex="-1"
          data-detail
          :assessment="store.record.damage"
          :selected="store.selectedFinding"
          @update:selected="store.selectFinding"
        />
      </ResultsPanel>
    </main>
    <SettingsDrawer v-if="setup.view === 'inspection' && setup.drawerOpen" />
    <footer><BuildStamp /></footer>
  </div>
</template>
