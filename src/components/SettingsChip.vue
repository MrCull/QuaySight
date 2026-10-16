<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { useSetupStore } from '../stores/setup'
import { getProvider, labelsFor } from '../domain/providers'
import { hasKey } from '../domain/keyGate'

/**
 * design-system/components/SettingsChip: provider, model and key status in the top bar.
 * Never shows any part of the key. Opens the settings drawer; focus comes back here when it closes.
 */
const store = useInspectionStore()
const setup = useSetupStore()
const button = useTemplateRef<HTMLButtonElement>('button')

const provider = computed(() => getProvider(store.provider))
// The company the key belongs to, and the model by its display name (spec #16: "OpenRouter · Jev latest").
const vendor = computed(() => provider.value.vendor)
const modelName = computed(() => labelsFor(store.provider, store.model).model)
const keySet = computed(() => hasKey(store.apiKey))
const keyLabel = computed(() => (keySet.value ? 'key set' : 'no key'))
const modeLabel = computed(() => (store.mode === 'recorded' ? 'Recorded sample' : 'Live'))
const summary = computed(
  () => `${vendor.value} · ${modelName.value} · ${keyLabel.value} · ${modeLabel.value}`,
)

// Focus comes back here when the drawer closes, unless a click outside already put it on another control.
watch(
  () => setup.drawerOpen,
  (open, wasOpen) => {
    if (open || !wasOpen) return
    void nextTick(() => {
      const active = document.activeElement
      if (!active || active === document.body) button.value?.focus()
    })
  },
)

function toggle() {
  if (setup.drawerOpen) setup.closeDrawer()
  else setup.openDrawer()
}
</script>

<template>
  <button
    ref="button"
    type="button"
    :class="['qs-settingschip', { 'qs-settingschip--nokey': !keySet }]"
    aria-haspopup="dialog"
    :aria-expanded="setup.drawerOpen ? 'true' : 'false'"
    aria-controls="settings-drawer"
    :aria-label="`Settings: ${summary}`"
    @click="toggle"
  >
    <span class="qs-mono" aria-hidden="true">{{ provider.monogram }}</span>
    <span class="qs-settingschip__text"
      >{{ vendor }} · <span class="qs-settingschip__model">{{ modelName }}</span> ·
      <span class="qs-settingschip__key">{{ keyLabel }}</span> · {{ modeLabel }}</span
    >
    <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
  </button>
</template>
