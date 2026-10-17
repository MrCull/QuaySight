<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_PHOTOS, TOO_MANY_PHOTOS, useInspectionStore } from '../stores/inspection'
import { faceChipLabel } from '../domain/photoFace'
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

/** Each photo's chip: the face the survey named, once it has. Several photos only; one photo reads as before. */
function chipFor(index: number): string | null {
  const photo = store.record?.photos?.[index]
  return photo
    ? faceChipLabel(photo.face?.face ?? null, photo.side, photo.face?.closeUpSubject ?? null)
    : null
}

async function take(files: File[]) {
  if (files.length === 0 || busy.value) return
  error.value = null
  if (files.length > MAX_PHOTOS) {
    error.value = TOO_MANY_PHOTOS
    return
  }
  try {
    const photos = await Promise.all(files.map((file) => readPhotoFile(file)))
    const previous = store.photos.map((p) => p.url)
    if (photos.length === 1) store.setPhoto(photos[0]!)
    else {
      const refused = store.setPhotos(photos)
      if (refused) {
        error.value = refused
        return
      }
    }
    for (const url of previous) URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'That photo could not be read.'
  }
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  void take([...(target.files ?? [])])
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void take([...(event.dataTransfer?.files ?? [])])
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
      multiple
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
      <ul v-if="store.photos.length > 1" class="rs-photos">
        <li v-for="(photo, i) in store.photos" :key="photo.url" class="rs-photos__item">
          <div class="rs-photos__frame">
            <img
              class="rs-photo__img"
              :src="photo.url"
              :alt="`Container photo ${i + 1}: ${photo.name}`"
            />
            <div class="rs-analysing"><div class="rs-sweep" aria-hidden="true"></div></div>
          </div>
          <!-- Under the photo, never over it. -->
          <div class="rs-photos__cap">
            <span class="rs-photos__n qs-type-body-sm">Photo {{ i + 1 }}</span>
            <span v-if="chipFor(i)" class="rs-facechip qs-type-caption" data-face-chip>{{
              chipFor(i)
            }}</span>
          </div>
        </li>
      </ul>
      <div v-else class="rs-photo">
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
        </div>
      </div>
      <!-- Under the photo, never over it: no text sits on the photo at any point in a run. -->
      <div class="rs-stages"><AnalysingStages /></div>
      <div v-if="!store.demo">
        <button
          type="button"
          class="qs-btn qs-btn--secondary qs-btn--sm"
          :disabled="busy"
          @click="openPicker"
        >
          {{ store.photos.length > 1 ? 'Replace photos' : 'Replace photo' }}
        </button>
      </div>
    </template>

    <p v-if="error" class="qs-hint qs-hint--warn" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.rs-photos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.rs-photos__frame {
  position: relative;
  aspect-ratio: 1000/640;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface-sunken);
  border: 1px solid var(--line);
}
.rs-photos__cap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}
.rs-photos__n {
  color: var(--ink);
}
.rs-facechip {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-strong);
  background: var(--surface-sunken);
  color: var(--ink);
}
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
