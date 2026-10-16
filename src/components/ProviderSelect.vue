<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { providers, getProvider, findModel } from '../domain/providers'
import type { ProviderId } from '../domain/inspection'
import { hasKey } from '../domain/keyGate'

/**
 * design-system/components/ProviderSelect: provider, model and key. The same form renders in the
 * SetupCard and the SettingsDrawer. Every word about the key comes from the catalogue.
 * A provider or model change runs New inspection (setup store); a key change resets nothing.
 */
const emit = defineEmits<{ submit: [] }>()

const store = useInspectionStore()
const setup = useSetupStore()
const selected = computed(() => getProvider(store.provider))
const copy = computed(() => selected.value.keyField)
const model = computed(() => findModel(store.provider, store.model))
const open = ref(false)
const revealed = ref(false)

function choose(id: ProviderId) {
  open.value = false
  setup.chooseProvider(id)
}
</script>

<template>
  <div class="qs-setup rs-setup">
    <div class="qs-fieldset">
      <span id="provider-label" class="qs-fieldset__label">AI provider</span>
      <div class="qs-combo">
        <button
          id="provider-button"
          class="qs-combo__button"
          type="button"
          aria-haspopup="listbox"
          :aria-expanded="open ? 'true' : 'false'"
          aria-labelledby="provider-label provider-button"
          @click="open = !open"
        >
          <span class="qs-mono">{{ selected.monogram }}</span>
          <span class="qs-opt-text">
            <strong>{{ selected.name }}</strong>
            <small>{{ selected.vendor }} · {{ selected.api }}</small>
          </span>
          <span class="qs-cap qs-cap--rec">Recommended</span>
          <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
        </button>
        <div v-if="open" class="qs-listbox" role="listbox" aria-labelledby="provider-label">
          <div class="qs-listbox__group">Ready for photos</div>
          <button
            v-for="p in providers"
            :key="p.id"
            type="button"
            role="option"
            class="qs-option"
            :aria-selected="p.id === store.provider ? 'true' : 'false'"
            @click="choose(p.id)"
          >
            <span class="qs-mono">{{ p.monogram }}</span>
            <span class="qs-opt-text">
              <strong>{{ p.name }}</strong>
              <small>{{ p.vendor }} · {{ p.api }}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
    <div class="qs-fieldset">
      <span class="qs-fieldset__label">Model version</span>
      <label class="qs-input">
        <select
          :value="store.model"
          aria-label="Model version"
          @change="setup.chooseModel(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in selected.models" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </label>
      <span v-if="model?.movingTarget" class="qs-hint"
        >Moving target: {{ model.maker }} points this alias at its newest release. The version that
        answers is recorded with each result.</span
      >
    </div>
    <div class="qs-fieldset">
      <label class="qs-fieldset__label" :for="`${store.provider}-key`">{{ copy.label }}</label>
      <label class="qs-input">
        <input
          :id="`${store.provider}-key`"
          :value="store.apiKey"
          @input="store.setApiKey(($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="emit('submit')"
          :type="revealed ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          :placeholder="copy.placeholder"
          :aria-label="copy.label"
        />
        <button
          type="button"
          class="qs-btn qs-btn--ghost qs-btn--sm"
          :aria-label="revealed ? 'Hide key' : 'Show key'"
          :aria-pressed="revealed ? 'true' : 'false'"
          @click="revealed = !revealed"
        >
          <i class="qs-glyph qs-glyph--eye" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="qs-btn qs-btn--ghost qs-btn--sm"
          :disabled="store.apiKey === ''"
          @click="store.clearApiKey()"
        >
          Clear
        </button>
      </label>
      <span class="qs-hint">{{ copy.hint }}</span>
    </div>
    <label v-if="hasKey(store.apiKey)" class="rs-setup__replay">
      <input v-model="store.replaySample" type="checkbox" />
      Replay the recorded sample instead (no network call)
    </label>
  </div>
</template>
