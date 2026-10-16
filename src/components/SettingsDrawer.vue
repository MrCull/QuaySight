<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { useSetupStore } from '../stores/setup'
import ProviderSelect from './ProviderSelect.vue'

/**
 * design-system/components/SettingsDrawer: the setup form in a non-modal side panel.
 * Escape, the close button, Done, Enter in the key field and a click outside each close it.
 * Focus moves in on open; the SettingsChip takes it back on close.
 */
const setup = useSetupStore()
const drawer = useTemplateRef<HTMLElement>('drawer')

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') setup.closeDrawer()
}

/** A press that starts outside the drawer (and off the chip, which toggles it itself) closes it on release. */
let pressedOutside = false

function onPointerDown(event: PointerEvent) {
  const target = event.target as Element | null
  pressedOutside =
    !!target &&
    !drawer.value?.contains(target) &&
    !target.closest('[aria-controls="settings-drawer"]')
}

// Closing on release, after the press has moved focus, lets the chip take focus back only when it went nowhere.
function onPointerUp() {
  if (pressedOutside) setup.closeDrawer()
  pressedOutside = false
}

onMounted(() => {
  drawer.value?.querySelector<HTMLElement>('#provider-button')?.focus()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointerup', onPointerUp, true)
})
</script>

<template>
  <aside
    id="settings-drawer"
    ref="drawer"
    class="qs-drawer"
    role="dialog"
    aria-modal="false"
    aria-labelledby="settings-drawer-title"
  >
    <div class="qs-drawer__head">
      <h2 id="settings-drawer-title" class="qs-drawer__title">Settings</h2>
      <button
        type="button"
        class="qs-btn qs-btn--ghost qs-btn--sm"
        aria-label="Close settings"
        @click="setup.closeDrawer()"
      >
        <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
      </button>
    </div>
    <div class="qs-drawer__body">
      <ProviderSelect @submit="setup.closeDrawer()" />
      <p class="qs-hint rs-drawer__note">
        Changing the provider or model starts a new inspection. Changing only the key keeps the
        screen as it is.
      </p>
    </div>
    <div class="qs-drawer__foot">
      <button
        type="button"
        class="qs-btn qs-btn--secondary qs-btn--sm"
        @click="setup.closeDrawer()"
      >
        Done
      </button>
    </div>
  </aside>
</template>
