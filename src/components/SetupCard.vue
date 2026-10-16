<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { useSetupStore } from '../stores/setup'
import ProviderSelect from './ProviderSelect.vue'
import { focusNextStep } from './nextStepFocus'

// design-system/components/SetupCard: the first screen. Continue waits for a key; Enter in the key field continues.
// Under the card, Enter as demo user needs no key.
const setup = useSetupStore()
const card = useTemplateRef<HTMLElement>('card')

// After Continue, the photo drop zone is the next step.
function continueToInspection() {
  if (setup.continueToInspection()) void focusNextStep('photo')
}

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
    <ProviderSelect @submit="continueToInspection" />
    <div class="qs-setupcard__actions">
      <button
        type="button"
        class="qs-btn qs-btn--primary qs-btn--lg"
        :disabled="!setup.canContinue"
        @click="continueToInspection"
      >
        Continue
      </button>
    </div>
  </section>
  <!-- Visitors without a key: demo mode, the bundled samples only (design-system DemoBanner). -->
  <div class="qs-setupcard__after">
    <button type="button" class="qs-setupcard__demo" @click="setup.enterDemo()">
      Enter as demo user
    </button>
  </div>
</template>
