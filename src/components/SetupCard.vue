<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { useSetupStore } from '../stores/setup'
import ProviderSelect from './ProviderSelect.vue'
import { focusNextStep } from './nextStepFocus'

// design-system/components/SetupCard: the first screen. Continue waits for a key; Enter in the key field continues.
// Under the card, Enter as demo user needs no key.
const setup = useSetupStore()
const card = useTemplateRef<HTMLElement>('card')

// Shown after Continue is pressed without a key; goes once a key makes Continue ready.
const needsKey = ref(false)
watch(
  () => setup.canContinue,
  (ready) => {
    if (ready) needsKey.value = false
  },
)

// After Continue, the photo drop zone is the next step. Without a key, Continue points to the key field instead:
// it is never drawn as switched off, so pressing it has to say what is missing.
function continueToInspection() {
  if (setup.continueToInspection()) {
    void focusNextStep('photo')
    return
  }
  needsKey.value = true
  card.value?.querySelector<HTMLInputElement>('input[id$="-key"]')?.focus()
}

// Focus starts on the first setup control.
onMounted(() => card.value?.querySelector<HTMLElement>('#provider-button')?.focus())
</script>

<template>
  <section ref="card" class="qs-setupcard" role="region" aria-labelledby="setup-title">
    <div class="qs-setupcard__head">
      <h2 id="setup-title" class="qs-setupcard__title">Set up a provider</h2>
      <p class="qs-setupcard__lede">
        Choose who analyses the photos, then paste that provider's API key.
      </p>
    </div>
    <ProviderSelect @submit="continueToInspection" />
    <div class="qs-setupcard__actions">
      <button
        type="button"
        class="qs-btn qs-btn--primary qs-btn--lg"
        :aria-disabled="!setup.canContinue"
        :aria-describedby="needsKey ? 'setup-needs-key' : undefined"
        @click="continueToInspection"
      >
        Continue
      </button>
      <p v-if="needsKey" id="setup-needs-key" class="qs-setupcard__hint" role="status">
        Paste your API key above to continue.
      </p>
    </div>
  </section>
  <!-- Visitors without a key: demo mode, the bundled samples only (design-system DemoBanner). -->
  <div class="qs-setupcard__after rs-demo-offer">
    <span class="rs-demo-offer__or qs-type-label" aria-hidden="true">or</span>
    <button
      type="button"
      class="qs-btn qs-btn--secondary qs-btn--lg rs-demo-offer__button"
      aria-describedby="demo-offer-why"
      @click="setup.enterDemo()"
    >
      <i class="qs-glyph qs-glyph--recorded" aria-hidden="true"></i>Enter as demo user
    </button>
    <p id="demo-offer-why" class="rs-demo-offer__why qs-type-body-sm">
      Sample containers with saved results. No key, no charge.
    </p>
  </div>
</template>
