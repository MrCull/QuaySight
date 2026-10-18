<script setup lang="ts">
import { computed } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { focusNextStep } from './nextStepFocus'

// design-system/components/NewInspection: one click, no confirmation, enabled even while a run is in flight.
// Focus then moves to the photo drop zone, or in demo mode to the sample picker.
const store = useInspectionStore()

// While a run is in flight the same button reads Cancel: it stops what is in flight and clears to the picker.
const running = computed(() => store.status === 'running')

function newInspection() {
  store.newInspection()
  void focusNextStep('photo')
}
</script>

<template>
  <button
    type="button"
    class="qs-btn qs-btn--primary qs-btn--sm qs-newinsp"
    data-next-step="start"
    @click="newInspection"
  >
    {{ running ? 'Cancel' : 'New inspection' }}
  </button>
</template>
