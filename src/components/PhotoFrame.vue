<script setup lang="ts">
/**
 * One container photo on the stage: the single-photo stage and each tile of the 2–4 photo grid. It is a button
 * that asks to enlarge the photo (PhotoViewer), and it carries the analysing sweep. The default slot sits over
 * the photo (the orientation pill on the single stage).
 */
defineProps<{ url: string; alt: string; label: string }>()
defineEmits<{ enlarge: [frame: HTMLElement] }>()
</script>

<template>
  <button
    type="button"
    class="rs-frame"
    :aria-label="label"
    @click="$emit('enlarge', $event.currentTarget as HTMLElement)"
  >
    <img class="rs-photo__img" :src="url" :alt="alt" />
    <slot />
    <span class="rs-analysing"><span class="rs-sweep" aria-hidden="true"></span></span>
  </button>
</template>

<style scoped>
.rs-frame {
  display: block;
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
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-orientation: from-image;
}
</style>
