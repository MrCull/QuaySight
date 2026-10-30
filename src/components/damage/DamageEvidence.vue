<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { DamageFinding } from '../../domain/damage'
import PhotoViewer from '../PhotoViewer.vue'

const props = defineProps<{
  finding: DamageFinding
  photos: { name: string; url: string }[]
}>()
const viewing = ref<number | null>(null)
let opener: HTMLElement | null = null
const sources = computed(() =>
  (props.finding.observations ?? []).map((observation) => {
    const source = observation.photo
    // An explicit index disambiguates photos with the same filename. A missing source is never guessed.
    const index =
      source?.index !== undefined
        ? source.index - 1
        : source
          ? props.photos.findIndex((p) => p.name === source.name)
          : -1
    const photo = props.photos[index]
    return { observation, index: photo?.name === source?.name ? index : -1 }
  }),
)
const viewerPhotos = computed(() =>
  props.photos.map((photo, i) => ({
    url: photo.url,
    alt: `Container photo ${i + 1}: ${photo.name}`,
    face: null,
  })),
)
function open(index: number, event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  viewing.value = index
}
async function close() {
  viewing.value = null
  await nextTick()
  opener?.focus()
  opener = null
}
watch(
  () => props.finding.id,
  () => {
    viewing.value = null
  },
)
</script>

<template>
  <section class="qs-finding-detail__section" data-detail="photo-evidence">
    <h4>Photographic evidence</h4>
    <p v-if="sources.length > 1">
      Observations grouped by approximate region and type. They may show different defects.
    </p>
    <p v-for="{ observation, index } in sources" :key="observation.id">
      <button v-if="index >= 0" type="button" class="qs-link" @click="open(index, $event)">
        View photo {{ index + 1 }}: {{ observation.evidence.location }}
      </button>
      <template v-else>Source photo unavailable: {{ observation.evidence.location }}</template>
    </p>
    <p v-if="sources.length === 0">Source photo unavailable for this finding.</p>
    <p>Positions on the drawing are approximate areas.</p>
    <PhotoViewer v-if="viewing !== null" :photos="viewerPhotos" :start="viewing" @close="close" />
  </section>
</template>
