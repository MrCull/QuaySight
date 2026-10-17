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
  /** Space kept around the box, as for enlargedCrop; absent keeps the default margin. */
  margin?: number
  /** Several photos or one: the 1-based photo the crop is cut from. The caption names it. */
  photoNumber?: number | null
  /** The outline drawn on the full photo: a hazard sticker takes the hazard colour, everything else the ID's. */
  outline?: 'id' | 'hazard'
}>()

const size = ref<{ width: number; height: number } | null>(null)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    size.value = null
    failed.value = false
    full.value = false
  },
)

const usable = computed(() => usableIdBox(props.box) !== null)
const frame = computed(() =>
  size.value ? enlargedCrop(size.value, props.box, props.margin) : null,
)

// Tapping shows the whole photo with the area outlined; tapping again returns to the close-up.
const full = ref(false)
const fullCaption = computed(() =>
  props.photoNumber ? `${props.caption} · Photo ${props.photoNumber}` : props.caption,
)
const area = computed(() => {
  const b = usableIdBox(props.box)
  if (!b) return null
  const per = (n: number) => Math.round(n * 10000) / 10 // thousandths of the photo
  return {
    x: per(b.left),
    y: per(b.top),
    width: per(b.right - b.left),
    height: per(b.bottom - b.top),
  }
})

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
    <button
      type="button"
      class="rs-crop__tap"
      :aria-expanded="full"
      :aria-label="
        full
          ? `${label}: back to the close-up`
          : `${label}: show the full photo with the area outlined`
      "
      @click="full = !full"
    >
      <span v-show="!full" class="rs-crop__frame" :style="frameStyle">
        <img
          class="rs-crop__img"
          :src="src"
          :alt="`${label}, enlarged`"
          :style="imgStyle"
          @load="onLoad"
          @error="failed = true"
        />
      </span>
      <span
        v-if="full && size && area"
        class="rs-crop__full"
        :style="{ aspectRatio: `${size.width} / ${size.height}` }"
      >
        <img class="rs-crop__whole" :src="src" :alt="`${label}, full photo`" />
        <svg
          :class="['qs-photo rs-crop__outline', `rs-crop__outline--${outline ?? 'id'}`]"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g class="qs-photo-region qs-photo-region--id">
            <rect
              :x="area.x"
              :y="area.y"
              :width="area.width"
              :height="area.height"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </svg>
      </span>
    </button>
    <figcaption class="rs-crop__caption qs-type-body-sm">{{ fullCaption }}</figcaption>
    <p class="rs-crop__hint qs-type-caption">
      {{ full ? 'Tap to return to the close-up' : 'Tap for the full photo' }}
    </p>
  </figure>
</template>

<style scoped>
.rs-crop {
  margin: var(--space-4) 0 0;
}
.rs-crop__frame {
  display: block;
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
.rs-crop__tap {
  display: block;
  width: 100%;
  max-width: calc(var(--space-8) * 7);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.rs-crop__tap:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--space-1);
}
.rs-crop__full {
  display: block;
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}
.rs-crop__whole {
  display: block;
  width: 100%;
  height: 100%;
  image-orientation: from-image;
}
.rs-crop__outline {
  position: absolute;
  inset: 0;
}
.rs-crop__outline--hazard :deep(.qs-photo-region > rect) {
  stroke: var(--hazard-fg);
}
.rs-crop__caption {
  margin: var(--space-2) 0 0;
  color: var(--ink-muted);
}
.rs-crop__hint {
  margin: 0;
  color: var(--ink-muted);
}
</style>
