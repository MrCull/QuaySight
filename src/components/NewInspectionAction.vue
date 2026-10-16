<script setup lang="ts">
import { useInspectionStore } from '../stores/inspection'

// design-system/components/NewInspection: one click, no confirmation, enabled even while a run is in flight.
const store = useInspectionStore()
</script>

<template>
  <button
    type="button"
    class="qs-btn qs-btn--secondary qs-btn--sm qs-newinsp"
    @click="store.newInspection()"
  >
    New inspection
  </button>
</template>
