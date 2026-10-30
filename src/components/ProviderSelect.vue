<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import {
  capabilitiesOf,
  providers,
  getProvider,
  findModel,
  labelsFor,
  type ProviderInfo,
} from '../domain/providers'
import { keyFormatWarning } from '../domain/keyGate'
import type { ProviderId } from '../domain/inspection'

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
// Advice only (design-system ProviderSelect): it never closes the gate and never repeats the key.
const keyWarning = computed(() => keyFormatWarning(store.provider, store.apiKey))
const keyWarningId = computed(() => `${store.provider}-key-format`)
const open = ref(false)
const revealed = ref(false)
/** The option the arrow keys are on while the list is open (an index into the catalogue). */
const active = ref(0)
const button = useTemplateRef<HTMLButtonElement>('button')
const listbox = useTemplateRef<HTMLElement>('listbox')

const optionId = (id: ProviderId) => `provider-option-${id}`

/** Vendor and API under the name; the vendor only when it differs from the name ("OpenRouter"). */
function subline(p: ProviderInfo): string {
  return p.vendor === p.name ? p.api : `${p.vendor} · ${p.api}`
}

async function openList() {
  active.value = Math.max(
    0,
    providers.findIndex((p) => p.id === store.provider),
  )
  open.value = true
  await nextTick()
  listbox.value?.focus()
}

async function closeList() {
  open.value = false
  await nextTick()
  button.value?.focus()
}

function toggle() {
  if (open.value) void closeList()
  else void openList()
}

function choose(id: ProviderId) {
  void closeList()
  setup.chooseProvider(id)
}

// Keyboard (design-system ProviderSelect): arrows move is-active, Enter selects, Esc closes.
function onListKey(event: KeyboardEvent) {
  const last = providers.length - 1
  if (event.key === 'ArrowDown') active.value = Math.min(last, active.value + 1)
  else if (event.key === 'ArrowUp') active.value = Math.max(0, active.value - 1)
  else if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = last
  else if (event.key === 'Enter' || event.key === ' ') choose(providers[active.value]!.id)
  else if (event.key === 'Escape') {
    // Only the list closes: a settings drawer around it stays open.
    event.stopPropagation()
    void closeList()
  } else {
    if (event.key === 'Tab') open.value = false
    return
  }
  event.preventDefault()
}
</script>

<template>
  <div class="qs-setup rs-setup">
    <div class="qs-fieldset">
      <span id="provider-label" class="qs-fieldset__label">AI provider</span>
      <div class="qs-combo">
        <button
          id="provider-button"
          ref="button"
          class="qs-combo__button"
          type="button"
          aria-haspopup="listbox"
          :aria-expanded="open ? 'true' : 'false'"
          aria-labelledby="provider-label provider-button"
          @click="toggle"
          @keydown.down.prevent="openList"
          @keydown.up.prevent="openList"
        >
          <span class="qs-mono">{{ selected.monogram }}</span>
          <span class="qs-opt-text">
            <strong>{{ selected.name }}</strong>
            <small>{{ subline(selected) }}</small>
          </span>
          <span v-if="selected.recommended" class="qs-cap qs-cap--rec">Recommended</span>
          <span v-else aria-hidden="true"></span>
          <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
        </button>
        <div
          v-if="open"
          ref="listbox"
          class="qs-listbox"
          role="listbox"
          tabindex="0"
          aria-labelledby="provider-label"
          :aria-activedescendant="optionId(providers[active]!.id)"
          @keydown="onListKey"
        >
          <div class="qs-listbox__group">Ready for photos</div>
          <div
            v-for="(p, index) in providers"
            :id="optionId(p.id)"
            :key="p.id"
            role="option"
            :class="['qs-option', { 'is-active': index === active }]"
            :data-testid="optionId(p.id)"
            :aria-selected="p.id === store.provider ? 'true' : 'false'"
            @click="choose(p.id)"
            @mousemove="active = index"
          >
            <span class="qs-mono">{{ p.monogram }}</span>
            <span class="qs-opt-text">
              <strong>{{ p.name }}</strong>
              <small>{{ subline(p) }}</small>
            </span>
            <span class="qs-option__caps">
              <span v-if="p.recommended" class="qs-cap qs-cap--rec">Recommended</span>
              <span v-for="cap in capabilitiesOf(p.id)" :key="cap" class="qs-cap">{{ cap }}</span>
            </span>
          </div>
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
          <option v-for="m in selected.models" :key="m.id" :value="m.id">
            {{ labelsFor(store.provider, m.id).option }}
          </option>
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
          :aria-describedby="keyWarning ? keyWarningId : undefined"
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
      <p v-if="keyWarning" :id="keyWarningId" class="qs-keywarn" role="status">
        <span class="qs-keywarn__title"
          >This doesn't look like an {{ keyWarning.provider }} key.</span
        >
        <span
          >{{ keyWarning.provider }} keys start with
          <span class="qs-keywarn__prefix">{{ keyWarning.prefix }}</span
          >. If yours is right, you can still continue.</span
        >
      </p>
      <span class="qs-hint">{{ copy.hint }}</span>
    </div>
    <div class="qs-fieldset">
      <label class="qs-fieldset__label"
        ><input v-model="store.experimentalDamageLocalisation" type="checkbox" /> Experimental
        damage highlights</label
      >
      <span class="qs-hint"
        >Approximate focal areas on eligible photos. May add a small charge. Applies to the next
        inspection.</span
      >
    </div>
  </div>
</template>
