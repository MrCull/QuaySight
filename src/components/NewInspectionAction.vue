<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'
import { focusNextStep } from './nextStepFocus'

// design-system/components/NewInspection: one click, no confirmation, enabled even while a run is in flight.
// Focus then moves to the photo drop zone, or in demo mode to the sample picker.
const store = useInspectionStore()

function newInspection() {
  store.newInspection()
  void focusNextStep('photo')
}
</script>

<template>
  <button
    type="button"
    class="qs-btn qs-btn--secondary qs-btn--sm qs-newinsp"
    @click="newInspection"
  >
    New inspection
  </button>
</template>
