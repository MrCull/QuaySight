<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { useSetupStore } from '../stores/setup'
import ProviderSelect from './ProviderSelect.vue'

// design-system/components/SetupCard: the first screen. Continue waits for a key; Enter in the key field continues.
const setup = useSetupStore()
const card = useTemplateRef<HTMLElement>('card')

// Focus starts on the first setup control.
onMounted(() => card.value?.querySelector<HTMLElement>('#provider-button')?.focus())
</script>

<template>
  <section ref="card" class="qs-setupcard" role="region" aria-labelledby="setup-title">
    <div class="qs-setupcard__head">
      <h1 id="setup-title" class="qs-setupcard__title">Set up a provider</h1>
      <p class="qs-setupcard__lede">
        Choose who analyses the photos, then paste that provider's API key.
      </p>
    </div>
    <ProviderSelect @submit="setup.continueToInspection()" />
    <div class="qs-setupcard__actions">
      <button
        type="button"
        class="qs-btn qs-btn--primary qs-btn--lg"
        :disabled="!setup.canContinue"
        @click="setup.continueToInspection()"
      >
        Continue
      </button>
    </div>
  </section>
</template>
