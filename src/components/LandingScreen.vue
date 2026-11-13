<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { getProvider, providers } from '../domain/providers'
import { keyFormatWarning } from '../domain/keyGate'
import { focusNextStep } from './nextStepFocus'
import doors from '../../samples/jdlu-200690-1-rear-doors.jpg'
import doorsLeft from '../../samples/jdlu-200690-2-corner-doors-left.jpg'
import doorsRight from '../../samples/jdlu-200690-3-corner-doors-right.jpg'
import longSide from '../../samples/jdlu-200690-4-long-side.jpg'
import seal from '../../samples/seal-closeup-coyu-0154620.jpg'

// design-system/components/Landing: the first screen. Pick a provider, paste its key, Start. Each provider's
// recommended model is used; the settings chip on the inspection screen changes it. Try the demo needs no key.
const store = useInspectionStore()
const setup = useSetupStore()
const key = useTemplateRef<HTMLInputElement>('key')

// Decoration only: the bundled sample photos, so they carry no alternative text.
const photos = [doors, doorsLeft, doorsRight, longSide, seal]

const copy = computed(() => getProvider(store.provider).keyField)
// Advice only: it never closes the gate and never repeats the key.
const keyWarning = computed(() => keyFormatWarning(store.provider, store.apiKey))

// Shown after Start is pressed without a key; goes once a key makes Start ready.
const needsKey = ref(false)
watch(
  () => setup.canContinue,
  (ready) => {
    if (ready) needsKey.value = false
  },
)

// After Start, the photo drop zone is the next step. Without a key, Start points to the key field instead:
// it is never drawn as switched off, so pressing it has to say what is missing.
function start() {
  if (setup.continueToInspection()) {
    void focusNextStep('photo')
    return
  }
  needsKey.value = true
  key.value?.focus()
}

// Arrow keys move the choice, as in any radio group.
function onPickKey(event: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!step) return
  event.preventDefault()
  const index = providers.findIndex((p) => p.id === store.provider)
  const next = providers[(index + step + providers.length) % providers.length]!
  setup.chooseProvider(next.id)
  const group = event.currentTarget as HTMLElement
  group.querySelector<HTMLElement>(`[data-testid="provider-option-${next.id}"]`)?.focus()
}
</script>

<template>
  <main class="qs-landing">
    <div class="qs-landing__top">
      <ul class="qs-landing__photos" aria-hidden="true">
        <li v-for="photo in photos" :key="photo"><img :src="photo" alt="" /></li>
      </ul>
      <span class="qs-landing__brand"><i class="qs-logo" aria-hidden="true"></i>Quay Sight</span>
    </div>
    <h1 class="qs-landing__title">Container inspection from photos.</h1>
    <form class="qs-landing__field" novalidate @submit.prevent="start">
      <div class="qs-landing__pick" role="radiogroup" aria-label="AI provider" @keydown="onPickKey">
        <button
          v-for="p in providers"
          :key="p.id"
          type="button"
          role="radio"
          class="qs-landing__opt"
          :data-testid="`provider-option-${p.id}`"
          :aria-checked="p.id === store.provider ? 'true' : 'false'"
          :tabindex="p.id === store.provider ? 0 : -1"
          @click="setup.chooseProvider(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
      <input
        :id="`${store.provider}-key`"
        ref="key"
        class="qs-landing__key"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="API key"
        :value="store.apiKey"
        :aria-label="copy.label"
        :aria-describedby="
          needsKey ? 'landing-needs-key' : keyWarning ? 'landing-key-format' : undefined
        "
        @input="store.setApiKey(($event.target as HTMLInputElement).value)"
      />
      <!-- Enter in the key field submits the form; the button starts on its own click. -->
      <button
        type="button"
        class="qs-landing__go"
        :aria-disabled="!setup.canContinue"
        @click="start"
      >
        Start
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12h16M14 6l6 6-6 6" />
        </svg>
      </button>
    </form>
    <p v-if="needsKey" id="landing-needs-key" class="qs-landing__hint" role="status">
      Paste your API key to start.
    </p>
    <p v-else-if="keyWarning" id="landing-key-format" class="qs-landing__hint" role="status">
      <b>This doesn't look like an {{ keyWarning.provider }} key.</b>
      {{ keyWarning.provider }} keys start with <code>{{ keyWarning.prefix }}</code
      >. If yours is right, you can still start.
    </p>
    <p class="qs-landing__note">
      <span>Your key stays in this tab.</span>
      <button type="button" class="qs-landing__demo" @click="setup.enterDemo()">
        Try the demo
      </button>
    </p>
  </main>
</template>
