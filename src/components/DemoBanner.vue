<script setup lang="ts">
import { useSetupStore } from '../stores/setup'

// design-system/components/DemoBanner: on screen for the whole of demo mode. Neutral ink only.
const setup = useSetupStore()
</script>

<template>
  <section class="qs-demobanner" role="region" aria-label="Demo mode">
    <div class="qs-demobanner__inner">
      <i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>
      <div class="qs-demobanner__text">
        <p class="qs-demobanner__title"><b>DEMO</b> — sample results, not a real inspection</p>
        <p class="qs-demobanner__body">Inspecting your own photos needs an API provider.</p>
      </div>
      <button
        type="button"
        class="qs-btn qs-btn--secondary qs-demobanner__action"
        @click="setup.connectProvider()"
      >
        Connect a provider
      </button>
    </div>
  </section>
</template>
