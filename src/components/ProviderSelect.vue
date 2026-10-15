<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { providers, getProvider } from '../domain/providers'
import type { ProviderId } from '../domain/inspection'

const store = useInspectionStore()
const open = ref(false)
const revealed = ref(false)
/** The key field stays hidden until the presenter asks for a live run. Recorded samples never ask for a key. */
const keyRequested = ref(false)
const keyVisible = computed(() => keyRequested.value || store.apiKey !== '')

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
    <div v-if="store.provider === 'luna' && !keyVisible" class="qs-fieldset">
      <button type="button" class="qs-btn qs-btn--ghost qs-btn--sm" @click="keyRequested = true">
        Run live with an OpenAI key
      </button>
    </div>
    <div v-if="store.provider === 'luna' && keyVisible" class="qs-fieldset">
      <label class="qs-fieldset__label" for="luna-key">OpenAI API key</label>
      <label class="qs-input">
        <input
          id="luna-key"
          v-model="store.apiKey"
          :type="revealed ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          placeholder="Paste your OpenAI key"
          aria-label="OpenAI API key"
          :disabled="busy"
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
          :disabled="busy || store.apiKey === ''"
          @click="store.clearApiKey()"
        >
          Clear
        </button>
      </label>
      <span class="qs-hint"
        >Kept in this tab's memory only, cleared on request, and sent only to OpenAI's Luna endpoint.
        Leave it empty to replay the recorded sample.</span
      >
    </div>
  </div>
</template>
