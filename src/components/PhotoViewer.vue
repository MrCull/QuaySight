<script setup lang="ts">
/**
 * The full-screen photo viewer (design-system/components/PhotoViewer): the original photo, fitted, nothing drawn
 * on it. Any click, the × or Esc closes it; with several photos ←/→ (buttons or keys) step through them and wrap.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface ViewerPhoto {
  url: string
  alt: string
  /** The face the survey named, for the caption; null until it has. */
  face: string | null
}

const props = defineProps<{ photos: ViewerPhoto[]; start: number }>()
const emit = defineEmits<{ close: [] }>()

const index = ref(props.start)
const root = ref<HTMLElement | null>(null)
const several = computed(() => props.photos.length > 1)
const current = computed(() => props.photos[index.value] ?? props.photos[0]!)
const caption = computed(() => {
  const place = `Photo ${index.value + 1} of ${props.photos.length}`
  return current.value.face ? `${place} · ${current.value.face}` : place
})

function step(by: number) {
  const n = props.photos.length
  index.value = (index.value + by + n) % n
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (several.value && event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
  } else if (several.value && event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  root.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    ref="root"
    class="qs-viewer"
    role="dialog"
    aria-modal="true"
    :aria-label="several ? caption : 'Photo'"
    tabindex="-1"
    @click="emit('close')"
  >
    <img class="qs-viewer__img" :src="current.url" :alt="current.alt" />
    <p v-if="several" class="qs-viewer__cap qs-type-caption">{{ caption }}</p>
    <template v-if="several">
      <button
        type="button"
        class="qs-viewer__nav qs-viewer__nav--prev"
        aria-label="Previous photo"
        @click.stop="step(-1)"
      >
        <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="qs-viewer__nav qs-viewer__nav--next"
        aria-label="Next photo"
        @click.stop="step(1)"
      >
        <i class="qs-glyph qs-glyph--chevron" aria-hidden="true"></i>
      </button>
    </template>
    <button
      type="button"
      class="qs-viewer__close"
      aria-label="Close photo"
      @click.stop="emit('close')"
    >
      <i class="qs-glyph qs-glyph--cross" aria-hidden="true"></i>
    </button>
  </div>
</template>
