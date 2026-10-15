<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { providers, getProvider } from '../domain/providers'
import type { ProviderId } from '../domain/inspection'

const store = useInspectionStore()
const open = ref(false)

const selected = computed(() => getProvider(store.provider))
const busy = computed(() => store.status === 'running')

function choose(id: ProviderId) {
  open.value = false
  store.setProvider(id)
}
</script>

<template>
  <div class="qs-setup">
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
          :disabled="busy"
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
        <select v-model="store.model" aria-label="Model version" :disabled="busy">
          <option v-for="m in selected.models" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </label>
      <span class="qs-hint">Recorded samples need no key and make no network call.</span>
    </div>
  </div>
</template>
