<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { providers, getProvider, isMovingTarget } from '../domain/providers'
import type { ProviderId } from '../domain/inspection'
import { hasKey, selectorView } from '../domain/keyGate'

/** Key field copy per provider. Each key is labelled for the one endpoint that receives it. */
const keyCopy: Record<ProviderId, { label: string; placeholder: string; hint: string }> = {
  luna: {
    label: 'OpenAI API key',
    placeholder: 'Paste your OpenAI key',
    hint: "Kept in this tab's memory only, cleared on request, and sent only to OpenAI's Luna endpoint, and only for a live run.",
  },
  jev: {
    label: 'TypeSafe API key',
    placeholder: 'Paste your TypeSafe console key',
    hint: "Kept in this tab's memory only, cleared on request, and sent only to TypeSafe's System One endpoint, and only for a live run. It needs a TypeSafe console key from console.typesafe.ai.",
  },
}

const store = useInspectionStore()
const copy = computed(() => keyCopy[store.provider])
const open = ref(false)
const revealed = ref(false)
/**
 * Expanded while the presenter sets up. A valid key collapses the row once they press Enter,
 * press Done, or move focus out of this block, so typing the key never unmounts its own field.
 */
const editing = ref(true)

const view = computed(() =>
  selectorView({
    provider: store.provider,
    model: store.model,
    apiKey: store.apiKey,
    editing: editing.value,
  }),
)
const collapsed = computed(() => view.value === 'collapsed')
const selected = computed(() => getProvider(store.provider))
const busy = computed(() => store.status === 'running')
const modeLabel = computed(() => (store.mode === 'recorded' ? 'Recorded sample' : 'Live'))

// A new provider or a cleared key reopens the entry view.
watch(
  () => store.provider,
  () => {
    editing.value = true
  },
)
watch(
  () => store.apiKey,
  (key) => {
    if (!hasKey(key)) editing.value = true
  },
)

function choose(id: ProviderId) {
  open.value = false
  store.setProvider(id)
}

function finishEntry() {
  if (hasKey(store.apiKey)) editing.value = false
}

/**
 * Only focus leaving the key field counts. Other focus changes (for example the Edit button being
 * removed when the row expands) must not collapse the row straight away.
 */
function onFocusOut(event: FocusEvent) {
  const field = event.target as HTMLElement
  if (field.id !== `${store.provider}-key`) return
  const root = event.currentTarget as HTMLElement
  const next = event.relatedTarget as Node | null
  if (next && root.contains(next)) return
  finishEntry()
}
</script>

<template>
  <div class="qs-setup rs-setup" @focusout="onFocusOut">
    <div
      v-if="collapsed"
      class="rs-setup__summary"
      role="group"
      aria-label="Provider, model and key"
    >
      <span class="qs-mono rs-setup__mono" aria-hidden="true">{{ selected.monogram }}</span>
      <span class="rs-setup__text"
        >{{ selected.name }} · <span class="qs-mono">{{ store.model }}</span> · key set ·
        {{ modeLabel }}</span
      >
      <button
        type="button"
        class="qs-btn qs-btn--ghost qs-btn--sm"
        :disabled="busy"
        @click="editing = true"
      >
        Edit
      </button>
    </div>

    <template v-else>
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
        <span v-if="isMovingTarget(store.provider, store.model)" class="qs-hint"
          >Moving target: TypeSafe points this alias at its newest release. The version that answers
          is recorded with each result.</span
        >
      </div>
      <div class="qs-fieldset">
        <label class="qs-fieldset__label" :for="`${store.provider}-key`">{{ copy.label }}</label>
        <label class="qs-input">
          <input
            :id="`${store.provider}-key`"
            :value="store.apiKey"
            @input="store.setApiKey(($event.target as HTMLInputElement).value)"
            @keydown.enter="finishEntry"
            :type="revealed ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            :placeholder="copy.placeholder"
            :aria-label="copy.label"
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
        <span class="qs-hint">
          A key is needed to start, even for a recorded sample. {{ copy.hint }}
        </span>
      </div>
      <div v-if="hasKey(store.apiKey)" class="rs-setup__options">
        <label class="rs-setup__replay">
          <input v-model="store.replaySample" type="checkbox" :disabled="busy" />
          Replay the recorded sample instead (no network call)
        </label>
        <button type="button" class="qs-btn qs-btn--secondary qs-btn--sm" @click="finishEntry">
          Done
        </button>
      </div>
    </template>
  </div>
</template>
