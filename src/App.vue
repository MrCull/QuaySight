<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from './stores/inspection'
import { useSetupStore } from './stores/setup'
import { findSample } from './domain/demoSamples'
import { needsManifest } from './domain/manifest'
import { DETAIL_IDS } from './composables/detailJump'
import LandingScreen from './components/LandingScreen.vue'
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
import ThemeToggle from './components/ThemeToggle.vue'
import { isTankContainer } from './domain/tankContainer'

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
</script>

<template>
  <div :class="['qs-root', 'rs', { 'rs--landing': setup.view === 'setup' }]">
    <!-- The landing has no top bar. On the inspection screen the top bar and, in demo mode, the demo banner
         stay on screen together. -->
    <div v-if="setup.view === 'inspection'" class="rs-chrome">
      <header class="rs-top">
        <div class="rs-top__brand">
          <span class="qs-brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
          <span class="rs-crumb">Container inspection</span>
        </div>
        <!-- The centre slot keeps its place when New inspection is hidden, so the right side never moves. -->
        <div class="rs-top__centre">
          <NewInspectionAction v-if="store.showNewInspection" />
        </div>
        <!-- Muted technical details on the right, then the theme toggle in the corner. Demo mode has no
             provider settings: the banner's Connect a provider is the way to one. -->
        <div class="rs-top__meta">
          <SettingsChip v-if="!store.demo" />
          <RunChip v-if="recordedRun" :provider="recordedRun.provider" :model="recordedRun.model" />
          <CostIndicator />
          <ThemeToggle />
        </div>
      </header>
      <DemoBanner v-if="store.demo" />
    </div>

    <LandingScreen v-if="setup.view === 'setup'" />

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
        <!-- The panel shows this under its Damage tab, once damage has run to the end. -->
        <DamageView
          v-if="store.record"
          :id="DETAIL_IDS.damage"
          tabindex="-1"
          data-detail
          :assessment="store.record.damage"
          :tank="isTankContainer(store.record)"
          :selected="store.selectedFinding"
          @update:selected="store.selectFinding"
        />
      </ResultsPanel>
    </main>
    <SettingsDrawer v-if="setup.view === 'inspection' && setup.drawerOpen" />
    <footer><BuildStamp /></footer>
  </div>
</template>
