<script setup lang="ts">
/**
 * The hover loupe (design-system/components/Loupe): the original photo, magnified around the spot under the
 * mouse, floating beside the cursor. Decorative and mouse-only; keyboard users have the PhotoViewer.
 * Nothing is drawn in it or on the source photo.
 */
import { computed } from 'vue'
import type { LoupeView } from '../composables/loupe'

const props = defineProps<{ view: LoupeView }>()

const style = computed(() => {
  const { url, lens, left, top } = props.view
  return {
    left: `${left}px`,
    top: `${top}px`,
    backgroundImage: `url("${url}")`,
    backgroundSize: `${lens.imageWidth}px ${lens.imageHeight}px`,
    backgroundPosition: `${lens.offsetX}px ${lens.offsetY}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="qs-loupe" aria-hidden="true" :style="style"></div>
  </Teleport>
</template>
