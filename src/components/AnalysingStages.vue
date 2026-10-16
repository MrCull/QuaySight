<script setup lang="ts">
import { computed } from 'vue'
import { ANALYSING_STAGES } from '../domain/analysingStages'
import { findSample } from '../domain/demoSamples'
import { labelsFor } from '../domain/providers'
import { useInspectionStore } from '../stores/inspection'

const store = useInspectionStore()
// A sample names the model it was recorded with; a live run names the model in settings.
const modelName = computed(() => {
  const run = store.demo && store.sample ? findSample(store.sample) : store
  return labelsFor(run.provider, run.model).model
})
</script>

<template>
  <div class="rs-stagecard">
    <div class="rs-stagecard__k">Analysing with {{ modelName }}</div>
    <ol class="qs-stages" aria-live="polite">
      <li
        v-for="(stage, index) in ANALYSING_STAGES"
        :key="stage"
        :class="['qs-stage', index === 0 ? 'qs-stage--active' : '']"
      >
        <span class="qs-stage__dot"></span>
        <span class="qs-stage__title">{{ stage }}</span>
        <span class="qs-stage__time"></span>
      </li>
    </ol>
  </div>
</template>
