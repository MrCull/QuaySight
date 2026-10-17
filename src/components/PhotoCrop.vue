<script setup lang="ts">
// An enlarged crop of where a reading was read (ticket #67). Give it the reading's own photo and the box it
// carries; the seal and the placards use it the same way. With no usable box, or a photo that will not
// load, it renders nothing at all: no caption, no frame.
import { computed, ref, watch } from 'vue'
import { enlargedCrop, type ReadingBox } from '../domain/enlargedCrop'
import { usableIdBox } from '../domain/cropRead'

const props = defineProps<{
  /** The photo the box was asked on. */
  src: string
  box: ReadingBox | null | undefined
  /** "Where we read the ID". */
  caption: string
  /** What the crop shows, for the image's alt text: "The container ID". */
  label: string
}>()

const size = ref<{ width: number; height: number } | null>(null)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    size.value = null
    failed.value = false
  },
)

const usable = computed(() => usableIdBox(props.box) !== null)
const frame = computed(() => (size.value ? enlargedCrop(size.value, props.box) : null))

function onLoad(event: Event) {
  const img = event.target as HTMLImageElement
  size.value = { width: img.naturalWidth, height: img.naturalHeight }
}

const frameStyle = computed(() =>
  frame.value ? { aspectRatio: `${frame.value.width} / ${frame.value.height}` } : undefined,
)
// The whole photo is laid out so the region fills the frame: percentages of the region's own size.
const imgStyle = computed(() => {
  const f = frame.value
  const s = size.value
  if (!f || !s) return undefined
  return {
    width: `${(s.width / f.width) * 100}%`,
    left: `${(-f.x / f.width) * 100}%`,
    top: `${(-f.y / f.height) * 100}%`,
  }
})
</script>

<template>
  <figure v-if="usable && !failed" v-show="frame" class="rs-crop">
    <div class="rs-crop__frame" :style="frameStyle">
      <img
        class="rs-crop__img"
        :src="src"
        :alt="`${label}, enlarged`"
        :style="imgStyle"
        @load="onLoad"
        @error="failed = true"
      />
    </div>
    <figcaption class="rs-crop__caption qs-type-body-sm">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.rs-crop {
  margin: var(--space-4) 0 0;
}
.rs-crop__frame {
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: calc(var(--space-8) * 7);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}
.rs-crop__img {
  position: absolute;
  display: block;
  max-width: none;
  image-orientation: from-image;
}
.rs-crop__caption {
  margin: var(--space-2) 0 0;
  color: var(--ink-muted);
}
</style>
