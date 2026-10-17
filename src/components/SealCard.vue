<script setup lang="ts">
// The Seal card (ticket #68), under the container ID: whether a seal is visible and what its number
// reads, character by character as the ID does, with an enlarged crop of where it was read. A seal has no
// check digit, so none is shown; the card gives no verdict on the seal, only what is seen and read.
import { computed } from 'vue'
import type { CertaintyLabel } from '../domain/inspection'
import type { SealReading } from '../domain/sealFamily'
import CertaintyChip from './CertaintyChip.vue'
import PhotoCrop from './PhotoCrop.vue'

const props = defineProps<{
  reading: SealReading
  /** The photo on screen, which the crop is cut from. */
  photoUrl: string | null
}>()

function charState(level: CertaintyLabel): string | undefined {
  if (level === 'Confident') return undefined
  if (level === 'Likely') return 'likely'
  if (level === 'Uncertain') return 'uncertain'
  return 'unknown'
}

const chars = computed(() =>
  props.reading.characters.map((c, index) => ({
    ch: c.value ?? '·',
    index,
    state: c.value === null ? 'unknown' : charState(c.certainty),
  })),
)

const hasNumber = computed(() => props.reading.characters.some((c) => c.value !== null))

const spelled = computed(() =>
  props.reading.characters
    .map((c, i) => {
      if (c.value === null) return `position ${i + 1} not read`
      return c.certainty === 'Confident' ? c.value : `${c.value} (${c.certainty.toLowerCase()})`
    })
    .join(' '),
)
</script>

<template>
  <div class="rs-card rs-seal">
    <div class="rs-card__head">
      <span class="rs-k">Seal</span>
      <CertaintyChip :level="reading.certainty" />
    </div>
    <p v-if="!reading.visible" class="rs-note qs-type-body-sm" role="status">
      No seal visible in this photo
    </p>
    <p v-else-if="!hasNumber" class="rs-note qs-type-body-sm" role="status">
      A seal is visible, number not readable in this photo
    </p>
    <template v-else>
      <div class="qs-id qs-id--md" :aria-label="spelled">
        <span class="qs-id__group">
          <span
            v-for="c in chars"
            :key="c.index"
            class="qs-id__ch"
            :data-c="c.state"
            :style="{ '--c': c.index }"
            >{{ c.ch }}</span
          >
        </span>
      </div>
      <PhotoCrop
        v-if="photoUrl"
        class="qs-rise"
        :style="{ '--i': 1 }"
        :src="photoUrl"
        :box="reading.box"
        caption="Where we read the seal"
        label="The seal"
      />
    </template>
  </div>
</template>
