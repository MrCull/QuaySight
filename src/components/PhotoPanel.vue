<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { MAX_PHOTOS, TOO_MANY_PHOTOS, useInspectionStore } from '../stores/inspection'
import { faceChipLabel, facesShown } from '../domain/photoFace'
import { readPhotoFile, PHOTO_ACCEPT } from '../services/readPhoto'
import { useLoupe } from '../composables/loupe'
import PhotoFrame from './PhotoFrame.vue'
import PhotoLoupe from './PhotoLoupe.vue'
import PhotoViewer, { type ViewerPhoto } from './PhotoViewer.vue'

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
    ? faceChipLabel(
        photo.face?.face ?? null,
        photo.side,
        photo.face?.closeUpSubject ?? null,
        facesShown(photo.face),
      )
    : null
}

/** The photo shown full screen, by index; null when the viewer is closed. */
const viewing = ref<number | null>(null)
const viewerPhotos = computed<ViewerPhoto[]>(() =>
  store.photos.map((photo, i) => ({
    url: photo.url,
    alt: `Container photo ${i + 1}: ${photo.name}`,
    face: store.photos.length > 1 ? chipFor(i) : null,
  })),
)
let opener: HTMLElement | null = null

/** The hover loupe, shared by every photo so it can carry over between them. */
const loupe = useLoupe()

/** Opens the viewer on a photo; focus comes back to the frame that opened it. */
function enlarge(index: number, frame: HTMLElement) {
  opener = frame
  viewing.value = index
}

async function closeViewer() {
  viewing.value = null
  await nextTick()
  opener?.focus()
  opener = null
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
    // Choosing photos is the go-ahead. Without a key the app shell opens settings and waits for one.
    void store.startWhenReady()
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
  <div class="rs-strip">
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
      <span class="qs-drop__meta">1–5 photos of one container · JPEG, PNG or WebP</span>
      <!-- Drawn as the screen's primary action; the whole zone is the control, so this is not a second button. -->
      <span class="qs-btn qs-btn--primary qs-btn--lg qs-drop__cta" aria-hidden="true">
        <i class="qs-glyph qs-glyph--upload" aria-hidden="true"></i>Choose photos
      </span>
    </label>

    <template v-else>
      <!-- The strip: every photo in one centred row of fixed height, each at its own aspect ratio. -->
      <ul class="rs-photos" :style="{ '--n': store.photos.length }">
        <li v-for="(photo, i) in store.photos" :key="photo.url" class="rs-photos__item">
          <PhotoFrame
            class="rs-photos__frame"
            :url="photo.url"
            :alt="
              store.photos.length > 1
                ? `Container photo ${i + 1}: ${photo.name}`
                : `Container photo: ${photo.name}`
            "
            :label="
              store.photos.length > 1
                ? `Enlarge photo ${i + 1} of ${store.photos.length}`
                : 'Enlarge photo'
            "
            :loupe="loupe"
            @enlarge="enlarge(i, $event)"
          />
          <!-- Under the photo, never over it. -->
          <div class="rs-photos__cap">
            <span class="rs-photos__n qs-type-body-sm">{{
              store.photos.length > 1 ? `Photo ${i + 1}` : orientationLabel
            }}</span>
            <span v-if="chipFor(i)" class="rs-facechip qs-type-caption" data-face-chip>{{
              chipFor(i)
            }}</span>
          </div>
        </li>
      </ul>
      <!-- Mouse-only and decorative: the original, magnified beside the cursor. -->
      <PhotoLoupe v-if="loupe.view.value && viewing === null" :view="loupe.view.value" />
      <!-- The one full-screen layer: the original photo, over everything, analysing sweep included. -->
      <PhotoViewer
        v-if="viewing !== null"
        :photos="viewerPhotos"
        :start="viewing"
        @close="closeViewer"
      />
    </template>

    <p v-if="error" class="qs-hint qs-hint--warn" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.rs-photos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: var(--space-3);
  /* About 260px on a large screen (4 x 64px). With several photos the row height also shrinks so that
     n landscape photos plus their gaps fit the page width; a narrower photo simply leaves room. */
  --strip-h: min(
    calc(var(--space-8) * 4),
    calc((100vw - 2 * var(--space-6) - (var(--n) - 1) * var(--space-3)) / (var(--n) * 1.5))
  );
}
/* Phones: the photos wrap onto further rows rather than shrink to nothing. */
@media (max-width: 960px) {
  .rs-photos {
    flex-wrap: wrap;
    --strip-h: calc(var(--space-8) * 2.5);
  }
}
.rs-photos__item {
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}
.rs-photos .rs-photos__frame {
  position: relative;
  display: inline-flex;
  width: auto;
  max-width: 100%;
  height: var(--strip-h);
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
.photo-picker {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
