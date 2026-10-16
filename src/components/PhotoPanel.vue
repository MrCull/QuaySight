<script setup lang="ts">
import { computed, ref } from 'vue'
import { useInspectionStore } from '../stores/inspection'
import { readPhotoFile, PHOTO_ACCEPT } from '../services/readPhoto'
import AnalysingStages from './AnalysingStages.vue'

const store = useInspectionStore()
const picker = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const error = ref<string | null>(null)
const busy = computed(() => store.status === 'running')

const orientationLabel = computed(() => {
  switch (store.photo?.orientation) {
    case 'landscape':
      return 'Landscape photo'
    case 'portrait':
      return 'Portrait photo'
    case 'square':
      return 'Square photo'
    default:
      return 'Orientation unknown'
  }
})

async function take(file: File | undefined) {
  if (!file || busy.value) return
  error.value = null
  try {
    const photo = await readPhotoFile(file)
    const previous = store.photo?.url
    store.setPhoto(photo)
    if (previous) URL.revokeObjectURL(previous)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'That photo could not be read.'
  }
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  void take(target.files?.[0])
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void take(event.dataTransfer?.files?.[0])
}

function openPicker() {
  picker.value?.click()
}
</script>

<template>
  <div class="rs-left">
    <!-- Demo mode has no upload: its recorded results belong to the bundled samples only. -->
    <input
      v-if="!store.demo"
      ref="picker"
      type="file"
      class="photo-picker"
      :accept="PHOTO_ACCEPT"
      aria-label="Choose a container photo"
      :disabled="busy"
      @change="onPick"
    />

    <label
      v-if="!store.photo"
      :class="['qs-drop', { 'qs-drop--over': dragging }]"
      tabindex="0"
      data-next-step="photo"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
    >
      <span class="qs-drop__icon"><i class="qs-glyph qs-glyph--photo" aria-hidden="true"></i></span>
      <span class="qs-drop__title">Drop a container photo here</span>
      <span class="qs-drop__meta">or <u>browse files</u> · JPEG, PNG or WebP</span>
    </label>

    <template v-else>
      <div class="rs-photo">
        <img
          class="rs-photo__img"
          :src="store.photo.url"
          :alt="`Container photo: ${store.photo.name}`"
        />
        <div class="rs-photo__bar">
          <span class="rs-pill">
            <i class="qs-glyph qs-glyph--photo" aria-hidden="true"></i>{{ orientationLabel }}
          </span>
        </div>
        <div class="rs-analysing">
          <div class="rs-sweep" aria-hidden="true"></div>
          <AnalysingStages />
        </div>
      </div>
      <div v-if="!store.demo">
        <button
          type="button"
          class="qs-btn qs-btn--secondary qs-btn--sm"
          :disabled="busy"
          @click="openPicker"
        >
          Replace photo
        </button>
      </div>
    </template>

    <p v-if="error" class="qs-hint qs-hint--warn" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.rs-photo__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-orientation: from-image;
}
.photo-picker {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
