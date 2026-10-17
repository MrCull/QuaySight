<script setup lang="ts">
/**
 * The full-screen photo viewer (design-system/components/PhotoViewer): the original photo, fitted, nothing drawn
 * on it. Any click, the × or Esc closes it; with several photos ←/→ (buttons or keys) step through them and wrap.
 * It is modal while open: Tab stays inside it, the page behind does not scroll, and its keys go nowhere else.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { reducedMotionClassSet } from '../composables/reducedMotion'

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
const reducedMotion = reducedMotionClassSet()
const several = computed(() => props.photos.length > 1)
/** The photo shown, kept in range if the photos change while the viewer is open. */
const shown = computed(() => (index.value < props.photos.length ? index.value : 0))
const current = computed(() => props.photos[shown.value]!)
const caption = computed(() => {
  const place = `Photo ${shown.value + 1} of ${props.photos.length}`
  return current.value.face ? `${place} · ${current.value.face}` : place
})

function step(by: number) {
  const n = props.photos.length
  index.value = (shown.value + by + n) % n
}

/** Keeps Tab and Shift+Tab cycling through the viewer's own buttons. */
function trapTab(event: KeyboardEvent) {
  const buttons = [...(root.value?.querySelectorAll<HTMLElement>('button') ?? [])]
  if (buttons.length === 0) return
  const first = buttons[0]!
  const last = buttons[buttons.length - 1]!
  const at = document.activeElement
  const inside = at instanceof HTMLElement && buttons.includes(at)
  if (event.shiftKey && (at === first || !inside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (at === last || !inside)) {
    event.preventDefault()
    first.focus()
  }
}

function onKey(event: KeyboardEvent) {
  // Listening on window in the capture phase runs before any document-level handler, so stopping the
  // keys the viewer owns here keeps the settings drawer and the like from also acting on them.
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
  } else if (event.key === 'Tab') {
    event.stopPropagation()
    trapTab(event)
  } else if (several.value && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    event.stopPropagation()
    step(event.key === 'ArrowLeft' ? -1 : 1)
  }
}

let previousOverflow = ''
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  root.value?.focus()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="root"
      :class="['qs-viewer', { 'qs-reduced-motion': reducedMotion }]"
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
  </Teleport>
</template>
