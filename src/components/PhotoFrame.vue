<script setup lang="ts">
/**
 * One container photo on the stage: the single-photo stage and each tile of the 2–4 photo grid. It is a button
 * that asks to enlarge the photo (PhotoViewer) on a click, Enter or Space, and it carries the analysing sweep
 * and the hover loupe. The default slot sits over the photo (the orientation pill on the single stage).
 */
import type { LoupeController } from '../composables/loupe'

const props = defineProps<{ url: string; alt: string; label: string; loupe: LoupeController }>()
const emit = defineEmits<{ enlarge: [frame: HTMLElement] }>()

function enlarge(event: Event) {
  // Opening by any route drops the loupe, including one still waiting to appear.
  props.loupe.hide()
  emit('enlarge', event.currentTarget as HTMLElement)
}
</script>

<template>
  <!-- Enter and Space are handled here, not left to the button's own click, so every route is the same one. -->
  <button
    type="button"
    class="rs-frame"
    :aria-label="label"
    @click="enlarge"
    @keydown.enter.prevent="enlarge"
    @keydown.space.prevent="enlarge"
    @pointerenter="loupe.track($event, url)"
    @pointermove="loupe.track($event, url)"
    @pointerleave="loupe.hide()"
    @pointerdown="loupe.hide()"
  >
    <img class="rs-photo__img" :src="url" :alt="alt" />
    <slot />
    <span class="rs-analysing"><span class="rs-sweep" aria-hidden="true"></span></span>
  </button>
</template>

<style scoped>
.rs-frame {
  display: block;
  /* The strip sizes the frame by its height; the photo fills that height at its own aspect ratio. */
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: zoom-in;
}
.rs-frame:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.rs-photo__img {
  display: block;
  width: auto;
  max-width: 100%;
  height: 100%;
  object-fit: contain;
  image-orientation: from-image;
}
</style>
